export declare const pennsylvaniaOperatingTracks: readonly ["personal-assistance", "home-health"];
export declare const paCredentialTypes: readonly ["tb-screening", "background-check", "license", "training"];
export declare const paCredentialStatuses: readonly ["active", "expired", "pending"];
export declare const paAssignmentStatuses: readonly ["scheduled", "completed", "cancelled"];
export declare const paExceptionTypes: readonly ["late-clock-in", "missing-location", "telephony-fallback", "manual-entry"];
export declare const paCaregiverStatuses: readonly ["active", "inactive", "suspended"];
/**
 * The seven data points required by the 21st Century Cures Act for every
 * personal-care and home-health visit (Section 12006). PA aggregators
 * (HHAeXchange, Sandata) all submit these fields.
 *
 * Mapping in RayHealth:
 *   1. service-type   → evv_visits.service_code     (P2-R4a)
 *   2. beneficiary    → evv_visits.client_id        (P2-R4a)
 *   3. date           → evv_visits.clock_in_time (date portion)
 *   4. location       → evv_visits.clock_in_location (lat/lng/accuracy)
 *   5. provider       → evv_visits.caregiver_id
 *   6. start-time     → evv_visits.clock_in_time
 *   7. end-time       → evv_visits.clock_out_time
 */
export declare const curesActEvvDataPoints: readonly ["service-type", "beneficiary", "date", "location", "provider", "start-time", "end-time"];
export type CuresActDataPoint = typeof curesActEvvDataPoints[number];
/** Aggregators currently certified by Pennsylvania for EVV submission. */
export declare const paAggregators: readonly ["hhaexchange", "sandata"];
export type PaAggregator = typeof paAggregators[number];
/** Pennsylvania PCS / HCPCS service codes RayHealth supports for billing + Cures-Act #1. */
export declare const paServiceCodes: readonly ["T1019", "S5125", "T1004", "T1021"];
export type PaServiceCode = typeof paServiceCodes[number];
/**
 * Billable units-of-measure per PA service code, used by claim generation to
 * convert a GPS-verified visit duration into Medicaid billing units.
 *
 *   - 15-minute codes (T1019/S5125/T1004): one unit = 15 minutes of service.
 *   - T1021 is billed per-visit (encoded as 0 → one unit per completed visit,
 *     independent of duration).
 *
 * These are HCPCS units of measure, not dollar rates. RayHealth is the
 * verification + claim-assembly layer; the payer's fee schedule determines the
 * paid amount per unit, so we deliberately do NOT hardcode dollar rates here.
 */
export declare const paServiceCodeUnitMinutes: Record<PaServiceCode, number>;
/** Human-readable HCPCS descriptions for each supported PA service code. */
export declare const paServiceCodeDescriptions: Record<PaServiceCode, string>;
export type PaCredentialType = typeof paCredentialTypes[number];
export type PaExceptionType = typeof paExceptionTypes[number];
export type AppRole = 'admin' | 'coordinator' | 'caregiver' | 'family';
export type Capability = 'agency.read' | 'agency.write' | 'staff.read' | 'staff.write' | 'client.read' | 'client.write' | 'schedule.read' | 'schedule.write' | 'evv.read' | 'evv.write' | 'auth.read' | 'auth.write' | 'audit.read' | 'audit.write' | 'learning.read' | 'learning.write' | 'billing.read' | 'billing.write';
export declare function hasCapability(role: AppRole, capability: Capability): boolean;
/** Pennsylvania PCS geofence base radius (meters). 55 Pa. Code §52.32. */
export declare const PA_GEOFENCE_BASE_METERS = 100;
/** GPS-accuracy tolerance layered on top of the base radius. */
export declare const PA_GEOFENCE_TOLERANCE_METERS = 50;
/** Total effective geofence radius used by the EVV mobile check. */
export declare const PA_GEOFENCE_TOTAL_METERS: number;
/** FLSA-style "de minimis" grace window after the scheduled start (minutes). */
export declare const PA_GRACE_PERIOD_MINUTES = 15;
/** VMUR (Visit Maintenance) correction window before the visit is locked (days). */
export declare const PA_VMUR_CORRECTION_WINDOW_DAYS = 7;
/** PA retains EVV + audit records for 7 years — longest in the nation. */
export declare const PA_RETENTION_YEARS = 7;
/** PA DHS audit-response SLA from notification to packet submission (hours). */
export declare const PA_DHS_AUDIT_RESPONSE_HOURS = 48;
/** Plan-of-care review cadence for active CHC clients (days). */
export declare const PA_POC_REVIEW_DAYS = 60;
/** RN supervisory-visit cadence for a brand-new client (days). */
export declare const PA_RN_SUPERVISION_NEW_CLIENT_DAYS = 14;
/** RN supervisory-visit cadence for an established client (days). */
export declare const PA_RN_SUPERVISION_ESTABLISHED_DAYS = 60;
/** Community HealthChoices quarterly review cycle (days). 55 Pa. Code Ch. 6000. */
export declare const PA_RN_SUPERVISION_CHC_DAYS = 90;
/** PA PATCH + FBI background-check renewal cadence (years). 23 Pa.C.S. §6344. */
export declare const PA_BACKGROUND_CHECK_RENEWAL_YEARS = 5;
/** Re-run background checks after this many days out of service. */
export declare const PA_BREAK_IN_SERVICE_RECHECK_DAYS = 365;
/** CNA continuing-education hours per 24-month registry cycle. */
export declare const PA_CNA_CE_HOURS_PER_CYCLE = 24;
/** CNAs must work at least this many paid months within the registry cycle. */
export declare const PA_CNA_PAID_WORK_MONTHS = 24;
/** Minimum HHA classroom hours required by 42 CFR 484.80. */
export declare const PA_HHA_TRAINING_HOURS = 75;
/** Minimum HHA in-service hours per calendar year. */
export declare const PA_HHA_INSERVICE_HOURS_PER_YEAR = 12;
/** ChildLine + Abuse Registry hotline (PA DHS, 24-hr). */
export declare const PA_DHS_ABUSE_HOTLINE = "1-800-932-0582";
/** Sandata aggregator EVV submission endpoint (production). */
export declare const PA_SANDATA_EVV_ENDPOINT = "https://evv.sandata.com/Sandata.WebServices/Production";
/** Sandata submission window — visits must be submitted within (days). */
export declare const PA_SANDATA_SUBMISSION_WINDOW_DAYS = 7;
/**
 * The three Community HealthChoices managed-care organisations operating in
 * Pennsylvania. The Compliance Engine surfaces these as policy context for the
 * Medicaid Workflow module until per-MCO tagging lives on the authorizations
 * table.
 */
export declare const paChcMcos: readonly ["AmeriHealth Caritas Northeast", "Pennsylvania Health & Wellness", "UPMC Community HealthChoices"];
export type PaChcMco = typeof paChcMcos[number];
/**
 * The six caregiver credential codes PA expects for a fully compliant home-
 * health roster. Used by the Credentials & Background module's policy block
 * so the UI renders the taxonomy without hardcoding it. Distinct from
 * `paCredentialTypes` above — that older list is the persisted-row credential
 * categories; this list is the PA-specific taxonomy.
 */
export declare const paComplianceCredentials: readonly ["pa-patch", "fbi-fingerprint", "child-abuse", "cna-registry", "hha-training", "rn-supervision"];
export type PaComplianceCredential = typeof paComplianceCredentials[number];
//# sourceMappingURL=pennsylvania.d.ts.map