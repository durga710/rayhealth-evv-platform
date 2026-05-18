/**
 * Visit maintenance (VMUR) routes.
 *
 *   POST   /maintenance/request-unlock            — coordinator/admin files a correction
 *   POST   /maintenance/caregiver-correction      — caregiver-self-initiated correction
 *                                                   (auto-routed to coordinator review queue)
 *   POST   /maintenance/approve-unlock/:id        — coordinator/admin approves a pending
 *   POST   /maintenance/reject-unlock/:id         — coordinator/admin rejects with reason
 *   GET    /maintenance/queue                     — pending corrections for the agency
 *   GET    /maintenance/visit/:visitId            — history for a specific visit
 *
 * All writes validate against the PA DHS VMUR field requirements declared in
 * `@rayhealth/core`'s visit-maintenance domain: reason category code drawn
 * from the approved list, optional correction code, signature completeness
 * with required justification when signatures are missing.
 */

import { Router, type Request, type Response } from 'express';
import { AuditEventRepository, VisitMaintenanceRepository, visitMaintenanceSchema } from '@rayhealth/core';
import { requireCapability } from '../middleware/require-capability.js';

const router = Router();

// ----- Coordinator/admin-filed correction -----

router.post('/request-unlock', requireCapability('schedule.write'), async (req: Request, res: Response) => {
  try {
    const parsed = visitMaintenanceSchema.safeParse({
      ...req.body,
      requesterId: req.auth.userId,
      agencyId: req.auth.agencyId,
      originatorRole: req.auth.role === 'admin' ? 'admin' : 'coordinator',
      status: 'pending',
    });
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: 'VMUR payload failed validation',
        details: parsed.error.issues,
      });
      return;
    }

    const db = req.app.get('db');
    const repo = new VisitMaintenanceRepository(db);
    const maintenance = await repo.requestUnlock(parsed.data);

    await safeAudit(db, {
      agencyId: req.auth.agencyId,
      actorId: req.auth.userId,
      eventType: 'exception.filed',
      entityId: maintenance.id ?? maintenance.visitId,
      payload: {
        visitId: maintenance.visitId,
        reasonCategoryCode: maintenance.reasonCategoryCode,
        correctionCode: maintenance.correctionCode,
        originatorRole: maintenance.originatorRole,
      },
    });

    res.status(201).json({ success: true, data: maintenance });
  } catch (_error: unknown) {
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// ----- Caregiver-self-initiated correction -----

router.post(
  '/caregiver-correction',
  requireCapability('evv.write'),
  async (req: Request, res: Response) => {
    try {
      // Caregivers always file as 'pending' — coordinator reviews before
      // anything is submitted to the aggregator. Coordinator/admin who
      // hits this route is downgraded to caregiver-originator so the
      // queue knows where it came from.
      const parsed = visitMaintenanceSchema.safeParse({
        ...req.body,
        requesterId: req.auth.userId,
        agencyId: req.auth.agencyId,
        originatorRole: 'caregiver',
        status: 'pending',
      });
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: 'VMUR payload failed validation',
          details: parsed.error.issues,
        });
        return;
      }

      const db = req.app.get('db');
      const repo = new VisitMaintenanceRepository(db);
      const maintenance = await repo.requestUnlock(parsed.data);

      await safeAudit(db, {
        agencyId: req.auth.agencyId,
        actorId: req.auth.userId,
        eventType: 'exception.filed',
        entityId: maintenance.id ?? maintenance.visitId,
        payload: {
          visitId: maintenance.visitId,
          reasonCategoryCode: maintenance.reasonCategoryCode,
          correctionCode: maintenance.correctionCode,
          originatorRole: 'caregiver',
          caregiverSignaturePresent: maintenance.caregiverSignaturePresent,
          clientSignaturePresent: maintenance.clientSignaturePresent,
        },
      });

      res.status(201).json({ success: true, data: maintenance });
    } catch (_error: unknown) {
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  },
);

// ----- Approve -----

router.post(
  '/approve-unlock/:id',
  requireCapability('schedule.write'),
  async (req: Request, res: Response) => {
    try {
      const idParam = req.params.id;
      const id: string = typeof idParam === 'string' ? idParam : (idParam[0] ?? '');
      if (!id) {
        res.status(400).json({ success: false, error: 'id required' });
        return;
      }
      const body = req.body as {
        adjustedStartTime?: string;
        adjustedEndTime?: string;
      };
      const db = req.app.get('db');
      const repo = new VisitMaintenanceRepository(db);
      const maintenance = await repo.approveUnlock(id, {
        adjustedStartTime: body.adjustedStartTime,
        adjustedEndTime: body.adjustedEndTime,
        approverId: req.auth.userId,
      });
      if (!maintenance) {
        res.status(404).json({ success: false, error: 'Unlock request not found' });
        return;
      }

      await safeAudit(db, {
        agencyId: req.auth.agencyId,
        actorId: req.auth.userId,
        eventType: 'exception.approved',
        entityId: id,
        payload: {
          visitId: maintenance.visitId,
          adjustedStartTime: maintenance.adjustedStartTime,
          adjustedEndTime: maintenance.adjustedEndTime,
        },
      });

      res.json({ success: true, data: maintenance });
    } catch (_error: unknown) {
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  },
);

// ----- Reject -----

router.post(
  '/reject-unlock/:id',
  requireCapability('schedule.write'),
  async (req: Request, res: Response) => {
    try {
      const idParam = req.params.id;
      const id: string = typeof idParam === 'string' ? idParam : (idParam[0] ?? '');
      if (!id) {
        res.status(400).json({ success: false, error: 'id required' });
        return;
      }
      const reason = ((req.body as { reason?: string }).reason ?? '').trim();
      if (!reason) {
        res.status(400).json({ success: false, error: 'reason required for rejection' });
        return;
      }
      const db = req.app.get('db');
      const repo = new VisitMaintenanceRepository(db);
      const maintenance = await repo.rejectUnlock(id, {
        approverId: req.auth.userId,
        reason,
      });
      if (!maintenance) {
        res.status(404).json({ success: false, error: 'Unlock request not found' });
        return;
      }

      await safeAudit(db, {
        agencyId: req.auth.agencyId,
        actorId: req.auth.userId,
        eventType: 'exception.rejected',
        entityId: id,
        // outcome=success because the rejection itself was processed
        // successfully; the rejected subject is the maintenance request.
        outcome: 'success',
        payload: { reason },
      });

      res.json({ success: true, data: maintenance });
    } catch (_error: unknown) {
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  },
);

// ----- Queue (pending) -----

router.get('/queue', requireCapability('schedule.read'), async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db');
    const repo = new VisitMaintenanceRepository(db);
    const items = await repo.listPendingForAgency(req.auth.agencyId);
    res.json({ success: true, data: items });
  } catch (_error: unknown) {
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// ----- Full history (tracking page) -----

const ALLOWED_STATUS = new Set(['pending', 'approved', 'rejected']);
const ALLOWED_ORIGINATOR = new Set(['caregiver', 'coordinator', 'admin']);
const ALLOWED_REASON = new Set([
  'MTLB', 'DCDB', 'MFLB', 'MFLA', 'ACLN', 'ATGL',
  'AGRS', 'WKAP', 'CNCL', 'HOLI', 'WKLI', 'OTHR',
]);

router.get('/history', requireCapability('schedule.read'), async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db');
    const repo = new VisitMaintenanceRepository(db);

    // Whitelist filters before passing to the repo — `req.query` is untrusted
    // and the repo builds raw `where` clauses with the values.
    const rawStatus = typeof req.query.status === 'string' ? req.query.status : undefined;
    const rawOriginator = typeof req.query.originator === 'string' ? req.query.originator : undefined;
    const rawReason = typeof req.query.reasonCode === 'string' ? req.query.reasonCode : undefined;
    const rawLimit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;

    const items = await repo.listForAgency(req.auth.agencyId, {
      status: rawStatus && ALLOWED_STATUS.has(rawStatus)
        ? (rawStatus as 'pending' | 'approved' | 'rejected')
        : undefined,
      originatorRole: rawOriginator && ALLOWED_ORIGINATOR.has(rawOriginator)
        ? (rawOriginator as 'caregiver' | 'coordinator' | 'admin')
        : undefined,
      reasonCategoryCode: rawReason && ALLOWED_REASON.has(rawReason) ? rawReason : undefined,
      limit: Number.isFinite(rawLimit) && rawLimit !== undefined && rawLimit > 0
        ? Math.min(rawLimit, 500)
        : undefined,
    });
    res.json({ success: true, data: items });
  } catch (_error: unknown) {
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// ----- Per-visit history -----

router.get(
  '/visit/:visitId',
  requireCapability('schedule.read'),
  async (req: Request, res: Response) => {
    try {
      const db = req.app.get('db');
      const repo = new VisitMaintenanceRepository(db);
      const visitParam = req.params.visitId;
      const visitId: string = typeof visitParam === 'string' ? visitParam : (visitParam[0] ?? '');
      const items = await repo.listForVisit(visitId);
      res.json({ success: true, data: items });
    } catch (_error: unknown) {
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  },
);

// ----- Helpers -----

interface AuditPayload {
  agencyId: string;
  actorId: string;
  eventType: 'exception.filed' | 'exception.approved' | 'exception.rejected';
  entityId: string;
  payload: Record<string, unknown>;
  outcome?: 'success' | 'failure' | 'denied';
}

async function safeAudit(db: unknown, event: AuditPayload): Promise<void> {
  try {
    const repo = new AuditEventRepository(
      db as ConstructorParameters<typeof AuditEventRepository>[0],
    );
    await repo.create({
      agencyId: event.agencyId,
      actorId: event.actorId,
      actorType: 'user',
      eventType: event.eventType,
      entityType: 'visit_maintenance',
      entityId: event.entityId,
      outcome: event.outcome ?? 'success',
      payload: event.payload,
    });
  } catch (auditErr: unknown) {
    process.stderr.write(
      `[audit-write-failed] ${event.eventType} err=${auditErr instanceof Error ? auditErr.message : 'unknown'}\n`,
    );
  }
}

export default router;
