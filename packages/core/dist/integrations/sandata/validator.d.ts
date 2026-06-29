/**
 * Pre-transmission validation for Sandata Alt EVV.
 *
 * Sandata rejects an entire batch on a single malformed record, so we validate
 * BEFORE mapping/posting. Two severities:
 *  - HARD_BLOCK: the record cannot be transmitted; fix the source data first.
 *  - SOFT_WARN:  Sandata will likely accept it but flag an exception (e.g. a
 *                mobile visit with no GPS) — surfaced, not blocking.
 *
 * `validate*` returns `ok = true` only when there are zero HARD_BLOCK issues.
 * Pure functions over domain entities; no I/O.
 */
import type { Client } from '../../domain/client.js';
import type { Caregiver } from '../../domain/caregiver.js';
import type { EvvVisit } from '../../domain/evv.js';
export type ValidationSeverity = 'HARD_BLOCK' | 'SOFT_WARN';
export interface ValidationIssue {
    field: string;
    message: string;
    severity: ValidationSeverity;
}
export interface ValidationResult {
    /** True when there are no HARD_BLOCK issues. SOFT_WARN issues may still be present. */
    ok: boolean;
    issues: ValidationIssue[];
}
export interface SandataValidationContext {
    /** When true (GPS program), client coordinates and call GPS are required (HARD_BLOCK). */
    gpsRequired?: boolean;
}
/** Validate a Client for Sandata CLIENT transmission. */
export declare function validateClient(client: Client, ctx?: SandataValidationContext): ValidationResult;
/** Validate a Caregiver for Sandata EMPLOYEE transmission. */
export declare function validateEmployee(caregiver: Caregiver): ValidationResult;
/** Validate an EvvVisit for Sandata VISIT transmission. */
export declare function validateVisit(visit: EvvVisit, ctx?: SandataValidationContext): ValidationResult;
//# sourceMappingURL=validator.d.ts.map