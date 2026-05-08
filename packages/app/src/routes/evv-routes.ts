import { Router } from 'express';
import { requireCapability } from '../middleware/require-capability.js';
import { EvvRepository } from '@rayhealth/core';

const router = Router();

router.get('/visits', requireCapability('schedule.read'), async (req, res) => {
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

router.post('/clock-in', requireCapability('schedule.write'), async (req, res) => {
  try {
    if (!req.auth.caregiverId) return res.status(403).json({ message: 'User is not authorized as a caregiver' });
    const db = req.app.get('db');
    const repo = new EvvRepository(db);
    const visit = await repo.createVisit({
      assignmentId: req.body.assignmentId,
      caregiverId: req.auth.caregiverId,
      clockInTime: new Date().toISOString(),
      clockInLocation: req.body.location,
      status: 'pending'
    });
    res.status(201).json(visit);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.post('/clock-out/:id', requireCapability('schedule.write'), async (req, res) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
    const db = req.app.get('db');
    const repo = new EvvRepository(db);
    const visit = await repo.updateVisit(id, {
      clockOutTime: new Date().toISOString(),
      clockOutLocation: req.body.location,
      status: 'verified'
    });
    if (!visit) return res.status(404).json({ message: 'Visit not found' });
    res.json(visit);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;