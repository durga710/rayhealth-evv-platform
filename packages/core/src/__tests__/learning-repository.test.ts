import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb } from '../db/knex.js'
import * as schema from '../migrations/schema.js'
import * as learningMigration from '../migrations/2026-05-11-add-learning.js'
import { LearningRepository } from '../repositories/learning-repository.js'

/**
 * Auto-skip when no Postgres is reachable. Matches the existing repo test pattern
 * used by session-repository.test.ts and audit-retention-sweep.test.ts.
 */

const AGENCY_ID = '00000000-0000-4000-8000-bbbbbbbbbbbb'

let dbAvailable = false
const db = createDb()

beforeAll(async () => {
  try {
    await schema.up(db)
    await learningMigration.up(db)
    await db.raw('select 1')
    dbAvailable = true
  } catch {
    console.warn('Skipping LearningRepository tests - no DB connection or migration')
  }
})

afterAll(async () => {
  await db.destroy().catch(() => { /* already torn down */ })
})

async function ensureAgency(): Promise<void> {
  const exists = await db('agencies').where({ id: AGENCY_ID }).first()
  if (!exists) {
    await db('agencies').insert({
      id: AGENCY_ID,
      name: 'TEST Learning Agency',
      state: 'PA',
      operating_tracks: JSON.stringify(['personal_care']),
    })
  }
}

async function clearLearning(): Promise<void> {
  await db('course_completions').del()
  await db('course_enrollments').del()
  await db('learning_courses').where('agency_id', AGENCY_ID).del()
}

describe('LearningRepository', () => {
  it('creates courses and upserts idempotently', async () => {
    if (!dbAvailable) return
    await ensureAgency()
    await clearLearning()
    const repo = new LearningRepository(db)

    const first = await repo.upsertCourseByCode({
      agencyId: AGENCY_ID,
      code: 'TEST-001',
      title: 'Test course',
      description: 'A test',
      cadence: 'annual',
      expiresAfterDays: 365,
      required: true,
      durationMinutes: 30,
    })
    const second = await repo.upsertCourseByCode({
      agencyId: AGENCY_ID,
      code: 'TEST-001',
      title: 'Different title — should NOT overwrite',
      description: 'changed',
      cadence: 'annual',
      expiresAfterDays: 365,
      required: true,
      durationMinutes: 30,
    })

    expect(second.id).toBe(first.id)
    expect(second.title).toBe('Test course') // upsert preserves existing
  })

  it('rolls up agency status correctly across mixed enrollment states', async () => {
    if (!dbAvailable) return
    await ensureAgency()
    await clearLearning()
    const repo = new LearningRepository(db)

    // 3 active caregivers
    const caregiverIds = [
      '00000000-0000-4000-8000-cccccccccccc',
      '00000000-0000-4000-8000-dddddddddddd',
      '00000000-0000-4000-8000-eeeeeeeeeeee',
    ]
    for (const id of caregiverIds) {
      const existing = await db('caregivers').where({ id }).first()
      if (!existing) {
        await db('caregivers').insert({
          id,
          agency_id: AGENCY_ID,
          first_name: 'TEST',
          last_name: id.slice(-4),
          email: `test-${id.slice(-4)}@rayhealthevv.local`,
          status: 'active',
        })
      }
    }

    const course = await repo.createCourse({
      agencyId: AGENCY_ID,
      code: 'TEST-ROLLUP',
      title: 'Rollup test course',
      description: '',
      cadence: 'annual',
      expiresAfterDays: 365,
      required: true,
      durationMinutes: 30,
    })

    // Caregiver 1: completed, current
    const e1 = await repo.enroll({
      agencyId: AGENCY_ID,
      caregiverId: caregiverIds[0],
      courseId: course.id,
      dueAt: null,
    })
    await repo.recordCompletion({
      enrollmentId: e1.id,
      caregiverId: caregiverIds[0],
      courseId: course.id,
      completedAt: new Date().toISOString(),
      score: 95,
      notes: null,
    })

    // Caregiver 2: overdue (assigned with past due date, never completed)
    const pastDue = new Date(Date.now() - 7 * 86400000).toISOString()
    await repo.enroll({
      agencyId: AGENCY_ID,
      caregiverId: caregiverIds[1],
      courseId: course.id,
      dueAt: pastDue,
    })

    // Caregiver 3: not_started
    await repo.enroll({
      agencyId: AGENCY_ID,
      caregiverId: caregiverIds[2],
      courseId: course.id,
      dueAt: null,
    })

    const rollup = await repo.getAgencyRollup(AGENCY_ID)
    expect(rollup.totalCaregivers).toBeGreaterThanOrEqual(3)
    expect(rollup.totalEnrollments).toBe(3)
    expect(rollup.completed).toBe(1)
    expect(rollup.overdue).toBe(1)
    expect(rollup.notStarted).toBe(1)
  })

  it('marks completion as expired when expires_after_days has elapsed', async () => {
    if (!dbAvailable) return
    await ensureAgency()
    await clearLearning()
    const repo = new LearningRepository(db)

    const caregiverId = '00000000-0000-4000-8000-ffffffffffff'
    const existing = await db('caregivers').where({ id: caregiverId }).first()
    if (!existing) {
      await db('caregivers').insert({
        id: caregiverId,
        agency_id: AGENCY_ID,
        first_name: 'TEST',
        last_name: 'Expired',
        email: 'test-expired@rayhealthevv.local',
        status: 'active',
      })
    }

    const course = await repo.createCourse({
      agencyId: AGENCY_ID,
      code: 'TEST-EXPIRE',
      title: 'Expiring course',
      description: '',
      cadence: 'annual',
      expiresAfterDays: 365,
      required: true,
      durationMinutes: 30,
    })

    const enrollment = await repo.enroll({
      agencyId: AGENCY_ID,
      caregiverId,
      courseId: course.id,
      dueAt: null,
    })

    // Complete it 400 days ago
    const longAgo = new Date(Date.now() - 400 * 86400000).toISOString()
    await repo.recordCompletion({
      enrollmentId: enrollment.id,
      caregiverId,
      courseId: course.id,
      completedAt: longAgo,
      score: null,
      notes: null,
    })

    const progress = await repo.getCaregiverProgress(caregiverId)
    const entry = progress.enrollments.find((e) => e.course.id === course.id)
    expect(entry?.enrollment.status).toBe('expired')
    expect(progress.isCompliant).toBe(false)
  })
})
