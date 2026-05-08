import { Router } from 'express';
import { requireCapability } from '../middleware/require-capability.js';
import { ScheduleRepository } from '@rayhealth/core';
const router = Router();
router.post('/', requireCapability('schedule.write'), async (req, res) => {
    try {
        const db = req.app.get('db');
        const repo = new ScheduleRepository(db);
        // Fallback visitTemplateId if not sent by UI (to make UI functional without a dropdown initially)
        // Normally UI must send visitTemplateId 
        const assignmentInput = {
            caregiverId: req.body.caregiverId,
            visitTemplateId: req.body.visitTemplateId || '00000000-0000-0000-0000-000000000000',
            credentialStatus: 'active'
        };
        const assignment = await repo.createAssignment(assignmentInput);
        res.status(201).json({ ...assignment, visitDate: req.body.visitDate });
    }
    catch (error) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
router.get('/', requireCapability('schedule.read'), async (req, res) => {
    try {
        const db = req.app.get('db');
        const repo = new ScheduleRepository(db);
        const assignments = await repo.getAssignments(req.auth.agencyId);
        res.json(assignments);
    }
    catch (error) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
export default router;
//# sourceMappingURL=assignment-routes.js.map