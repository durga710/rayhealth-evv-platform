import { Router } from 'express';
import { AuditEventRepository } from '@rayhealth/core';
import { requireCapability } from '../middleware/require-capability.js';
const router = Router();
/**
 * Admin-facing audit-log retention status. HIPAA evidence (45 CFR
 * §164.530(j)) — agencies must retain audit logs for 6 years and be
 * able to demonstrate that retention to auditors. This endpoint
 * surfaces the data-of-record without exposing PHI:
 *
 *   - totalRows                       : count of audit_events for the agency
 *   - oldestOccurredAt                : ISO timestamp of the earliest record
 *   - eventsLast30Days                : recent activity sanity-check
 *   - eventsApproachingSixYearLimit   : rows older than 5y 9m — the bucket
 *                                       that needs cold-storage extraction
 *                                       in the next 90 days
 *   - retentionFloorYears             : 6 (statutory minimum)
 *   - immutabilityTrigger             : DB trigger name proving append-only
 *                                       enforcement at the DB layer
 *
 * Capability: `audit.read` (admin-only by default in
 * `pennsylvania.ts.ROLE_CAPABILITIES`). Coordinators / caregivers /
 * family members never see this.
 */
router.get('/status', requireCapability('audit.read'), async (req, res) => {
    try {
        const db = req.app.get('db');
        const stats = await new AuditEventRepository(db).getRetentionStats(req.auth.agencyId);
        res.json({
            ...stats,
            retentionFloorYears: 6,
            immutabilityTrigger: 'audit_events_block_mutation_trg'
        });
    }
    catch {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
export default router;
//# sourceMappingURL=audit-retention-routes.js.map