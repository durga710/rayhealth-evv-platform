import type { Knex } from 'knex';
import type { VisitMaintenance } from '../domain/visit-maintenance.js';
/**
 * Tenant boundary for VMUR visit corrections — the one DB-sanctioned path
 * for editing an evv_visits row after the immutability trigger locks it.
 * `visit_maintenance.agency_id` is a denormalized copy for fast queue
 * reads; the authoritative link (used here for every authorization check)
 * is visit_id -> evv_visits.caregiver_id -> caregivers.agency_id, so this
 * stays correct even for rows written before that column existed.
 */
export declare class VisitMaintenanceRepository {
    private readonly db;
    constructor(db: Knex);
    private resolveVisitAgencyId;
    /**
     * Create an unlock request. Throws if `visitId` does not belong to
     * `agencyId` — prevents a caller from submitting (and later having
     * approved) a correction against another agency's visit.
     */
    requestUnlock(maintenance: Omit<VisitMaintenance, 'agencyId'>, agencyId: string): Promise<VisitMaintenance>;
    /**
     * Approve (and adjust) an unlock request — only if it belongs to
     * `agencyId`. Returns null for both "not found" and "belongs to another
     * agency" so the route can 404 without leaking cross-tenant existence.
     *
     * `approverId` is recorded on the row (approver_id + approved_at) so a
     * post-finalization billing change is always attributable to the actor who
     * authorized it — distinct from the requester. This is a non-repudiation
     * requirement for editing an otherwise immutable evv_visits row.
     */
    approveUnlock(id: string, agencyId: string, approverId: string, adjustedTimes: {
        start: string;
        end: string;
    }): Promise<VisitMaintenance | null>;
    /**
     * Agency-scoped VMUR read for a single visit — the accountability trail
     * for the audit packet (`GET /admin/audit-packet/:visitId`). Uses the same
     * `evv_visits -> caregivers.agency_id` authorization join as every other
     * method on this repository (never `visit_maintenance.agency_id` alone,
     * since older rows may predate that denormalized column). Left-joins
     * `users` twice (requester, approver) to surface a display name — those
     * names are not stored on the visit_maintenance row itself.
     *
     * Ordered newest-first so the packet renders the most recent correction
     * activity at the top of the VMUR trail.
     */
    findByVisitIdForAgency(visitId: string, agencyId: string): Promise<Array<VisitMaintenance & {
        requesterName: string | null;
        approverName: string | null;
    }>>;
    private mapRowToMaintenance;
}
//# sourceMappingURL=visit-maintenance-repository.d.ts.map