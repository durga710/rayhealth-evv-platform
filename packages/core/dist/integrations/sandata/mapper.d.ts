/**
 * RayHealth domain → Sandata Alt EVV wire mapping.
 *
 * Pure functions: a domain entity + its per-record SequenceID in, a Sandata
 * wire record out. No I/O, no clock access. Timestamps are emitted as the
 * ISO-8601 UTC strings already stored on the domain rows; date-only fields are
 * rendered CCYYMMDD per the Sandata spec. The mapper does NOT validate — run
 * `validateClient` / `validateEmployee` / `validateVisit` first.
 */
import type { Client } from '../../domain/client.js';
import type { Caregiver } from '../../domain/caregiver.js';
import type { EvvVisit } from '../../domain/evv.js';
import { SandataCallType, type SandataClient, type SandataEmployee, type SandataVisit } from './types.js';
/** 'YYYY-MM-DD' (or any ISO date) → 'CCYYMMDD'. Returns undefined for empty. */
export declare function toCCYYMMDD(isoDate: string | undefined | null): string | undefined;
/**
 * Map an internal Client to a Sandata CLIENT record.
 *
 * `ClientCustomID` reuses the internal client id and becomes the link key on
 * visits, so it MUST be stable across transmissions.
 */
export declare function mapClient(client: Client, sequenceId: number): SandataClient;
/**
 * Map an internal Caregiver to a Sandata EMPLOYEE record.
 *
 * `EmployeeCustomID` reuses the internal caregiver id and becomes the link key
 * on visits.
 */
export declare function mapEmployee(caregiver: Caregiver, sequenceId: number): SandataEmployee;
export interface MapVisitOptions {
    /** Capture method for the visit's calls. Defaults to Mobile (GPS). */
    callType?: SandataCallType;
    /** Procedure code override; defaults to the visit's stored serviceCode. */
    procedureCode?: string;
    /** Up to four HCPCS modifiers (PA addendum). */
    modifiers?: string[];
}
/**
 * Map an internal EvvVisit to a Sandata VISIT record, deriving Time In / Time
 * Out calls from the visit's clock events. The referenced Client and Employee
 * MUST already be VERIFIED by Sandata (load-order dependency) — that gate lives
 * in the transmission service, not here.
 */
export declare function mapVisit(visit: EvvVisit, sequenceId: number, opts?: MapVisitOptions): SandataVisit;
//# sourceMappingURL=mapper.d.ts.map