import type { Knex } from 'knex';
import type { Client, Authorization } from '../domain/client.js';
import type { ImportClientRow, ImportAuthorizationRow } from '../services/import-service.js';
export type ImportAction = 'created' | 'updated';
export declare class ClientRepository {
    private readonly db;
    constructor(db: Knex);
    createClient(agencyId: string, client: Client): Promise<Client>;
    getClients(agencyId: string): Promise<Client[]>;
    /**
     * Clients reachable by a family-role user via the `family_relationships`
     * link table. The family role's `client.read` capability used to surface
     * every client in the agency; this scopes it to the explicit relationships
     * a coordinator has approved.
     *
     * Also agency-scoped so a stale relationship row from before a client was
     * reassigned cannot leak across tenants.
     */
    getClientsForFamilyMember(userId: string, agencyId: string): Promise<Client[]>;
    /**
     * Reads the client's geofence anchor — registered street-address GPS plus
     * the per-client allowed radius — for EVV clock-in / clock-out validation.
     *
     * Tenant-scoped via `agency_id` so a caregiver in agency A can never probe
     * a client UUID from agency B. Returns undefined when the client row does
     * not exist or belongs to a different tenant; the caller MUST treat that
     * as "client not found" rather than fail-open through the geofence.
     *
     * Numeric columns come back from pg as strings (decimal/numeric); we
     * coerce to JS numbers here so callers don't have to repeat the dance.
     */
    getClientGeofence(clientId: string, agencyId: string): Promise<{
        latitude: number | null;
        longitude: number | null;
        geofenceRadiusM: number | null;
    } | undefined>;
    /**
     * True when the client exists and belongs to the given agency. Used to guard
     * cross-tenant writes (e.g. creating an authorization for a clientId that
     * belongs to another agency).
     */
    clientBelongsToAgency(clientId: string, agencyId: string): Promise<boolean>;
    createAuthorization(authorization: Authorization): Promise<Authorization>;
    /** Resolve a client's id from the source-system external_id (import linking). */
    findIdByExternalId(agencyId: string, externalId: string): Promise<string | null>;
    /**
     * Idempotent client upsert for the migration importer. Writes the full column
     * set (incl. address + geofence anchor + encrypted medicaid number). When
     * `externalId` is present and already known for this agency, the existing row
     * is updated; otherwise a new row is inserted. The CSV is treated as the
     * source of truth, so blank optional fields overwrite to null.
     */
    upsertClientForImport(agencyId: string, row: ImportClientRow): Promise<{
        id: string;
        action: ImportAction;
    }>;
    /**
     * Idempotent authorization upsert for the migration importer. The caller has
     * already resolved `clientId` from the row's client_external_id. When the
     * row's own `externalId` is present and already known for this client, the
     * existing authorization is updated; otherwise a new one is inserted.
     */
    upsertAuthorizationForImport(clientId: string, row: ImportAuthorizationRow): Promise<{
        id: string;
        action: ImportAction;
    }>;
    getAuthorizations(agencyId: string): Promise<Authorization[]>;
    private mapRowToClient;
    private mapRowToAuthorization;
}
//# sourceMappingURL=client-repository.d.ts.map