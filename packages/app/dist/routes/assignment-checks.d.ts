/**
 * Shared assignment safety checks used by BOTH the create (POST) and
 * reschedule/reassign (PUT) paths so the two can never drift apart. Gathers the
 * caregiver, the template's client, the client's live authorization burn-down,
 * and runs the pure schedule-conflict gate. Returns the raw pieces; the caller
 * decides the HTTP shaping (403 / 404 / 409 / warnings) so each route keeps its
 * existing contract.
 */
import type { Knex } from 'knex';
export interface AssignmentCheckInput {
    caregiverId: string;
    visitTemplateId: string;
    /** YYYY-MM-DD, when scheduled. */
    visitDate?: string;
    /** Omit this assignment from duplicate detection (used when rescheduling it). */
    excludeAssignmentId?: string;
}
export interface AssignmentCheckResult {
    /** null = caregiver is not in this agency (caller should 403). */
    caregiver: {
        id: string;
    } | null;
    /** null = visit template not found in this agency (caller should 404). */
    templateClient: {
        clientId: string;
    } | null;
    /** Blocking conflicts (e.g. duplicate booking). Non-empty → caller should 409. */
    hardConflicts: string[];
    /** Non-blocking advisories (coverage, exhausted units, non-active credentials). */
    warnings: string[];
}
export declare function evaluateAssignmentChecks(db: Knex, agencyId: string, input: AssignmentCheckInput): Promise<AssignmentCheckResult>;
//# sourceMappingURL=assignment-checks.d.ts.map