import { Router } from 'express';
import { requireCapability } from '../middleware/require-capability.js';
import { ClientRepository, clientSchema } from '@rayhealth/core';
const router = Router();
router.post('/', requireCapability('client.write'), async (req, res) => {
    // Validate before touching the DB. Previously req.body was inserted verbatim,
    // so a bad date / out-of-range coordinate surfaced only as an opaque 500.
    const parsed = clientSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            message: 'Invalid client',
            issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        });
        return;
    }
    try {
        const db = req.app.get('db');
        const repo = new ClientRepository(db);
        const client = await repo.createClient(req.auth.agencyId, parsed.data);
        res.status(201).json(client);
    }
    catch (error) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
router.get('/', requireCapability('client.read'), async (req, res) => {
    try {
        const db = req.app.get('db');
        const repo = new ClientRepository(db);
        // Family-role users can only see clients with an approved row in
        // family_relationships. Admin / coordinator continue to see agency scope.
        const clients = req.auth.role === 'family'
            ? await repo.getClientsForFamilyMember(req.auth.userId, req.auth.agencyId)
            : await repo.getClients(req.auth.agencyId);
        res.json(clients);
    }
    catch {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
router.put('/:id', requireCapability('client.write'), async (req, res) => {
    // Partial validation: an edit may touch only the address, so every field is
    // optional, but anything supplied must still pass the same rules as create.
    const parsed = clientSchema.partial().safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            message: 'Invalid client',
            issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        });
        return;
    }
    try {
        const db = req.app.get('db');
        const repo = new ClientRepository(db);
        const updated = await repo.updateClient(String(req.params.id), req.auth.agencyId, parsed.data);
        if (!updated) {
            res.status(404).json({ message: 'Client not found' });
            return;
        }
        res.json(updated);
    }
    catch {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
router.delete('/:id', requireCapability('client.write'), async (req, res) => {
    try {
        const db = req.app.get('db');
        const repo = new ClientRepository(db);
        const result = await repo.deleteClient(String(req.params.id), req.auth.agencyId);
        if (result === 'not_found') {
            res.status(404).json({ message: 'Client not found' });
            return;
        }
        if (result === 'has_dependencies') {
            res.status(409).json({
                message: 'This client has authorizations or visit templates. Remove those first.',
                code: 'HAS_DEPENDENCIES',
            });
            return;
        }
        res.status(204).end();
    }
    catch {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
export default router;
//# sourceMappingURL=client-routes.js.map