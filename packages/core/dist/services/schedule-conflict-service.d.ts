/**
 * Pure schedule-conflict checker run when an assignment is created.
 *
 * The assignment model is day-granular (a visit date, no start/end time), so
 * this detects the conflicts the data supports today:
 *  - HARD: a duplicate assignment (same caregiver already on this visit
 *    template for the same date) — blocked.
 *  - SOFT (warnings, non-blocking): the visit date has no covering client
 *    authorization, or the covering authorization has no units left.
 *
 * Credential gating and true time-overlap detection are intentionally out of
 * scope here (credentials aren't yet enterable; assignments have no times).
 */
export interface ConflictAuthorization {
    serviceCode: string;
    /** YYYY-MM-DD inclusive window. */
    startDate: string;
    endDate: string;
    unitsAuthorized: number;
    /** Units left after billed claims, when computable. */
    unitsRemaining?: number;
}
export interface ConflictExistingAssignment {
    visitTemplateId: string;
    /** YYYY-MM-DD, when scheduled. */
    visitDate?: string;
}
export interface ScheduleConflictInput {
    proposed: {
        visitTemplateId: string;
        visitDate?: string;
        serviceCode?: string;
    };
    existingAssignments: readonly ConflictExistingAssignment[];
    authorizations: readonly ConflictAuthorization[];
}
export interface ScheduleConflictResult {
    hardConflicts: string[];
    warnings: string[];
}
export declare function checkScheduleConflicts(input: ScheduleConflictInput): ScheduleConflictResult;
//# sourceMappingURL=schedule-conflict-service.d.ts.map