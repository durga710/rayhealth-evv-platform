import type { Knex } from 'knex';
/**
 * Counts of records that would land in a PA audit-defense packet for the
 * given agency and inclusive date range. All four are read-only `COUNT(*)`
 * queries; this repository never writes.
 */
export interface AuditDefenseCounts {
    /** `audit_events` with `occurred_at` in [from, to] for the agency. */
    auditEvents: number;
    /** `visit_maintenance` (VMUR) with `created_at` in [from, to] for the agency. */
    vmurRecords: number;
    /** `evv_visits` with `clock_in_time` in [from, to], scoped to the agency
     *  via the caregiver who clocked it. */
    evvVisits: number;
    /** `caregivers` currently `active` for the agency (as-of-now snapshot). */
    activeCaregivers: number;
}
/** A single row that appears in the streamed PA audit-defense packet. */
export interface AuditDefensePacketRow {
    /** Which data set this row belongs to. */
    recordType: 'audit_event' | 'vmur' | 'evv_visit';
    /** Source-table primary key. */
    id: string;
    /** ISO timestamp identifying when the row happened in the source system. */
    occurredAt: string;
    /** Actor (user/system) most directly responsible — may be null for raw visits. */
    actorId: string | null;
    /** Visit reference where applicable. */
    visitId: string | null;
    /** Caregiver reference where applicable. */
    caregiverId: string | null;
    /** Type-specific JSON-encoded details (event_type, visit status, VMUR
     *  reason/adjustments, …). Kept stable so the manifest hash is reproducible. */
    detailsJson: string;
}
/** Result of building a packet — counts plus the underlying row stream. */
export interface AuditDefensePacket {
    agencyId: string;
    periodFrom: string;
    periodTo: string;
    counts: AuditDefenseCounts;
    rows: AuditDefensePacketRow[];
    /** Hex SHA-256 of the canonical CSV serialisation of `rows` (without the
     *  manifest line). The CSV writer adds this hash to the manifest row so a
     *  PA DHS auditor can re-derive it and confirm the packet was not edited. */
    manifestSha256: string;
}
/** A single open EVV exception row returned by `listOpenExceptions`. */
export interface OpenExceptionRow {
    id: string;
    visitId: string;
    caregiverId: string;
    agencyId: string;
    exceptionType: string;
    reason: string;
    createdAt: string;
    /** Visit clock-in time so coordinators can age the queue. */
    visitClockInTime: string;
    /** Visit status (pending/verified/flagged) for context in the row. */
    visitStatus: string;
}
/** Page of open exceptions with the total open count for pagination. */
export interface OpenExceptionsPage {
    rows: OpenExceptionRow[];
    total: number;
    limit: number;
    offset: number;
}
/** Result of acknowledging an exception (null = not found or wrong agency). */
export interface AcknowledgedException {
    id: string;
    visitId: string;
    exceptionType: string;
    reason: string;
    approvedBy: string;
    approvedAt: string;
}
/** Detailed authorization row with computed unit balance + urgency tier. */
export interface AuthorizationDetailRow {
    id: string;
    clientId: string;
    /** Concatenated client first + last name for display. NOT a PHI export — the
     *  view is admin/coordinator-only via `client.read`. */
    clientName: string;
    payerId: string;
    serviceCode: string;
    startDate: string;
    endDate: string;
    unitsAuthorized: number;
    /** Sum of clock_out − clock_in hours for verified visits assigned to this
     *  client whose clock-in fell inside [start_date, end_date]. 1 hour ≈ 1 unit
     *  for the most common PA personal-care/home-health codes (S5125, T1019).
     *  Documented in `docs/compliance/states/pennsylvania.md`. */
    unitsUsed: number;
    /** `unitsAuthorized − unitsUsed` clamped at 0 (never negative). */
    unitsRemaining: number;
    /** `end_date − asOf` in whole days; negative values mean already expired. */
    daysToExpiry: number;
    /** Bucket the UI uses to pick a color. */
    urgency: 'expired' | 'critical' | 'warning' | 'info' | 'ok';
}
/** Page of authorization detail rows + total count for pagination. */
export interface AuthorizationsPage {
    rows: AuthorizationDetailRow[];
    total: number;
    limit: number;
    offset: number;
    asOf: string;
}
/** Filter selector for `listAuthorizations`. */
export type AuthorizationListFilter = 'active' | 'expiring-14d' | 'expiring-30d' | 'expiring-90d' | 'recently-expired';
/** Canonical column order for the packet CSV (used by tests + writers). */
export declare const AUDIT_DEFENSE_PACKET_COLUMNS: readonly ["record_type", "id", "occurred_at", "actor_id", "visit_id", "caregiver_id", "details_json"];
/**
 * Repository powering the Compliance Engine. Beta scope is read-only previews;
 * the full packet builder (Sandata export bundle, signed manifest, retention
 * sweep hook) lands in follow-up PRs.
 */
export declare class ComplianceEngineRepository {
    private readonly db;
    constructor(db: Knex);
    getAuditDefensePreview(agencyId: string, fromIso: string, toIso: string): Promise<AuditDefenseCounts>;
    /**
     * Build a defensible PA audit packet for [fromIso, toIso] (ISO datetimes).
     *
     * Returns a stable, sorted row stream across three sources:
     *  - `audit_events` (occurred_at in window, agency-scoped directly)
     *  - `visit_maintenance` / VMUR (created_at in window, agency-scoped directly)
     *  - `evv_visits` (clock_in_time in window, scoped via `caregivers.agency_id`)
     *
     * Rows are sorted by `occurredAt ASC, id ASC` so the SHA-256 manifest hash is
     * reproducible regardless of which order Postgres returned each subquery in.
     * The hash is computed over the canonical CSV serialisation of the data rows
     * (header line + each row), so a PA DHS auditor can re-derive it from the
     * downloaded packet without trusting the server.
     *
     * This is a read-only build — it does not write the audit event for the
     * export itself. That event must be emitted by the caller (the HTTP route)
     * with `eventType: 'phi.export'` so the actor + correlation id are accurate.
     */
    buildAuditDefensePacket(agencyId: string, fromIso: string, toIso: string): Promise<AuditDefensePacket>;
    /**
     * Paginated list of open EVV exceptions (`approved_at IS NULL`) for the
     * agency, joined to `evv_visits` so the row carries the visit's clock-in
     * timestamp (used by the UI to age the queue against the PA DHS 48-hour SLA).
     *
     * Filter `type` accepts one of the four `paExceptionTypes` strings;
     * `limit` is clamped to [1, 200] and `offset` to ≥ 0.
     */
    listOpenExceptions(agencyId: string, opts?: {
        type?: string;
        limit?: number;
        offset?: number;
    }): Promise<OpenExceptionsPage>;
    /**
     * Acknowledge a single open exception: stamps `approved_by` + `approved_at`
     * and returns the resulting row. Returns `null` when:
     *  - the exception does not exist
     *  - the exception belongs to a different agency
     *  - the exception is already acknowledged (idempotent — caller can warn)
     *
     * Does **not** emit the audit event itself — the HTTP route writes a single
     * `exception.approved` event with the actor and correlation id; doing it here
     * would lose the request-scoped context. Updates are wrapped in a transaction
     * so the agency-scope check and the UPDATE land atomically.
     */
    acknowledgeException(agencyId: string, exceptionId: string, actorId: string): Promise<AcknowledgedException | null>;
    /**
     * Paginated, agency-scoped detail list of authorizations with computed
     * `unitsUsed` / `unitsRemaining` per row.
     *
     * `unitsUsed` sums `EXTRACT(EPOCH FROM (clock_out − clock_in))/3600` for
     * evv_visits whose `clock_in_time` falls inside the authorization window
     * (start_date..end_date) **and** whose assignment → visit_template → client
     * matches the authorization's client. Treats 1 unit = 1 hour, which matches
     * the most common PA personal-care/home-health codes (S5125, T1019). Service
     * codes that use a different unit basis (15-min increments, 30-min) need a
     * follow-up: that's tracked in `docs/compliance/states/pennsylvania.md`.
     *
     * The `filter` selector maps to one of the same buckets the overview surface
     * already uses, plus an `expiring-90d` lens for the CHC quarterly review
     * cycle.
     */
    listAuthorizations(agencyId: string, opts: {
        asOf: string;
        filter?: AuthorizationListFilter;
        limit?: number;
        offset?: number;
    }): Promise<AuthorizationsPage>;
    /**
     * Authorization-oversight counts for an agency as of `asOf` (YYYY-MM-DD).
     * `authorizations` has no `agency_id` column, so the join goes through
     * `clients`. All four queries are read-only COUNTs.
     */
    getAuthorizationOversight(agencyId: string, asOf: string): Promise<AuthorizationOversightCounts>;
    /**
     * Aggregate headline KPIs across all seven Compliance Engine modules so the
     * Overview page can render live counts in one round-trip. Runs the seven
     * per-module methods in parallel; the audit-defense window is the trailing
     * 30 days ending at `asOf` (start/end of day UTC).
     */
    getEngineSummary(agencyId: string, asOf: string): Promise<EngineSummary>;
    /**
     * Credentials compliance snapshot for the agency. Counts caregiver_credentials
     * by status, plus expiry windows (30 d / 90 d) and recently-expired (14 d).
     * Joins `caregiver_credentials → caregivers.agency_id` for scope.
     */
    getCredentialsCompliance(agencyId: string, asOf: string): Promise<CredentialsComplianceCounts>;
    /**
     * Claim Matching readiness snapshot. Uses `evv_visits.status`
     * (pending / verified / flagged) as the claim-readiness signal until a real
     * claims feed lands. Joins `evv_visits → caregivers.agency_id` for scope.
     */
    getClaimMatching(agencyId: string): Promise<ClaimMatchingCounts>;
    /**
     * Payroll Reconciliation snapshot from EVV-verified clock events.
     * Uses Postgres `EXTRACT(EPOCH FROM (clock_out_time - clock_in_time))` to
     * compute durations. Joins `evv_visits → caregivers` for agency scope.
     * Counts are over the trailing 7 / 30 days plus a snapshot of currently
     * in-progress visits.
     */
    getPayrollReconciliation(agencyId: string): Promise<PayrollReconciliationCounts>;
    /**
     * Medicaid Workflow snapshot for the agency, derived from the authorizations
     * table (joined to clients for agency scope). Distinct-counts give an
     * operational picture before MCO/eligibility tagging exists.
     */
    getMedicaidWorkflow(agencyId: string, asOf: string): Promise<MedicaidWorkflowCounts>;
    /**
     * Unified open-exception counts for the agency, plus VMUR pending.
     * Joins `evv_exceptions → evv_visits → caregivers.agency_id` since
     * exceptions have no `agency_id`. "Open" means `approved_at IS NULL`.
     */
    getExceptionResolution(agencyId: string): Promise<ExceptionResolutionCounts>;
}
/** Counts powering the Authorization Oversight compliance lens. */
export interface AuthorizationOversightCounts {
    /** Authorizations whose [start_date, end_date] window contains `asOf`. */
    activeAuthorizations: number;
    /** Authorizations ending in (asOf, asOf + 14d]. */
    expiringIn14d: number;
    /** Authorizations ending in (asOf, asOf + 30d]. */
    expiringIn30d: number;
    /** Authorizations that ended in [asOf - 14d, asOf). */
    recentlyExpired: number;
}
/** Headline KPIs across all Compliance Engine modules for the Overview page. */
export interface EngineSummary {
    /** audit_events in the trailing 30 days. */
    auditEventsLast30d: number;
    /** Authorizations active as of `asOf`. */
    activeAuthorizations: number;
    /** Open EVV exceptions (approved_at IS NULL). */
    openExceptions: number;
    /** Distinct clients with at least one active authorization. */
    activeMaCases: number;
    /** Sum of verified clock-out − clock-in hours in trailing 7 days. */
    verifiedHoursLast7d: number;
    /** EVV visits with `status='verified'` in trailing 7 days. */
    claimReadyLast7d: number;
    /** caregiver_credentials with `status='active'`. */
    activeCredentials: number;
}
/** Counts powering the Credentials Compliance snapshot. */
export interface CredentialsComplianceCounts {
    /** caregiver_credentials with `status='active'` for the agency. */
    activeCredentials: number;
    /** caregiver_credentials with `status='pending'`. */
    pendingCredentials: number;
    /** caregiver_credentials with `status='expired'`. */
    expiredCredentials: number;
    /** Active credentials expiring in (asOf, asOf + 30d]. */
    expiringIn30d: number;
    /** Active credentials expiring in (asOf, asOf + 90d]. */
    expiringIn90d: number;
    /** Credentials whose `expires_at` fell in [asOf - 14d, asOf). */
    recentlyExpired: number;
}
/** Counts powering the Claim Matching readiness snapshot. */
export interface ClaimMatchingCounts {
    /** EVV visits with `status='verified'` in the trailing 7 days (claim-ready). */
    verifiedVisitsLast7d: number;
    /** EVV visits with `status='verified'` in the trailing 30 days. */
    verifiedVisitsLast30d: number;
    /** EVV visits with `status='flagged'` in the trailing 7 days (not claim-ready). */
    flaggedVisitsLast7d: number;
    /** EVV visits with `status='pending'` (in-flight, not yet verified). */
    pendingVisits: number;
}
/** Counts powering the Payroll Reconciliation snapshot. */
export interface PayrollReconciliationCounts {
    /** Verified hours (clock_out - clock_in) in the trailing 7 days. */
    verifiedHoursLast7d: number;
    /** Verified hours (clock_out - clock_in) in the trailing 30 days. */
    verifiedHoursLast30d: number;
    /** Visits with both clock-in and clock-out in the trailing 7 days. */
    completedVisitsLast7d: number;
    /** Visits with clock-in but no clock-out yet (currently in-progress shifts). */
    inProgressVisits: number;
}
/** Counts powering the Medicaid Workflow snapshot. */
export interface MedicaidWorkflowCounts {
    /** Distinct clients with at least one active authorization on `asOf`. */
    activeMaCases: number;
    /** Distinct `payer_id` values across active authorizations. */
    distinctPayers: number;
    /** Distinct `service_code` values across active authorizations. */
    distinctServiceCodes: number;
    /** Authorizations created in the last 30 days for the agency. */
    newAuthsLast30d: number;
}
/** Counts powering the Exception Resolution unified queue. */
export interface ExceptionResolutionCounts {
    /** All `evv_exceptions` with `approved_at IS NULL` for the agency. */
    openExceptions: number;
    /** Open + `exception_type = 'late-clock-in'`. */
    lateClockInOpen: number;
    /** Open + `exception_type = 'missing-location'`. */
    missingLocationOpen: number;
    /** Open + `exception_type = 'manual-entry'`. */
    manualEntryOpen: number;
    /** Open + `exception_type = 'telephony-fallback'`. */
    telephonyFallbackOpen: number;
    /** `visit_maintenance` with status `pending` for the agency. */
    vmurPending: number;
}
/**
 * Render one packet row as a CSV line using the canonical column order
 * (`AUDIT_DEFENSE_PACKET_COLUMNS`). Used by both the manifest-hash computation
 * and the HTTP CSV writer so they agree byte-for-byte.
 */
export declare function auditPacketRowToCsv(row: AuditDefensePacketRow): string;
//# sourceMappingURL=compliance-engine-repository.d.ts.map