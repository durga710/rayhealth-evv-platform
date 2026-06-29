import { Router } from 'express';
import { requireCapability } from '../middleware/require-capability.js';
import { ScheduleRepository } from '@rayhealth/core';
const router = Router();
router.post('/', requireCapability('schedule.write'), async (req, res) => {
    try {
        const db = req.app.get('db');
        const repo = new ScheduleRepository(db);
        const template = await repo.createTemplate(req.body);
        res.status(201).json(template);
    }
    catch (error) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
router.get('/', requireCapability('schedule.read'), async (req, res) => {
    try {
        const db = req.app.get('db');
        const repo = new ScheduleRepository(db);
        const templates = await repo.getTemplates(req.auth.agencyId);
        res.json(templates);
    }
    catch (error) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
router.put('/:id', requireCapability('schedule.write'), async (req, res) => {
    const { name, tasks } = req.body ?? {};
    if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
        res.status(400).json({ message: 'name must be a non-empty string' });
        return;
    }
    if (tasks !== undefined && !Array.isArray(tasks)) {
        res.status(400).json({ message: 'tasks must be an array' });
        return;
    }
    try {
        const db = req.app.get('db');
        const repo = new ScheduleRepository(db);
        const patch = {};
        if (name !== undefined)
            patch.name = name;
        if (tasks !== undefined)
            patch.tasks = tasks;
        const updated = await repo.updateTemplate(String(req.params.id), req.auth.agencyId, patch);
        if (!updated) {
            res.status(404).json({ message: 'Template not found' });
            return;
        }
        res.json(updated);
    }
    catch (error) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
router.delete('/:id', requireCapability('schedule.write'), async (req, res) => {
    try {
        const db = req.app.get('db');
        const repo = new ScheduleRepository(db);
        const result = await repo.deleteTemplate(String(req.params.id), req.auth.agencyId);
        if (result === 'not_found') {
            res.status(404).json({ message: 'Template not found' });
            return;
        }
        if (result === 'has_dependencies') {
            res.status(409).json({
                message: 'This template is used by one or more assignments. Remove those first.',
                code: 'HAS_DEPENDENCIES',
            });
            return;
        }
        res.status(204).end();
    }
    catch (error) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
export default router;
//# sourceMappingURL=template-routes.js.map