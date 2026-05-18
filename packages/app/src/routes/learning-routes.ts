/**
 * Learning Hub routes.
 *
 *   GET  /learning/dashboard              — admin rollup for the current agency
 *   GET  /learning/courses                — catalog (global + agency-specific)
 *   POST /learning/courses                — create a course (agency-scoped)
 *   GET  /learning/caregivers/:id         — per-caregiver progress detail
 *   POST /learning/enroll                 — assign a caregiver to a course
 *   POST /learning/complete               — record a completion event
 */

import { Router, type Request, type Response } from 'express'
import type { Knex } from 'knex'
import { AuditEventRepository, LearningRepository } from '@rayhealth/core'
import { requireCapability } from '../middleware/require-capability.js'

const router = Router()

function repo(req: Request): LearningRepository {
  const db = req.app.get('db') as Knex
  return new LearningRepository(db)
}

// ---------- Dashboard rollup ----------

router.get('/dashboard', requireCapability('learning.read'), async (req: Request, res: Response) => {
  try {
    const rollup = await repo(req).getAgencyRollup(req.auth.agencyId)
    res.json({ success: true, data: rollup })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unexpected error'
    res.status(500).json({ success: false, error: message })
  }
})

// ---------- Insights ----------

router.get('/insights', requireCapability('learning.read'), async (req: Request, res: Response) => {
  try {
    const envelope = await repo(req).getActionableInsights(req.auth.agencyId)
    res.json({ success: true, data: envelope })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unexpected error'
    res.status(500).json({ success: false, error: message })
  }
})

// ---------- Analytics ----------

router.get('/analytics', requireCapability('learning.read'), async (req: Request, res: Response) => {
  try {
    const envelope = await repo(req).getCourseAnalytics(req.auth.agencyId)
    res.json({ success: true, data: envelope })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unexpected error'
    res.status(500).json({ success: false, error: message })
  }
})

router.get(
  '/courses/:id/caregivers',
  requireCapability('learning.read'),
  async (req: Request, res: Response) => {
    try {
      const id = req.params.id
      if (typeof id !== 'string' || id.length === 0) {
        res.status(400).json({ success: false, error: 'course id required' })
        return
      }
      const envelope = await repo(req).getCourseCaregivers(id, req.auth.agencyId)
      if (!envelope) {
        res.status(404).json({ success: false, error: 'course not found' })
        return
      }
      res.json({ success: true, data: envelope })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unexpected error'
      res.status(500).json({ success: false, error: message })
    }
  },
)

// ---------- Catalog ----------

router.get('/courses', requireCapability('learning.read'), async (req: Request, res: Response) => {
  try {
    const courses = await repo(req).listCourses(req.auth.agencyId)
    res.json({ success: true, data: courses })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unexpected error'
    res.status(500).json({ success: false, error: message })
  }
})

router.post('/courses', requireCapability('learning.write'), async (req: Request, res: Response) => {
  try {
    const body = req.body as {
      code?: string
      title?: string
      description?: string
      cadence?: string
      expiresAfterDays?: number | null
      required?: boolean
      durationMinutes?: number
    }
    if (!body.code || !body.title || !body.cadence) {
      res.status(400).json({ success: false, error: 'code, title, cadence required' })
      return
    }
    const course = await repo(req).createCourse({
      agencyId: req.auth.agencyId,
      code: body.code,
      title: body.title,
      description: body.description ?? '',
      cadence: body.cadence as 'one_time' | 'annual' | 'biennial' | 'certification',
      expiresAfterDays: body.expiresAfterDays ?? null,
      required: body.required ?? true,
      durationMinutes: body.durationMinutes ?? 0,
    })
    res.status(201).json({ success: true, data: course })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unexpected error'
    res.status(500).json({ success: false, error: message })
  }
})

// ---------- Caregiver progress ----------

router.get(
  '/caregivers/:id',
  requireCapability('learning.read'),
  async (req: Request, res: Response) => {
    try {
      const id = req.params.id
      if (typeof id !== 'string') {
        res.status(400).json({ success: false, error: 'caregiver id required' })
        return
      }
      const progress = await repo(req).getCaregiverProgress(id)
      res.json({ success: true, data: progress })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unexpected error'
      res.status(500).json({ success: false, error: message })
    }
  },
)

// ---------- Enrollment ----------

router.post('/enroll', requireCapability('learning.write'), async (req: Request, res: Response) => {
  try {
    const body = req.body as { caregiverId?: string; courseId?: string; dueAt?: string | null }
    if (!body.caregiverId || !body.courseId) {
      res.status(400).json({ success: false, error: 'caregiverId, courseId required' })
      return
    }
    const enrollment = await repo(req).enroll({
      agencyId: req.auth.agencyId,
      caregiverId: body.caregiverId,
      courseId: body.courseId,
      dueAt: body.dueAt ?? null,
    })
    res.status(201).json({ success: true, data: enrollment })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unexpected error'
    res.status(500).json({ success: false, error: message })
  }
})

// ---------- Completion ----------

router.post('/complete', requireCapability('learning.write'), async (req: Request, res: Response) => {
  try {
    const body = req.body as {
      enrollmentId?: string
      caregiverId?: string
      courseId?: string
      completedAt?: string
      score?: number | null
      notes?: string | null
    }
    if (!body.enrollmentId || !body.caregiverId || !body.courseId) {
      res.status(400).json({ success: false, error: 'enrollmentId, caregiverId, courseId required' })
      return
    }
    // Row-level guard: caregivers can only complete their OWN training.
    // Coordinators/admins can complete on behalf of any caregiver in their agency.
    if (req.auth.role === 'caregiver' && req.auth.caregiverId !== body.caregiverId) {
      res.status(403).json({ success: false, error: 'Caregivers can only complete their own training' })
      return
    }
    const completion = await repo(req).recordCompletion({
      enrollmentId: body.enrollmentId,
      caregiverId: body.caregiverId,
      courseId: body.courseId,
      completedAt: body.completedAt ?? new Date().toISOString(),
      score: body.score ?? null,
      notes: body.notes ?? null,
    })

    // ---- Structured audit event for the completion ----
    // Distinguishes who recorded it (caregiver self-attestation via mobile vs
    // coordinator manual entry from web) so an auditor can filter.
    const db = req.app.get('db') as Knex
    const auditRepo = new AuditEventRepository(db)
    const source: 'caregiver' | 'coordinator' =
      req.auth.caregiverId === body.caregiverId ? 'caregiver' : 'coordinator'
    try {
      await auditRepo.create({
        agencyId: req.auth.agencyId,
        actorId: req.auth.userId,
        actorType: 'user',
        eventType: 'learning.course.completed',
        entityType: 'course_enrollment',
        entityId: body.enrollmentId,
        outcome: 'success',
        payload: {
          caregiverId: body.caregiverId,
          courseId: body.courseId,
          completionId: completion.id,
          score: body.score ?? null,
          source,
        },
      })
    } catch (auditErr: unknown) {
      // Audit failures must never block the user-facing operation.
      process.stderr.write(
        `[audit-write-failed] learning.course.completed enrollment=${body.enrollmentId} ` +
          `err=${auditErr instanceof Error ? auditErr.message : 'unknown'}\n`,
      )
    }

    res.status(201).json({ success: true, data: completion })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unexpected error'
    res.status(500).json({ success: false, error: message })
  }
})

export default router
