import { Router } from 'express';
import { requireCapability } from '../middleware/require-capability.js';
import {
  EvvRepository,
  ScheduleRepository,
  evaluateLocationIntegrity,
  evvClockInInputSchema,
  evvClockOutInputSchema,
  evvVisitIdSchema
} from '@rayhealth/core';

const router = Router();

/**
 * In production we hard-reject readings from the iOS Simulator. The env flag
 * `EVV_ALLOW_SIMULATOR=1` downgrades that to "suspect" so the team can dev
 * locally without a physical device.
 */
const rejectSimulator = process.env.EVV_ALLOW_SIMULATOR !== '1';

router.get('/visits', requireCapability('evv.read'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const repo = new EvvRepository(db);
    // In a real implementation, you'd filter by agencyId from req.auth.agencyId
    const visits = await repo.getAllVisits();
    res.json(visits);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.post('/clock-in', requireCapability('evv.write'), async (req, res) => {
  try {
    if (!req.auth.caregiverId) return res.status(403).json({ message: 'User is not authorized as a caregiver' });

    const parsed = evvClockInInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'A valid assignmentId and GPS location are required for EVV clock-in' });
    }

    const integrity = evaluateLocationIntegrity(parsed.data.location, { rejectSimulator });
    if (integrity.verdict === 'rejected') {
      return res.status(422).json({
        code: 'LOCATION_INTEGRITY_REJECTED',
        message: 'GPS reading rejected as mock or simulated location',
        reasons: integrity.reasons
      });
    }

    const db = req.app.get('db');
    const scheduleRepo = new ScheduleRepository(db);
    const assignment = await scheduleRepo.getAssignmentForCaregiver(parsed.data.assignmentId, req.auth.caregiverId);
    if (!assignment) return res.status(404).json({ message: 'Assigned visit not found for this caregiver' });

    const repo = new EvvRepository(db);
    const visit = await repo.createVisit({
      assignmentId: parsed.data.assignmentId,
      caregiverId: req.auth.caregiverId,
      clockInTime: new Date().toISOString(),
      clockInLocation: parsed.data.location,
      status: integrity.verdict === 'suspect' ? 'flagged' : 'pending'
    });

    if (integrity.verdict === 'suspect') {
      res.setHeader('X-RayHealth-Visit-Flagged', integrity.reasons.join(','));
    }

    res.status(201).json(visit);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.post('/clock-out/:id', requireCapability('evv.write'), async (req, res) => {
  try {
    if (!req.auth.caregiverId) return res.status(403).json({ message: 'User is not authorized as a caregiver' });

    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
    const parsedId = evvVisitIdSchema.safeParse(id);
    if (!parsedId.success) return res.status(400).json({ message: 'A valid visit id is required for EVV clock-out' });

    const parsed = evvClockOutInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'A valid GPS location is required for EVV clock-out' });
    }

    const integrity = evaluateLocationIntegrity(parsed.data.location, { rejectSimulator });
    if (integrity.verdict === 'rejected') {
      return res.status(422).json({
        code: 'LOCATION_INTEGRITY_REJECTED',
        message: 'GPS reading rejected as mock or simulated location',
        reasons: integrity.reasons
      });
    }

    const db = req.app.get('db');
    const repo = new EvvRepository(db);
    const existingVisit = await repo.getVisitById(parsedId.data);
    if (!existingVisit || existingVisit.caregiverId !== req.auth.caregiverId) {
      return res.status(404).json({ message: 'Visit not found' });
    }

    const visit = await repo.updateVisit(id, {
      clockOutTime: new Date().toISOString(),
      clockOutLocation: parsed.data.location,
      status: integrity.verdict === 'suspect' ? 'flagged' : 'verified'
    });
    if (!visit) return res.status(404).json({ message: 'Visit not found' });

    if (integrity.verdict === 'suspect') {
      res.setHeader('X-RayHealth-Visit-Flagged', integrity.reasons.join(','));
    }

    res.json(visit);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;
