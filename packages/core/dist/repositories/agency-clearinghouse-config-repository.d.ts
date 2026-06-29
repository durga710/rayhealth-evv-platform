/**
 * Repository for the `agency_clearinghouse_config` table.
 *
 * Stores per-agency claim-clearinghouse connection details: transport ('sftp'
 * or 'http'), endpoint, an AES-256-GCM encrypted credentials blob, and a
 * free-form settings object (submitter id, receiver id, directories). Parallel
 * in shape to the Sandata / HHAeXchange config repos.
 *
 * `findByAgency` returns a partial view with a `hasCredentials` flag for the
 * admin UI — the plaintext secret is never returned there. `findSubmissionConfig`
 * decrypts and is for the clearinghouse client only.
 */
import type { Knex } from 'knex';
import type { IntegrationCredentials } from '../integrations/types.js';
import type { ClearinghouseClientConfig } from '../integrations/clearinghouse-client.js';
export interface PartialClearinghouseConfig {
    agencyId: string;
    transport: string;
    endpoint: string | null;
    settings: Record<string, unknown>;
    enabled: boolean;
    /** Read-only indicator — plaintext credentials are never returned to callers. */
    hasCredentials: boolean;
}
/**
 * Upsert input. `credentials` is write-only and tri-state:
 *   undefined → leave the stored credentials unchanged
 *   null      → clear the stored credentials
 *   object    → encrypt (AES-256-GCM) and store
 */
export interface ClearinghouseConfigUpsert {
    agencyId: string;
    transport: string;
    endpoint: string | null;
    settings: Record<string, unknown>;
    enabled: boolean;
    credentials?: IntegrationCredentials | null;
}
export declare class AgencyClearinghouseConfigRepository {
    private readonly db;
    constructor(db: Knex);
    findByAgency(agencyId: string): Promise<PartialClearinghouseConfig | undefined>;
    /**
     * Returns the full submission config WITH decrypted credentials — for the
     * clearinghouse client only. Never expose this to an API response.
     */
    findSubmissionConfig(agencyId: string): Promise<ClearinghouseClientConfig | undefined>;
    upsert(input: ClearinghouseConfigUpsert): Promise<PartialClearinghouseConfig>;
}
//# sourceMappingURL=agency-clearinghouse-config-repository.d.ts.map