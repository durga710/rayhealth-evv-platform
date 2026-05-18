import type { Knex } from 'knex'
import type {
  AssignmentBlocker,
  AssignmentComplianceCheck,
  CaregiverLearningProgress,
  CourseAnalyticsEnvelope,
  CourseAnalyticsRow,
  CourseCaregiverEnvelope,
  CourseCaregiverRow,
  CourseCompletion,
  CourseEnrollment,
  EnrollmentStatus,
  InsightCaregiver,
  LearningAgencyRollup,
  LearningCourse,
  LearningInsight,
  LearningInsightsEnvelope,
  NewCourseCompletion,
  NewCourseEnrollment,
  NewLearningCourse,
} from '../domain/learning.js'

interface InsightRowShape {
  enrollment_id: string
  caregiver_id: string
  first_name: string
  last_name: string
  course_title: string
  course_code: string
  due_at: string | null
  expires_at: string | null
  assigned_at: string
}

/**
 * LearningRepository — courses, enrollments, completions.
 *
 * Enrollment status is computed deterministically from the underlying rows
 * (last_completed_at, expires_at, due_at). The status column on
 * course_enrollments is a denormalized cache for fast querying — write it
 * via recomputeStatusForEnrollment() whenever the underlying data changes.
 */
export class LearningRepository {
  constructor(private readonly db: Knex) {}

  // ---------- Courses ----------

  async listCourses(agencyId: string): Promise<LearningCourse[]> {
    const rows = (await this.db('learning_courses')
      .where((q) => q.where('agency_id', agencyId).orWhereNull('agency_id'))
      .orderBy('required', 'desc')
      .orderBy('title', 'asc')) as Array<Record<string, unknown>>
    return rows.map((r) => this.mapCourse(r))
  }

  async findCourseById(id: string): Promise<LearningCourse | undefined> {
    const row = (await this.db('learning_courses').where({ id }).first()) as
      | Record<string, unknown>
      | undefined
    return row ? this.mapCourse(row) : undefined
  }

  async findCourseByCode(agencyId: string | null, code: string): Promise<LearningCourse | undefined> {
    const query = this.db('learning_courses').where({ code })
    if (agencyId === null) {
      query.whereNull('agency_id')
    } else {
      query.where('agency_id', agencyId)
    }
    const row = (await query.first()) as Record<string, unknown> | undefined
    return row ? this.mapCourse(row) : undefined
  }

  async createCourse(data: NewLearningCourse): Promise<LearningCourse> {
    const [row] = (await this.db('learning_courses')
      .insert({
        agency_id: data.agencyId,
        code: data.code,
        title: data.title,
        description: data.description,
        cadence: data.cadence,
        expires_after_days: data.expiresAfterDays,
        required: data.required,
        duration_minutes: data.durationMinutes,
      })
      .returning('*')) as Array<Record<string, unknown>>
    return this.mapCourse(row)
  }

  /** Idempotent upsert by (agency_id, code). Used by the catalog seed script. */
  async upsertCourseByCode(data: NewLearningCourse): Promise<LearningCourse> {
    const existing = await this.findCourseByCode(data.agencyId, data.code)
    if (existing) return existing
    return this.createCourse(data)
  }

  // ---------- Enrollments ----------

  async listEnrollmentsForCaregiver(caregiverId: string): Promise<CourseEnrollment[]> {
    const rows = (await this.db('course_enrollments')
      .where({ caregiver_id: caregiverId })
      .orderBy('assigned_at', 'desc')) as Array<Record<string, unknown>>
    return rows.map((r) => this.mapEnrollment(r))
  }

  async findEnrollment(
    caregiverId: string,
    courseId: string,
  ): Promise<CourseEnrollment | undefined> {
    const row = (await this.db('course_enrollments')
      .where({ caregiver_id: caregiverId, course_id: courseId })
      .first()) as Record<string, unknown> | undefined
    return row ? this.mapEnrollment(row) : undefined
  }

  async enroll(data: NewCourseEnrollment): Promise<CourseEnrollment> {
    const existing = await this.findEnrollment(data.caregiverId, data.courseId)
    if (existing) return existing
    const [row] = (await this.db('course_enrollments')
      .insert({
        agency_id: data.agencyId,
        caregiver_id: data.caregiverId,
        course_id: data.courseId,
        due_at: data.dueAt,
        status: 'not_started',
      })
      .returning('*')) as Array<Record<string, unknown>>
    return this.mapEnrollment(row)
  }

  // ---------- Completions ----------

  /**
   * Record a completion event and update the enrollment's denormalized state.
   * Completions are append-only; updating an enrollment's last_completed_at is
   * a separate concern. Done in a single transaction so audit trail and state
   * stay in sync.
   */
  async recordCompletion(data: NewCourseCompletion): Promise<CourseCompletion> {
    return this.db.transaction(async (trx) => {
      const enrollment = (await trx('course_enrollments')
        .where({ id: data.enrollmentId })
        .first()) as Record<string, unknown> | undefined
      if (!enrollment) {
        throw new Error(`Enrollment ${data.enrollmentId} not found`)
      }
      const course = (await trx('learning_courses')
        .where({ id: data.courseId })
        .first()) as Record<string, unknown> | undefined
      if (!course) {
        throw new Error(`Course ${data.courseId} not found`)
      }

      const [completionRow] = (await trx('course_completions')
        .insert({
          enrollment_id: data.enrollmentId,
          caregiver_id: data.caregiverId,
          course_id: data.courseId,
          completed_at: data.completedAt,
          score: data.score,
          notes: data.notes,
        })
        .returning('*')) as Array<Record<string, unknown>>

      // Compute the new expiry timestamp from cadence + expires_after_days.
      const expiresAfterDays = course.expires_after_days as number | null
      const completedAtDate = new Date(data.completedAt)
      const expiresAt =
        expiresAfterDays && expiresAfterDays > 0
          ? new Date(completedAtDate.getTime() + expiresAfterDays * 86400000).toISOString()
          : null

      await trx('course_enrollments')
        .where({ id: data.enrollmentId })
        .update({
          last_completed_at: data.completedAt,
          expires_at: expiresAt,
          status: 'completed',
          updated_at: trx.fn.now(),
        })

      return this.mapCompletion(completionRow)
    })
  }

  // ---------- Aggregate queries ----------

  async getAgencyRollup(agencyId: string, now: Date = new Date()): Promise<LearningAgencyRollup> {
    const nowIso = now.toISOString()
    const caregiversRow = (await this.db('caregivers')
      .where({ agency_id: agencyId, status: 'active' })
      .count('id as total')
      .first()) as { total: string } | undefined
    const totalCaregivers = Number(caregiversRow?.total ?? 0)

    // Re-derive each enrollment's effective status against `now` so the
    // rollup is correct even if the denormalized status column is stale.
    const enrollments = (await this.db('course_enrollments')
      .where({ agency_id: agencyId })
      .select(
        'id',
        'status',
        'last_completed_at',
        'expires_at',
        'due_at',
      )) as Array<{
      id: string
      status: string
      last_completed_at: Date | null
      expires_at: Date | null
      due_at: Date | null
    }>

    const counts: Record<EnrollmentStatus, number> = {
      not_started: 0,
      in_progress: 0,
      completed: 0,
      overdue: 0,
      expired: 0,
    }
    for (const e of enrollments) {
      const status = this.deriveStatus(
        e.status as EnrollmentStatus,
        e.last_completed_at ? e.last_completed_at.toISOString() : null,
        e.expires_at ? e.expires_at.toISOString() : null,
        e.due_at ? e.due_at.toISOString() : null,
        nowIso,
      )
      counts[status] += 1
    }

    const totalEnrollments = enrollments.length
    const required = counts.completed + counts.overdue + counts.expired + counts.not_started + counts.in_progress
    const complianceRate = required > 0 ? counts.completed / required : 1

    return {
      totalCaregivers,
      totalEnrollments,
      notStarted: counts.not_started,
      inProgress: counts.in_progress,
      completed: counts.completed,
      overdue: counts.overdue,
      expired: counts.expired,
      complianceRate,
    }
  }

  async getCaregiverProgress(
    caregiverId: string,
    now: Date = new Date(),
  ): Promise<CaregiverLearningProgress> {
    const nowIso = now.toISOString()
    const rows = (await this.db('course_enrollments as e')
      .join('learning_courses as c', 'c.id', 'e.course_id')
      .where('e.caregiver_id', caregiverId)
      .select('e.*', { course_id_join: 'c.id' }, this.db.raw('row_to_json(c.*) as course_json'))) as Array<
      Record<string, unknown>
    >

    let allCompliant = true
    const items: CaregiverLearningProgress['enrollments'] = rows.map((row) => {
      const enrollment = this.mapEnrollment(row)
      const course = this.mapCourse(row.course_json as Record<string, unknown>)
      const effective = this.deriveStatus(
        enrollment.status,
        enrollment.lastCompletedAt,
        enrollment.expiresAt,
        enrollment.dueAt,
        nowIso,
      )
      if (course.required && effective !== 'completed') {
        allCompliant = false
      }
      return { enrollment: { ...enrollment, status: effective }, course }
    })

    return {
      caregiverId,
      enrollments: items,
      isCompliant: allCompliant,
    }
  }

  // ---------- Course analytics ----------

  /**
   * Per-course rollup for the analytics page. Aggregates enrollments for
   * each course visible to this agency (global + agency-owned), computes
   * status counts by re-deriving from timestamps so the result is consistent
   * with the dashboard rollup even if denormalized statuses are stale.
   *
   * Time-to-complete is averaged over completed enrollments only — not over
   * the catalog. Caregivers who never complete don't drag the number down,
   * which is the right semantic ("on average, those who DID complete took
   * N days") for coordinators trying to spot bottleneck courses.
   */
  async getCourseAnalytics(
    agencyId: string,
    now: Date = new Date(),
  ): Promise<CourseAnalyticsEnvelope> {
    const nowIso = now.toISOString()

    interface JoinedRow {
      course_id: string
      course_code: string
      course_title: string
      required: boolean
      cadence: string
      enrollment_id: string | null
      assigned_at: Date | null
      last_completed_at: Date | null
      expires_at: Date | null
      due_at: Date | null
      stored_status: string | null
    }

    const rows = (await this.db('learning_courses as c')
      .leftJoin('course_enrollments as e', (join) => {
        join.on('e.course_id', '=', 'c.id').andOnVal('e.agency_id', agencyId)
      })
      .where((q) => q.where('c.agency_id', agencyId).orWhereNull('c.agency_id'))
      .select(
        'c.id as course_id',
        'c.code as course_code',
        'c.title as course_title',
        'c.required',
        'c.cadence',
        'e.id as enrollment_id',
        'e.assigned_at',
        'e.last_completed_at',
        'e.expires_at',
        'e.due_at',
        'e.status as stored_status',
      )) as JoinedRow[]

    // Group rows by course, then aggregate.
    const byCourse = new Map<string, { course: JoinedRow; rows: JoinedRow[] }>()
    for (const r of rows) {
      const existing = byCourse.get(r.course_id)
      if (!existing) {
        byCourse.set(r.course_id, { course: r, rows: r.enrollment_id ? [r] : [] })
      } else if (r.enrollment_id) {
        existing.rows.push(r)
      }
    }

    const analyticsRows: CourseAnalyticsRow[] = []
    for (const { course, rows: enrollmentRows } of byCourse.values()) {
      let completed = 0
      let overdue = 0
      let expired = 0
      let pending = 0
      let timeToCompleteSumDays = 0
      let timeToCompleteCount = 0

      for (const r of enrollmentRows) {
        const effective = this.deriveStatus(
          (r.stored_status as EnrollmentStatus) ?? 'not_started',
          r.last_completed_at ? r.last_completed_at.toISOString() : null,
          r.expires_at ? r.expires_at.toISOString() : null,
          r.due_at ? r.due_at.toISOString() : null,
          nowIso,
        )
        switch (effective) {
          case 'completed': completed += 1; break
          case 'overdue': overdue += 1; break
          case 'expired': expired += 1; break
          case 'not_started':
          case 'in_progress':
            pending += 1
            break
        }
        if (r.last_completed_at && r.assigned_at) {
          const diffMs = r.last_completed_at.getTime() - r.assigned_at.getTime()
          if (diffMs > 0) {
            timeToCompleteSumDays += diffMs / 86400000
            timeToCompleteCount += 1
          }
        }
      }

      const total = completed + overdue + expired + pending
      analyticsRows.push({
        courseId: course.course_id,
        courseCode: course.course_code,
        courseTitle: course.course_title,
        required: Boolean(course.required),
        cadence: course.cadence as CourseAnalyticsRow['cadence'],
        totalEnrollments: total,
        completedCount: completed,
        overdueCount: overdue,
        expiredCount: expired,
        pendingCount: pending,
        completionRate: total > 0 ? completed / total : 0,
        averageDaysToComplete:
          timeToCompleteCount > 0 ? timeToCompleteSumDays / timeToCompleteCount : null,
      })
    }

    // Sort: required first, then by completion rate ascending (worst at top).
    analyticsRows.sort((a, b) => {
      if (a.required !== b.required) return a.required ? -1 : 1
      return a.completionRate - b.completionRate
    })

    return {
      generatedAt: nowIso,
      rows: analyticsRows,
    }
  }

  /**
   * Per-course drill-down: every caregiver enrolled in this course in the
   * given agency, with effective status. Used by the analytics page's course
   * detail view.
   */
  async getCourseCaregivers(
    courseId: string,
    agencyId: string,
    now: Date = new Date(),
  ): Promise<CourseCaregiverEnvelope | undefined> {
    const course = await this.findCourseById(courseId)
    if (!course) return undefined

    const rows = (await this.db('course_enrollments as e')
      .join('caregivers as cg', 'cg.id', 'e.caregiver_id')
      .where('e.course_id', courseId)
      .where('e.agency_id', agencyId)
      .select(
        'e.id as enrollment_id',
        'e.agency_id',
        'e.caregiver_id',
        'e.course_id',
        'e.assigned_at',
        'e.due_at',
        'e.last_completed_at',
        'e.expires_at',
        'e.status',
        'cg.id as cg_id',
        'cg.first_name',
        'cg.last_name',
        'cg.email',
      )
      .orderBy('cg.last_name', 'asc')) as Array<Record<string, unknown>>

    const nowIso = now.toISOString()
    const caregivers: CourseCaregiverRow[] = rows.map((r) => {
      const enrollment = this.mapEnrollment({
        id: r.enrollment_id,
        agency_id: r.agency_id,
        caregiver_id: r.caregiver_id,
        course_id: r.course_id,
        assigned_at: r.assigned_at,
        due_at: r.due_at,
        last_completed_at: r.last_completed_at,
        expires_at: r.expires_at,
        status: r.status,
      })
      const effective = this.deriveStatus(
        enrollment.status,
        enrollment.lastCompletedAt,
        enrollment.expiresAt,
        enrollment.dueAt,
        nowIso,
      )
      return {
        enrollment: { ...enrollment, status: effective },
        caregiver: {
          id: String(r.cg_id),
          firstName: String(r.first_name),
          lastName: String(r.last_name),
          email: String(r.email),
        },
        effectiveStatus: effective,
      }
    })

    return { course, caregivers }
  }

  // ---------- Assignment compliance gate ----------

  /**
   * Check whether a caregiver has any blocking learning state that should
   * prevent the scheduling layer from putting them on a new visit.
   *
   * Semantics:
   *   - No enrollments at all → considered compliant (agency hasn't set up
   *     training for this caregiver yet — not our place to gate)
   *   - Required enrollment with effective status of overdue/expired → blocker
   *   - Required enrollment not yet completed AND past its due date → blocker
   *   - Caregivers with all required enrollments completed (and current) → compliant
   *
   * Note: this is deliberately lenient. The strictest interpretation of
   * PA §52.18 would require orientation completion before *any* visit, even
   * before the agency has assigned the course. That stricter check is left
   * to the agency policy layer — this method just enforces what's been
   * explicitly assigned.
   */
  async getAssignmentBlockers(
    caregiverId: string,
    now: Date = new Date(),
  ): Promise<AssignmentComplianceCheck> {
    const nowIso = now.toISOString()
    const rows = (await this.db('course_enrollments as e')
      .join('learning_courses as c', 'c.id', 'e.course_id')
      .where('e.caregiver_id', caregiverId)
      .where('c.required', true)
      .select(
        'e.id as enrollment_id',
        'e.status',
        'e.last_completed_at',
        'e.expires_at',
        'e.due_at',
        'c.code as course_code',
        'c.title as course_title',
      )) as Array<{
      enrollment_id: string
      status: string
      last_completed_at: Date | null
      expires_at: Date | null
      due_at: Date | null
      course_code: string
      course_title: string
    }>

    const blockers: AssignmentBlocker[] = []
    for (const r of rows) {
      const effectiveStatus = this.deriveStatus(
        r.status as EnrollmentStatus,
        r.last_completed_at ? r.last_completed_at.toISOString() : null,
        r.expires_at ? r.expires_at.toISOString() : null,
        r.due_at ? r.due_at.toISOString() : null,
        nowIso,
      )
      if (effectiveStatus === 'completed') continue
      blockers.push({
        enrollmentId: r.enrollment_id,
        courseCode: r.course_code,
        courseTitle: r.course_title,
        status: effectiveStatus,
        reason:
          effectiveStatus === 'expired'
            ? `${r.course_title} expired — recertify before scheduling`
            : effectiveStatus === 'overdue'
              ? `${r.course_title} is overdue`
              : `${r.course_title} not yet completed`,
      })
    }

    return {
      compliant: blockers.length === 0,
      blockers,
    }
  }

  // ---------- Actionable insights ----------

  /**
   * Compute deterministic actionable insights for the Learning Hub dashboard.
   * Each insight is a category of caregiver state that a coordinator needs
   * to act on (or know about).
   *
   * Why deterministic SQL not an LLM: every signal here drives a compliance
   * decision (assign training, escalate to manager, document corrective action).
   * Coordinators need to trust that "due in 7 days" means *exactly* that — and
   * an auditor reading the trail needs the rules to be reproducible.
   */
  async getActionableInsights(
    agencyId: string,
    now: Date = new Date(),
  ): Promise<LearningInsightsEnvelope> {
    const nowIso = now.toISOString()
    const in7DaysIso = new Date(now.getTime() + 7 * 86400000).toISOString()
    const in60DaysIso = new Date(now.getTime() + 60 * 86400000).toISOString()
    const ago30DaysIso = new Date(now.getTime() - 30 * 86400000).toISOString()

    const insights: LearningInsight[] = []

    // ---- Insight 1: required enrollments due in 7 days, not yet completed ----
    const dueSoon = await this.fetchInsightRows(agencyId, (q) =>
      q
        .where('c.required', true)
        .whereNotNull('e.due_at')
        .where('e.due_at', '>=', nowIso)
        .where('e.due_at', '<=', in7DaysIso)
        .whereNull('e.last_completed_at'),
    )
    if (dueSoon.length > 0) {
      insights.push({
        kind: 'due_in_7_days',
        severity: 'warning',
        title: `${dueSoon.length} caregiver${dueSoon.length === 1 ? '' : 's'} due for training this week`,
        summary:
          'Required training due in the next 7 days. Send a reminder or escalate to the caregiver\'s coordinator before the due date passes.',
        actionLabel: 'Review caregivers',
        caregivers: dueSoon.slice(0, 10).map((r) => this.toInsightCaregiver(r, 'due')),
        totalCount: dueSoon.length,
      })
    }

    // ---- Insight 2: required enrollments that expired in the last 30 days ----
    const recentlyExpired = await this.fetchInsightRows(agencyId, (q) =>
      q
        .where('c.required', true)
        .whereNotNull('e.expires_at')
        .where('e.expires_at', '>=', ago30DaysIso)
        .where('e.expires_at', '<', nowIso),
    )
    if (recentlyExpired.length > 0) {
      insights.push({
        kind: 'expired_recently',
        severity: 'critical',
        title: `${recentlyExpired.length} required certification${recentlyExpired.length === 1 ? '' : 's'} expired`,
        summary:
          'Required training expired in the last 30 days. These caregivers are operating without current certification — block their next visit until recertified.',
        actionLabel: 'Open caregivers',
        caregivers: recentlyExpired.slice(0, 10).map((r) => this.toInsightCaregiver(r, 'expired')),
        totalCount: recentlyExpired.length,
      })
    }

    // ---- Insight 3: orientation incomplete ----
    const orientationIncomplete = await this.fetchInsightRows(agencyId, (q) =>
      q.where('c.code', 'like', 'ORIENT-%').whereNull('e.last_completed_at'),
    )
    if (orientationIncomplete.length > 0) {
      insights.push({
        kind: 'orientation_incomplete',
        severity: 'critical',
        title: `${orientationIncomplete.length} caregiver${orientationIncomplete.length === 1 ? '' : 's'} pending orientation`,
        summary:
          'Caregivers who have not completed the one-time orientation. Per PA Code §52.18, orientation must be complete before first client contact.',
        actionLabel: 'Open caregivers',
        caregivers: orientationIncomplete.slice(0, 10).map((r) =>
          this.toInsightCaregiver(r, 'orientation'),
        ),
        totalCount: orientationIncomplete.length,
      })
    }

    // ---- Insight 4: stalled — enrolled > 30 days ago, never completed, no due date ----
    const stalled = await this.fetchInsightRows(agencyId, (q) =>
      q
        .whereNull('e.last_completed_at')
        .whereNull('e.due_at')
        .where('e.assigned_at', '<', ago30DaysIso),
    )
    if (stalled.length > 0) {
      insights.push({
        kind: 'stalled_enrollment',
        severity: 'info',
        title: `${stalled.length} stalled enrollment${stalled.length === 1 ? '' : 's'}`,
        summary:
          'Enrollments assigned more than 30 days ago with no completion and no due date set. Add a due date to drive accountability.',
        actionLabel: 'Set due dates',
        caregivers: stalled.slice(0, 10).map((r) => this.toInsightCaregiver(r, 'stalled')),
        totalCount: stalled.length,
      })
    }

    // ---- Insight 5: certifications expiring in the next 60 days ----
    const certExpiringSoon = await this.fetchInsightRows(agencyId, (q) =>
      q
        .where('c.cadence', 'certification')
        .whereNotNull('e.expires_at')
        .where('e.expires_at', '>=', nowIso)
        .where('e.expires_at', '<=', in60DaysIso),
    )
    if (certExpiringSoon.length > 0) {
      insights.push({
        kind: 'certification_expiring_soon',
        severity: 'warning',
        title: `${certExpiringSoon.length} certification${certExpiringSoon.length === 1 ? '' : 's'} expiring in 60 days`,
        summary:
          'External certifications (CPR, first-aid) approaching expiry. Schedule recertification now — external classes typically have 2-4 week lead times.',
        actionLabel: 'Review caregivers',
        caregivers: certExpiringSoon
          .slice(0, 10)
          .map((r) => this.toInsightCaregiver(r, 'cert_expiring')),
        totalCount: certExpiringSoon.length,
      })
    }

    return {
      generatedAt: nowIso,
      insights,
    }
  }

  /**
   * Helper for the insight queries — joins enrollments, courses, caregivers
   * within an agency, applies a caller-supplied predicate, returns rows ready
   * for InsightCaregiver mapping.
   */
  private async fetchInsightRows(
    agencyId: string,
    apply: (qb: Knex.QueryBuilder) => Knex.QueryBuilder,
  ): Promise<Array<InsightRowShape>> {
    const base = this.db('course_enrollments as e')
      .join('learning_courses as c', 'c.id', 'e.course_id')
      .join('caregivers as cg', 'cg.id', 'e.caregiver_id')
      .where('e.agency_id', agencyId)
      .where('cg.status', 'active')
      .select(
        'e.id as enrollment_id',
        'e.caregiver_id',
        'e.due_at',
        'e.expires_at',
        'e.assigned_at',
        'e.last_completed_at',
        'cg.first_name',
        'cg.last_name',
        'c.title as course_title',
        'c.code as course_code',
      )
      .orderBy('e.due_at', 'asc')
      .limit(50)
    const rows = (await apply(base)) as Array<Record<string, unknown>>
    return rows.map((r) => ({
      enrollment_id: String(r.enrollment_id),
      caregiver_id: String(r.caregiver_id),
      first_name: String(r.first_name),
      last_name: String(r.last_name),
      course_title: String(r.course_title),
      course_code: String(r.course_code),
      due_at: r.due_at ? this.toIsoString(r.due_at) : null,
      expires_at: r.expires_at ? this.toIsoString(r.expires_at) : null,
      assigned_at: this.toIsoString(r.assigned_at),
    }))
  }

  private toInsightCaregiver(
    row: InsightRowShape,
    context: 'due' | 'expired' | 'orientation' | 'stalled' | 'cert_expiring',
  ): InsightCaregiver {
    const contextStr = (() => {
      switch (context) {
        case 'due':
          return row.due_at
            ? `${row.course_code} due ${this.formatRelative(row.due_at)}`
            : `${row.course_code} due soon`
        case 'expired':
          return row.expires_at
            ? `${row.course_code} expired ${this.formatRelative(row.expires_at)}`
            : `${row.course_code} expired`
        case 'orientation':
          return 'Orientation not yet completed'
        case 'stalled':
          return `Assigned ${this.formatRelative(row.assigned_at)}, no progress`
        case 'cert_expiring':
          return row.expires_at
            ? `${row.course_code} expires ${this.formatRelative(row.expires_at)}`
            : `${row.course_code} expires soon`
      }
    })()
    return {
      caregiverId: row.caregiver_id,
      firstName: row.first_name,
      lastName: row.last_name,
      context: contextStr,
    }
  }

  /** Relative date formatter — "in 3 days", "5 days ago", "today". */
  private formatRelative(iso: string): string {
    const target = new Date(iso).getTime()
    const now = Date.now()
    const diffDays = Math.round((target - now) / 86400000)
    if (diffDays === 0) return 'today'
    if (diffDays > 0) return `in ${diffDays} day${diffDays === 1 ? '' : 's'}`
    const days = Math.abs(diffDays)
    return `${days} day${days === 1 ? '' : 's'} ago`
  }

  // ---------- Status derivation ----------

  /**
   * Pure derivation. The denormalized `status` column is a hint; if it
   * disagrees with the timestamps, the timestamps win.
   */
  private deriveStatus(
    storedStatus: EnrollmentStatus,
    lastCompletedAt: string | null,
    expiresAt: string | null,
    dueAt: string | null,
    nowIso: string,
  ): EnrollmentStatus {
    // If a completion exists and the expiry is in the past, it's expired.
    if (lastCompletedAt && expiresAt && expiresAt < nowIso) return 'expired'
    // If a completion exists and expiry is in the future (or null), still completed.
    if (lastCompletedAt && (!expiresAt || expiresAt >= nowIso)) return 'completed'
    // No completion yet, but due_at has passed: overdue.
    if (!lastCompletedAt && dueAt && dueAt < nowIso) return 'overdue'
    // Otherwise fall back to the stored status (not_started or in_progress).
    if (storedStatus === 'in_progress') return 'in_progress'
    return 'not_started'
  }

  // ---------- Row mappers ----------

  private mapCourse(row: Record<string, unknown>): LearningCourse {
    return {
      id: String(row.id),
      agencyId: row.agency_id ? String(row.agency_id) : null,
      code: String(row.code),
      title: String(row.title),
      description: String(row.description ?? ''),
      cadence: row.cadence as LearningCourse['cadence'],
      expiresAfterDays: row.expires_after_days != null ? Number(row.expires_after_days) : null,
      required: Boolean(row.required),
      durationMinutes: Number(row.duration_minutes ?? 0),
      createdAt: this.toIsoString(row.created_at),
    }
  }

  private mapEnrollment(row: Record<string, unknown>): CourseEnrollment {
    return {
      id: String(row.id),
      agencyId: String(row.agency_id),
      caregiverId: String(row.caregiver_id),
      courseId: String(row.course_id),
      assignedAt: this.toIsoString(row.assigned_at),
      dueAt: row.due_at ? this.toIsoString(row.due_at) : null,
      lastCompletedAt: row.last_completed_at ? this.toIsoString(row.last_completed_at) : null,
      expiresAt: row.expires_at ? this.toIsoString(row.expires_at) : null,
      status: (row.status as EnrollmentStatus) ?? 'not_started',
    }
  }

  private mapCompletion(row: Record<string, unknown>): CourseCompletion {
    return {
      id: String(row.id),
      enrollmentId: String(row.enrollment_id),
      caregiverId: String(row.caregiver_id),
      courseId: String(row.course_id),
      completedAt: this.toIsoString(row.completed_at),
      score: row.score != null ? Number(row.score) : null,
      notes: row.notes ? String(row.notes) : null,
    }
  }

  private toIsoString(value: unknown): string {
    if (value instanceof Date) return value.toISOString()
    if (typeof value === 'string') return value
    return new Date(0).toISOString()
  }
}
