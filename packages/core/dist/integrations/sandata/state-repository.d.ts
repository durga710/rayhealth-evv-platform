/**
 * Durable state for the Sandata Alt EVV async lifecycle.
 *
 * The synchronous client had no memory; the async POST→UUID→poll model needs
 * persistent state the transmission service drives:
 *  - sandata_record_state: per CLIENT/EMPLOYEE/VISIT record — its monotonically
 *    increasing SequenceID (Sandata requires it grow on every resend), current
 *    status, and the last UUID/poll result.
 *  - sandata_transmission: one row per POSTed batch UUID (the poll ledger).
 *  - sandata_transmission_record: which records rode in which transmission.
 *  - sandata_exception_queue: visit exceptions surfaced back to staff.
 *
 * The `SandataStateRepo` interface lets the transmission service be unit-tested
 * with an in-memory fake; `KnexSandataStateRepository` is the production impl.
 */
import type { Knex } from 'knex';
import { SandataEntityType, SandataRecordStatus } from './types.js';
/** A record that has just been POSTed, with the SequenceID it was stamped with. */
export interface PostedRecord {
    externalId: string;
    sequenceId: number;
    /** sha256 of the transmitted payload (idempotency / change detection). */
    payloadHash?: string;
}
/** A pending (not-yet-completed) transmission awaiting a status poll. */
export interface PendingTransmission {
    id: number;
    agencyId: string;
    entityType: SandataEntityType;
    uuid: string;
    recordCount: number;
    pollAttempts: number;
}
/** Per-record result parsed from a Sandata status response. */
export interface RecordStatusUpdate {
    externalId: string;
    status: SandataRecordStatus;
    reasonCodes?: string[];
    description?: string;
}
export interface ExceptionInput {
    visitId?: string | null;
    externalId: string;
    exceptionId?: string | null;
    reasonCodes?: string[];
    description?: string | null;
}
export interface SandataStateRepo {
    /** SequenceID to stamp on the NEXT transmission of this record (1, then prior+1). */
    nextSequence(agencyId: string, entityType: SandataEntityType, externalId: string): Promise<number>;
    /** Persist a posted batch: create the transmission row + upsert each record to RECEIVED. */
    recordTransmitted(agencyId: string, entityType: SandataEntityType, uuid: string, environment: string, records: PostedRecord[]): Promise<number>;
    /** Transmissions still in RECEIVED status (awaiting a status poll). */
    findPendingTransmissions(agencyId: string): Promise<PendingTransmission[]>;
    /** Apply per-record results and mark the transmission COMPLETED. */
    applyStatusResults(transmissionId: number, results: RecordStatusUpdate[]): Promise<void>;
    /** Bump poll bookkeeping when Sandata says "not ready yet". */
    markTransmissionPolled(transmissionId: number): Promise<void>;
    /** True only when BOTH referenced records are VERIFIED (visit load-order gate). */
    areDependenciesVerified(agencyId: string, clientExternalId: string, employeeExternalId: string): Promise<boolean>;
    /** Queue a visit exception for staff resolution. */
    enqueueException(agencyId: string, input: ExceptionInput): Promise<void>;
}
export declare class KnexSandataStateRepository implements SandataStateRepo {
    private readonly db;
    constructor(db: Knex);
    nextSequence(agencyId: string, entityType: SandataEntityType, externalId: string): Promise<number>;
    recordTransmitted(agencyId: string, entityType: SandataEntityType, uuid: string, environment: string, records: PostedRecord[]): Promise<number>;
    findPendingTransmissions(agencyId: string): Promise<PendingTransmission[]>;
    applyStatusResults(transmissionId: number, results: RecordStatusUpdate[]): Promise<void>;
    markTransmissionPolled(transmissionId: number): Promise<void>;
    areDependenciesVerified(agencyId: string, clientExternalId: string, employeeExternalId: string): Promise<boolean>;
    enqueueException(agencyId: string, input: ExceptionInput): Promise<void>;
}
//# sourceMappingURL=state-repository.d.ts.map