/**
 * Sandata Alternate-EVV REST transport.
 *
 * Thin wrapper over the shared `http` helpers implementing Sandata's async
 * contract: POST a batch of CLIENT/EMPLOYEE/VISIT records → receive a UUID,
 * then GET `/{entity}/status/{uuid}` to retrieve per-record ACCEPTED / REJECTED
 * / EXCEPTION results once Sandata has processed them.
 *
 * Authentication is HTTP Basic; multi-agency (MCO / vendor) transmissions add an
 * `EntityGuid` header. The client performs NO validation or persistence — it is
 * pure transport; the transmission service owns sequencing, state, and retries.
 */
import { SandataEntityType, type SandataAltEvvConfig, type SandataClient, type SandataEmployee, type SandataPostResponse, type SandataStatusResponse, type SandataVisit } from './types.js';
export type SandataEntityRecord = SandataClient | SandataEmployee | SandataVisit;
/** Outcome of a POST: either Sandata accepted the batch (uuid) or it failed. */
export type SandataPostOutcome = {
    kind: 'accepted';
    uuid: string;
    raw: SandataPostResponse;
} | {
    kind: 'error';
    message: string;
    status: number;
    retryable: boolean;
};
/** Outcome of a status poll. `not_ready` means keep the transmission pending. */
export type SandataStatusOutcome = {
    kind: 'ready';
    response: SandataStatusResponse;
} | {
    kind: 'not_ready';
} | {
    kind: 'error';
    message: string;
    status: number;
    retryable: boolean;
};
export declare class SandataApiClient {
    private readonly config;
    constructor(config: SandataAltEvvConfig);
    private baseUrl;
    private headers;
    /** True for transient failures (5xx / network) where a retry is sane. */
    private isRetryable;
    /** POST a single-entity batch. Returns the Sandata UUID or a classified error. */
    post(entity: SandataEntityType, batch: SandataEntityRecord[]): Promise<SandataPostOutcome>;
    /** GET processing status for a previously-posted batch UUID. */
    getStatus(entity: SandataEntityType, uuid: string): Promise<SandataStatusOutcome>;
}
//# sourceMappingURL=api-client.d.ts.map