/**
 * Bulk import / migration routes — the onboarding path for an agency moving
 * off HHAeXchange / Sandata / a spreadsheet.
 *
 *   GET  /import/:entity/template.csv  — download the column template
 *   POST /import/:entity/preview       — dry-run: parse + validate, no writes
 *   POST /import/:entity/commit        — atomic upsert of a clean file
 *
 * The CSV is sent as a raw text/csv body (not JSON) so it bypasses the global
 * 100kb JSON limit; a route-scoped express.text parser with a higher cap reads
 * it. Commit is ALL-OR-NOTHING: if any row fails validation (or, for
 * authorizations, its client link can't be resolved) the whole import is
 * refused with 422 and nothing is written — no partial loads. Rows are keyed
 * on external_id so re-running the same file updates instead of duplicating.
 */
import { Router } from 'express';
import express from 'express';
import { AuditEventRepository, CaregiverRepository, ClientRepository, hasCapability, parseCsv, validateImportRecords, IMPORT_ENTITIES, IMPORT_TEMPLATES, } from '@rayhealth/core';
import { safeError } from '../security/safe-log.js';
const router = Router();
// CSV bodies are sent as text/csv and can be a few MB for a full agency load.
router.use(express.text({ type: ['text/csv', 'text/plain'], limit: '15mb' }));
const ENTITY_CAP = {
    clients: 'client.write',
    caregivers: 'staff.write',
    authorizations: 'client.write',
};
function resolveEntity(raw) {
    return typeof raw === 'string' && IMPORT_ENTITIES.includes(raw)
        ? raw
        : null;
}
/** Shared entity-resolve + capability guard. Returns the entity or null (and writes the response). */
function guard(req, res) {
    const entity = resolveEntity(req.params.entity);
    if (!entity) {
        res.status(404).json({ message: 'unknown import entity' });
        return null;
    }
    if (!hasCapability(req.auth.role, ENTITY_CAP[entity])) {
        res.status(403).json({ message: 'forbidden' });
        return null;
    }
    return entity;
}
function bodyCsv(req, res) {
    const csv = typeof req.body === 'string' ? req.body : '';
    if (!csv.trim()) {
        res.status(400).json({ message: 'request body must be a non-empty CSV (content-type text/csv)' });
        return null;
    }
    return csv;
}
/** Resolve client external_ids → client uuids, agency-scoped (for auth linking). */
async function resolveClientIds(db, agencyId, externalIds) {
    const unique = [...new Set(externalIds)];
    if (unique.length === 0)
        return new Map();
    const rows = (await db('clients')
        .where('agency_id', agencyId)
        .whereIn('external_id', unique)
        .select('id', 'external_id'));
    return new Map(rows.map((r) => [r.external_id, r.id]));
}
/** Flag authorization rows whose client_external_id doesn't resolve. Mutates results. */
async function annotateAuthLinks(db, agencyId, results) {
    const okRows = results.filter((r) => r.status === 'ok');
    const linkMap = await resolveClientIds(db, agencyId, okRows.map((r) => r.value.clientExternalId));
    for (const r of okRows) {
        const cext = r.value.clientExternalId;
        if (!linkMap.get(cext)) {
            r.status = 'error';
            r.errors.push(`client_external_id '${cext}' not found among this agency's clients`);
        }
    }
}
function summarize(entity, results) {
    const errorCount = results.filter((r) => r.status === 'error').length;
    return {
        entity,
        total: results.length,
        okCount: results.length - errorCount,
        errorCount,
        // Echo only row/status/errors — never the parsed PHI values.
        rows: results.map((r) => ({ rowNumber: r.rowNumber, status: r.status, errors: r.errors })),
    };
}
// ---------- Template ----------
router.get('/:entity/template.csv', (req, res) => {
    const entity = guard(req, res);
    if (!entity)
        return;
    const header = IMPORT_TEMPLATES[entity].join(',') + '\n';
    res.setHeader('content-type', 'text/csv; charset=utf-8');
    res.setHeader('content-disposition', `attachment; filename="rayhealth-import-${entity}-template.csv"`);
    res.send(header);
});
// ---------- Preview (dry-run) ----------
router.post('/:entity/preview', async (req, res) => {
    const entity = guard(req, res);
    if (!entity)
        return;
    const csv = bodyCsv(req, res);
    if (csv === null)
        return;
    let results;
    try {
        const { records } = parseCsv(csv);
        results = validateImportRecords(entity, records);
    }
    catch (err) {
        res.status(400).json({ message: err instanceof Error ? err.message : 'Could not parse CSV' });
        return;
    }
    if (entity === 'authorizations') {
        try {
            await annotateAuthLinks(req.app.get('db'), req.auth.agencyId, results);
        }
        catch (err) {
            safeError('import preview link-resolve failed', err);
        }
    }
    res.json(summarize(entity, results));
});
// ---------- Commit (atomic) ----------
router.post('/:entity/commit', async (req, res) => {
    const entity = guard(req, res);
    if (!entity)
        return;
    const csv = bodyCsv(req, res);
    if (csv === null)
        return;
    const db = req.app.get('db');
    const agencyId = req.auth.agencyId;
    let results;
    try {
        const { records } = parseCsv(csv);
        results = validateImportRecords(entity, records);
    }
    catch (err) {
        res.status(400).json({ message: err instanceof Error ? err.message : 'Could not parse CSV' });
        return;
    }
    if (results.length === 0) {
        res.status(400).json({ message: 'No data rows found in the CSV' });
        return;
    }
    // Resolve client links for authorizations up front so unresolved links are
    // reported as errors (and block the commit) rather than failing mid-transaction.
    let linkMap = new Map();
    if (entity === 'authorizations') {
        try {
            await annotateAuthLinks(db, agencyId, results);
            linkMap = await resolveClientIds(db, agencyId, results
                .filter((r) => r.status === 'ok')
                .map((r) => r.value.clientExternalId));
        }
        catch (err) {
            safeError('import commit link-resolve failed', err);
            res.status(500).json({ message: 'Failed to resolve client links' });
            return;
        }
    }
    // ALL-OR-NOTHING: refuse a file with any errors. No partial loads.
    const errorRows = results.filter((r) => r.status === 'error');
    if (errorRows.length > 0) {
        res.status(422).json({
            message: 'Import has errors; fix the file and re-upload. Nothing was written.',
            ...summarize(entity, results),
        });
        return;
    }
    let created = 0;
    let updated = 0;
    try {
        await db.transaction(async (trx) => {
            if (entity === 'clients') {
                const repo = new ClientRepository(trx);
                for (const r of results) {
                    const { action } = await repo.upsertClientForImport(agencyId, r.value);
                    action === 'created' ? (created += 1) : (updated += 1);
                }
            }
            else if (entity === 'caregivers') {
                const repo = new CaregiverRepository(trx);
                for (const r of results) {
                    const { action } = await repo.upsertCaregiverForImport(agencyId, r.value);
                    action === 'created' ? (created += 1) : (updated += 1);
                }
            }
            else {
                const repo = new ClientRepository(trx);
                for (const r of results) {
                    const row = r.value;
                    const clientId = linkMap.get(row.clientExternalId);
                    if (!clientId)
                        throw new Error(`client link lost for ${row.clientExternalId}`);
                    const { action } = await repo.upsertAuthorizationForImport(clientId, row);
                    action === 'created' ? (created += 1) : (updated += 1);
                }
            }
        });
    }
    catch (err) {
        safeError('import commit failed (rolled back)', err);
        res.status(500).json({ message: 'Import failed; all changes were rolled back.' });
        return;
    }
    try {
        await new AuditEventRepository(db).create({
            agencyId,
            actorId: req.auth.userId,
            actorType: 'user',
            eventType: 'data.imported',
            entityType: 'import',
            entityId: agencyId,
            outcome: 'success',
            payload: { entity, created, updated, total: results.length },
            occurredAt: new Date().toISOString(),
        });
    }
    catch (err) {
        safeError('Failed to audit data.imported', err);
    }
    res.json({ entity, created, updated, total: results.length });
});
export default router;
//# sourceMappingURL=import-routes.js.map