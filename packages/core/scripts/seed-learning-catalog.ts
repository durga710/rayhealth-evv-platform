#!/usr/bin/env tsx
/**
 * seed-learning-catalog.ts
 *
 * Idempotent seed of the baseline PA personal-care training catalog as
 * GLOBAL courses (agency_id = NULL) — every agency on the platform gets these
 * available out of the box. Agency-specific courses can be added on top.
 *
 * Run:
 *   DATABASE_URL=postgres://... npx tsx packages/core/scripts/seed-learning-catalog.ts
 *
 * Safe to re-run. Uses upsert by (agency_id, code).
 *
 * Compliance basis: PA Code §52.18 (Annual Caregiver Training) — 12 hours per
 * year of continuing education for personal care attendants. Required orientation
 * before first client contact per §52.18(a). HIPAA training mandated by
 * agency BAA obligations under 45 CFR §164.530(b).
 */

import { createDb, LearningRepository, type NewLearningCourse } from '../src/index.js'

const CATALOG: NewLearningCourse[] = [
  {
    agencyId: null,
    code: 'ORIENT-2026',
    title: 'New caregiver orientation',
    description:
      'Mandatory orientation before first client contact. Covers agency policies, ' +
      'caregiver code of conduct, emergency contact procedures, and basic ' +
      'expectations.',
    cadence: 'one_time',
    expiresAfterDays: null,
    required: true,
    durationMinutes: 90,
  },
  {
    agencyId: null,
    code: 'HIPAA-2026',
    title: 'HIPAA Privacy & Security — annual refresh',
    description:
      'Annual training on protected health information handling, the minimum ' +
      'necessary rule, and incident reporting. Required by 45 CFR §164.530(b).',
    cadence: 'annual',
    expiresAfterDays: 365,
    required: true,
    durationMinutes: 45,
  },
  {
    agencyId: null,
    code: 'ABUSE-2026',
    title: 'Abuse, neglect, and exploitation reporting',
    description:
      'Recognizing and reporting elder abuse, financial exploitation, and ' +
      'neglect. Includes mandated-reporter obligations under PA law.',
    cadence: 'annual',
    expiresAfterDays: 365,
    required: true,
    durationMinutes: 60,
  },
  {
    agencyId: null,
    code: 'INFECT-2026',
    title: 'Infection control & standard precautions',
    description:
      'Hand hygiene, PPE use, sharps handling, and post-exposure protocols. ' +
      'Covers bloodborne pathogens per OSHA 29 CFR §1910.1030.',
    cadence: 'annual',
    expiresAfterDays: 365,
    required: true,
    durationMinutes: 45,
  },
  {
    agencyId: null,
    code: 'DEMENTIA-101',
    title: 'Dementia care basics',
    description:
      'Communication strategies, behavioral expressions of unmet need, and ' +
      'safe redirection for clients living with Alzheimer\'s and related ' +
      'dementias.',
    cadence: 'annual',
    expiresAfterDays: 365,
    required: true,
    durationMinutes: 60,
  },
  {
    agencyId: null,
    code: 'FALLPREV-2026',
    title: 'Fall prevention in the home',
    description:
      'Identifying fall risk factors, home safety assessment, transfer ' +
      'techniques, and what to do after a fall.',
    cadence: 'annual',
    expiresAfterDays: 365,
    required: true,
    durationMinutes: 45,
  },
  {
    agencyId: null,
    code: 'BODYMECH-2026',
    title: 'Body mechanics & safe lifting',
    description:
      'Protecting yourself and your client during transfers, repositioning, ' +
      'and ambulation. Includes use of gait belts and mechanical lifts.',
    cadence: 'annual',
    expiresAfterDays: 365,
    required: true,
    durationMinutes: 45,
  },
  {
    agencyId: null,
    code: 'CPR-FIRSTAID',
    title: 'CPR + first aid certification',
    description:
      'External certification via American Heart Association or Red Cross. ' +
      'Track expiry; recertify every 2 years.',
    cadence: 'certification',
    expiresAfterDays: 730,
    required: true,
    durationMinutes: 240,
  },
]

async function main(): Promise<void> {
  const db = createDb()
  const repo = new LearningRepository(db)
  try {
    const results: Array<{ code: string; status: 'created' | 'exists' }> = []
    for (const course of CATALOG) {
      const existing = await repo.findCourseByCode(course.agencyId, course.code)
      if (existing) {
        results.push({ code: course.code, status: 'exists' })
        continue
      }
      await repo.createCourse(course)
      results.push({ code: course.code, status: 'created' })
    }
    process.stdout.write(JSON.stringify({ ok: true, results }, null, 2) + '\n')
  } finally {
    await db.destroy()
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unexpected error'
  process.stderr.write(`seed-learning-catalog: ${message}\n`)
  process.exit(1)
})
