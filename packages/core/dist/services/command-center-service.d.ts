/**
 * Command Center attention engine — pure, deterministic prioritization of what a
 * home-care agency owner must act on RIGHT NOW. Takes the agency operational
 * snapshot (all aggregated counts, no PHI) and returns a severity-ranked list of
 * attention items, each with a deep-link to the page that resolves it.
 *
 * Kept pure (no DB / IO) so it is fully unit-testable and so the same logic can
 * later feed an AI natural-language summary without re-deriving thresholds.
 */
import type { TodaysVisitOps, ExceptionResolutionCounts, AuthorizationOversightCounts, CredentialsComplianceCounts, ClaimMatchingCounts, PayrollReconciliationCounts } from '../repositories/compliance-engine-repository.js';
export type TodayVisitStatus = 'completed' | 'in_progress' | 'late' | 'upcoming';
/**
 * Classify a single scheduled visit for the Today board. Pure so it can be unit
 * tested and stays the single source of truth for the count buckets too:
 *   completed  → clocked out
 *   in_progress→ clocked in, not out
 *   late       → scheduled start passed (> grace) with no clock-in
 *   upcoming   → scheduled later, not started
 */
export declare function deriveTodayVisitStatus(v: {
    clockInTime: string | null;
    clockOutTime: string | null;
    scheduledStartTime: string | null;
}, nowMs: number, graceMs?: number): TodayVisitStatus;
export type AttentionSeverity = 'critical' | 'warning' | 'info';
export interface AttentionItem {
    /** Stable id so the UI can key / dedupe. */
    id: string;
    severity: AttentionSeverity;
    /** Short headline, e.g. "3 visits late to start". */
    title: string;
    /** One-line explanation of why it matters / what to do. */
    detail: string;
    /** The count driving this item (for sorting + display). */
    count: number;
    /** In-app route that resolves the item. */
    to: string;
}
/** Training rollup subset the command center consumes (from LearningAgencyRollup). */
export interface TrainingRollupInput {
    complianceRate: number;
    overdue: number;
    expired: number;
}
/** Coverage forecast subset the command center consumes (from CoverageForecast). */
export interface CoverageRollupInput {
    /** Upcoming recurring visits not yet generated into assignments. */
    totalGaps: number;
}
export interface CommandCenterSnapshot {
    today: TodaysVisitOps;
    exceptions: ExceptionResolutionCounts;
    authorizations: AuthorizationOversightCounts;
    credentials: CredentialsComplianceCounts;
    claims: ClaimMatchingCounts;
    payroll: PayrollReconciliationCounts;
    training: TrainingRollupInput;
    coverage: CoverageRollupInput;
}
/**
 * Build the prioritized attention list. Items only appear when their driving
 * count is > 0, so a clean agency shows an empty list ("all clear"). Sorted by
 * severity (critical → warning → info), then by count descending.
 */
export declare function buildCommandCenterAttention(s: CommandCenterSnapshot): AttentionItem[];
/**
 * Build the prompt for an AI "daily briefing" over the command-center snapshot.
 * PURE and COUNT-ONLY — it never includes a client/caregiver name or any PHI,
 * only aggregate numbers and the already-derived attention list, so the briefing
 * carries no retention liability. Returns the system instruction + user prompt
 * for `askAI`; kept here (not in the route) so it's unit-testable and the
 * guardrails live with the rules they describe.
 */
export declare function buildBriefingPrompt(s: CommandCenterSnapshot): {
    system: string;
    prompt: string;
};
//# sourceMappingURL=command-center-service.d.ts.map