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
export function checkScheduleConflicts(input) {
    const hardConflicts = [];
    const warnings = [];
    const { proposed, existingAssignments, authorizations } = input;
    // HARD: duplicate assignment (same template + same date).
    if (proposed.visitDate) {
        const dup = existingAssignments.some((a) => a.visitTemplateId === proposed.visitTemplateId && a.visitDate === proposed.visitDate);
        if (dup) {
            hardConflicts.push(`Caregiver is already assigned to this visit on ${proposed.visitDate}.`);
        }
    }
    // SOFT: authorization coverage + remaining units (only when a date is set).
    if (proposed.visitDate) {
        const covering = authorizations.filter((a) => proposed.visitDate >= a.startDate &&
            proposed.visitDate <= a.endDate &&
            (!proposed.serviceCode || a.serviceCode === proposed.serviceCode));
        if (covering.length === 0) {
            warnings.push(`No active authorization covers ${proposed.visitDate}.`);
        }
        else {
            const withRemaining = covering.filter((a) => a.unitsRemaining !== undefined);
            if (withRemaining.length > 0 && withRemaining.every((a) => (a.unitsRemaining ?? 0) <= 0)) {
                const left = Math.max(0, ...withRemaining.map((a) => a.unitsRemaining ?? 0));
                warnings.push(`Authorization units exhausted (${left} left).`);
            }
        }
    }
    return { hardConflicts, warnings };
}
//# sourceMappingURL=schedule-conflict-service.js.map