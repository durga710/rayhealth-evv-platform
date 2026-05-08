import { Router } from 'express';
import { EvvRepository } from '@rayhealth/core';
import { requireCapability } from '../middleware/require-capability.js';
import { safeError } from '../security/safe-log.js';
const router = Router();
/** Escape one CSV cell per RFC 4180. */
function csvCell(value) {
    if (value == null)
        return '';
    const s = String(value);
    if (/[",\r\n]/.test(s))
        return `"${s.replace(/"/g, '""')}"`;
    return s;
}
/**
 * GET /exports/visits.csv?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * RFC-4180 CSV with all seven Cures-Act EVV data points (plus visit_id and
 * status). Tenant-scoped inside the repository. The auditLog middleware
 * records this as a PHI read (path matches /exports, treated as PHI in
 * audit-log's PHI_GET_PATHS in a follow-up update if not already).
 */
router.get('/visits.csv', requireCapability('schedule.read'), async (req, res) => {
    try {
        const fromRaw = typeof req.query.from === 'string' ? req.query.from : undefined;
        const toRaw = typeof req.query.to === 'string' ? req.query.to : undefined;
        const isDate = (v) => !v || /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(v);
        if (!isDate(fromRaw) || !isDate(toRaw)) {
            return res.status(400).json({ message: 'from / to must be YYYY-MM-DD or ISO 8601' });
        }
        const fromIso = fromRaw ? new Date(fromRaw).toISOString() : undefined;
        const toIso = toRaw ? new Date(`${toRaw}T23:59:59.999Z`).toISOString() : undefined;
        const repo = new EvvRepository(req.app.get('db'));
        const rows = await repo.getVisitsForExport(req.auth.agencyId, fromIso, toIso);
        const header = [
            'visit_id',
            'service_code',
            'client_id',
            'caregiver_id',
            'service_date',
            'start_time',
            'end_time',
            'location_lat',
            'location_lng',
            'location_accuracy',
            'status'
        ];
        const lines = [header.join(',')];
        for (const row of rows) {
            const loc = (row.clockInLocation ?? {});
            lines.push([
                row.visitId,
                row.serviceCode ?? '',
                row.clientId ?? '',
                row.caregiverId,
                row.clockInTime.slice(0, 10),
                row.clockInTime,
                row.clockOutTime ?? '',
                loc.lat ?? '',
                loc.lng ?? '',
                loc.accuracy ?? '',
                row.status
            ]
                .map(csvCell)
                .join(','));
        }
        const body = lines.join('\n') + '\n';
        const filename = `rayhealth-visits-${req.auth.agencyId.slice(0, 8)}-${new Date()
            .toISOString()
            .slice(0, 10)}.csv`;
        res.setHeader('content-type', 'text/csv; charset=utf-8');
        res.setHeader('content-disposition', `attachment; filename="${filename}"`);
        res.send(body);
    }
    catch (err) {
        safeError('visits.csv export failed', err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
export default router;
//# sourceMappingURL=export-routes.js.map