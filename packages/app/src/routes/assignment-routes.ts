import { Router, type Request, type Response } from 'express';
import {
  AuditEventRepository,
  LearningRepository,
  ScheduleRepository,
  assignmentInputSchema,
} from '@rayhealth/core';
import type { Knex } from 'knex';
import { requireCapability } from '../middleware/require-capability.js';

const router = Router();

router.get(
  '/compliance-check/:caregiverId',
  requireCapability('schedule.read'),
  async (req: Request, res: Response) => {
    try {
      const caregiverId = req.params.caregiverId;
      if (typeof caregiverId !== 'string' || caregiverId.length === 0) {
        res.status(400).json({ success: false, error: 'caregiverId required' });
        return;
      }
      const db = req.app.get('db') as Knex;
      const learning = new LearningRepository(db);
      const result = await learning.getAssignmentBlockers(caregiverId);
      res.json({ success: true, data: result });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unexpected error';
      res.status(500).json({ success: false, error: message });
    }
  },
);

router.get('/caregiver', requireCapability('schedule.read'), async (req: Request, res: Response) => {
  try {
    if (!req.auth.caregiverId) {
      res.status(403).json({ message: 'User is not authorized as a caregiver' });
      return;
    }
    const db = req.app.get('db') as Knex;
    const repo = new ScheduleRepository(db);
    const assignments = await repo.getAssignmentsByCaregiver(req.auth.caregiverId);
    res.json(assignments);
  } catch (error: unknown) {
    process.stderr.write(`Failed to get caregiver assignments: ${error instanceof Error ? error.message : 'unexpected'}\n`);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.post('/', requireCapability('schedule.write'), async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db') as Knex | undefined;
    if (!db) {
      res.status(500).json({ message: 'Database connection missing' });
      return;
    }
    const repo = new ScheduleRepository(db);

    const assignmentInput = {
      caregiverId: req.body.caregiverId,
      visitTemplateId: req.body.visitTemplateId,
      credentialStatus: 'active' as const
    };
    const parsed = assignmentInputSchema.safeParse(assignmentInput);
    if (!parsed.success) {
      res.status(400).json({ message: 'caregiverId and visitTemplateId are required to create an assignment' });
      return;
    }

    // ---- Learning compliance gate ----
    // Coordinators can override with { force: true, overrideReason: "..." } in
    // the request body. Override writes a stderr audit log entry — production
    // should swap this for the structured AuditEventRepository.
    const force: boolean = Boolean(req.body.force);
    const overrideReason: string = typeof req.body.overrideReason === 'string' ? req.body.overrideReason : '';

    const learning = new LearningRepository(db);
    const compliance = await learning.getAssignmentBlockers(parsed.data.caregiverId);
    if (!compliance.compliant && !force) {
      res.status(422).json({
        code: 'CAREGIVER_NOT_COMPLIANT',
        message: 'Caregiver has uncompleted required training. Resolve blockers before assigning, or pass { force: true, overrideReason: "..." } to override.',
        blockers: compliance.blockers,
      });
      return;
    }
    const assignment = await repo.createAssignment(parsed.data);

    // After the assignment lands, persist a structured override audit event if
    // the gate was bypassed. The event_type 'learning.override' is filterable
    // by auditors; entity_id is the new assignment id so the audit row links
    // back to the visit.
    if (!compliance.compliant && force) {
      const auditRepo = new AuditEventRepository(db);
      try {
        await auditRepo.create({
          agencyId: req.auth.agencyId,
          actorId: req.auth.userId,
          actorType: 'user',
          eventType: 'learning.override',
          entityType: 'assignment',
          entityId: assignment.id,
          outcome: 'success',
          payload: {
            caregiverId: parsed.data.caregiverId,
            blockerCount: compliance.blockers.length,
            blockers: compliance.blockers.map((b) => ({
              courseCode: b.courseCode,
              status: b.status,
            })),
            reason: overrideReason || 'no reason given',
          },
        });
      } catch (auditErr: unknown) {
        // Audit failures must never block the underlying operation, but they
        // must be visible. Stderr is the fallback when the audit table itself
        // is unreachable.
        process.stderr.write(
          `[audit-write-failed] learning.override caregiver=${parsed.data.caregiverId} ` +
            `assignment=${assignment.id} err=${auditErr instanceof Error ? auditErr.message : 'unknown'}\n`,
        );
      }
    }

    res.status(201).json({ ...assignment, visitDate: req.body.visitDate });
  } catch (error: unknown) {
    process.stderr.write(`Assignment creation failed: ${error instanceof Error ? error.message : 'unexpected'}\n`);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.get('/', requireCapability('schedule.read'), async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db') as Knex;
    const repo = new ScheduleRepository(db);
    const assignments = await repo.getAssignments(req.auth.agencyId);
    res.json(assignments);
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;
