/**
 * Learning domain — caregiver training catalog, enrollments, completions.
 *
 * Designed around PA personal-care training requirements (PA Code §52.18 et seq.):
 *   - One-time orientation before first visit
 *   - Annual recurring training (12 hours/year minimum)
 *   - Recertifications with explicit expiry (CPR, first-aid)
 *
 * Compliance posture:
 *   - course_completions is an append-only event log — never updated
 *   - course_enrollments tracks current state (due dates, expiry)
 *   - The pair lets us reconstruct who knew what when, for audit purposes
 */

export type CourseCadence = 'one_time' | 'annual' | 'biennial' | 'certification'

export type EnrollmentStatus =
  | 'not_started' // assigned, no completion yet, not yet overdue
  | 'in_progress' // started, not finished, not yet overdue
  | 'completed' // most recent completion is current
  | 'overdue' // due_at has passed, not completed
  | 'expired' // was completed, but the completion has aged out

export interface LearningCourse {
  id: string
  agencyId: string | null // null = global course (shared across agencies)
  code: string // stable identifier like 'HIPAA-2026'
  title: string
  description: string
  cadence: CourseCadence
  /** How many days after completion the certification expires. null = never. */
  expiresAfterDays: number | null
  /** Required for compliance (true) vs elective (false). */
  required: boolean
  /** Estimated minutes the caregiver needs to complete it. */
  durationMinutes: number
  createdAt: string
}

export interface NewLearningCourse {
  agencyId: string | null
  code: string
  title: string
  description: string
  cadence: CourseCadence
  expiresAfterDays: number | null
  required: boolean
  durationMinutes: number
}

export interface CourseEnrollment {
  id: string
  agencyId: string
  caregiverId: string
  courseId: string
  assignedAt: string
  dueAt: string | null
  /** Set when a completion is recorded; updated to most recent completion. */
  lastCompletedAt: string | null
  /** Calculated from lastCompletedAt + course.expiresAfterDays. */
  expiresAt: string | null
  status: EnrollmentStatus
}

export interface NewCourseEnrollment {
  agencyId: string
  caregiverId: string
  courseId: string
  dueAt: string | null
}

export interface CourseCompletion {
  id: string
  enrollmentId: string
  caregiverId: string
  courseId: string
  completedAt: string
  /** 0–100 if the course has a quiz; null otherwise. */
  score: number | null
  /** Free-text notes from caregiver or coordinator (e.g. "completed via in-person training"). */
  notes: string | null
}

export interface NewCourseCompletion {
  enrollmentId: string
  caregiverId: string
  courseId: string
  completedAt: string
  score: number | null
  notes: string | null
}

// ----- Aggregate views -----

/**
 * Org-level rollup for the Learning Hub dashboard.
 * Cell counts: how many enrollments are in each status across the agency.
 */
export interface LearningAgencyRollup {
  totalCaregivers: number
  totalEnrollments: number
  notStarted: number
  inProgress: number
  completed: number
  overdue: number
  expired: number
  /** Coverage = completed / required-enrollments. 0–1. */
  complianceRate: number
}

/**
 * Per-caregiver progress, for the caregiver detail page.
 */
export interface CaregiverLearningProgress {
  caregiverId: string
  enrollments: Array<{
    enrollment: CourseEnrollment
    course: LearningCourse
  }>
  /** True if every required enrollment is currently `completed`. */
  isCompliant: boolean
}

// ----- Actionable insights -----
//
// These are the "AI-flavored" signals the Learning Hub surfaces to coordinators.
// The intelligence is in the prioritization and natural-language framing, not in
// a model call — keeps compliance audit trail clean (deterministic SQL).

export type InsightSeverity = 'critical' | 'warning' | 'info'

export interface InsightCaregiver {
  caregiverId: string
  firstName: string
  lastName: string
  /** Brief context per caregiver, e.g. "HIPAA-2026 due in 3 days". */
  context: string
}

export interface LearningInsight {
  /** Stable identifier so the UI can render specific icons / actions per type. */
  kind:
    | 'due_in_7_days'
    | 'expired_recently'
    | 'orientation_incomplete'
    | 'stalled_enrollment'
    | 'certification_expiring_soon'
  severity: InsightSeverity
  /** Headline shown on the card. */
  title: string
  /** Plain-English summary — what's happening and why it matters. */
  summary: string
  /** Button label on the card. */
  actionLabel: string
  /** Up to 10 caregivers per card; total count is separate. */
  caregivers: InsightCaregiver[]
  /** Total count even when caregivers list is truncated to 10. */
  totalCount: number
}

export interface LearningInsightsEnvelope {
  generatedAt: string
  insights: LearningInsight[]
}

// ----- Assignment compliance gate -----
//
// Used by the scheduling layer to decide whether a caregiver can be put on a
// new visit. Semantically: if the caregiver has assigned-but-not-completed
// required training, that's a blocker. Caregivers with NO enrollments at all
// pass (the agency hasn't set up training yet — not our place to block).

export interface AssignmentBlocker {
  enrollmentId: string
  courseCode: string
  courseTitle: string
  status: EnrollmentStatus
  reason: string
}

export interface AssignmentComplianceCheck {
  compliant: boolean
  blockers: AssignmentBlocker[]
}

// ----- Course analytics -----
//
// Per-course rollup powering the Learning Analytics page. One row per
// course in the agency catalog (including global courses). The math is
// computed at query time — no analytics tables, no async job, no staleness.

export interface CourseAnalyticsRow {
  courseId: string
  courseCode: string
  courseTitle: string
  required: boolean
  cadence: CourseCadence
  /** All-time enrollments. */
  totalEnrollments: number
  /** Enrollments where most recent completion is current (not expired). */
  completedCount: number
  overdueCount: number
  expiredCount: number
  /** notStarted + inProgress: assigned but not yet completed. */
  pendingCount: number
  /** completedCount / totalEnrollments, 0..1. 0 if no enrollments. */
  completionRate: number
  /** Average days between assigned_at and last_completed_at, for completed enrollments. null if no completions. */
  averageDaysToComplete: number | null
}

export interface CourseAnalyticsEnvelope {
  generatedAt: string
  rows: CourseAnalyticsRow[]
}

// ----- Per-course caregiver drill-down -----

export interface CourseCaregiverRow {
  enrollment: CourseEnrollment
  caregiver: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
  /** Effective status, re-derived against `now`. */
  effectiveStatus: EnrollmentStatus
}

export interface CourseCaregiverEnvelope {
  course: LearningCourse
  caregivers: CourseCaregiverRow[]
}
