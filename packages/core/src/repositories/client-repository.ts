import type { Knex } from 'knex';
import type { Client, Authorization } from '../domain/client.js';
import type { ImportClientRow, ImportAuthorizationRow } from '../services/import-service.js';
import { decryptCell, encryptCell } from '../security/cell-cipher.js';

export type ImportAction = 'created' | 'updated';

export class ClientRepository {
  constructor(private readonly db: Knex) {}

  async createClient(agencyId: string, client: Client): Promise<Client> {
    const [inserted] = await this.db('clients').insert({
      id: client.id ?? crypto.randomUUID(),
      agency_id: agencyId,
      first_name: client.firstName,
      last_name: client.lastName,
      date_of_birth: client.dateOfBirth,
      // Encrypt PHI Medicaid ID at write. Output is `v1:<base64>` ciphertext;
      // mapRowToClient decrypts on the way out.
      medicaid_number: encryptCell(client.medicaidNumber)
    }).returning('*');

    return this.mapRowToClient(inserted);
  }

  async getClients(agencyId: string): Promise<Client[]> {
    const rows = await this.db('clients').where({ agency_id: agencyId });
    return rows.map(row => this.mapRowToClient(row));
  }

  /**
   * Clients reachable by a family-role user via the `family_relationships`
   * link table. The family role's `client.read` capability used to surface
   * every client in the agency; this scopes it to the explicit relationships
   * a coordinator has approved.
   *
   * Also agency-scoped so a stale relationship row from before a client was
   * reassigned cannot leak across tenants.
   */
  async getClientsForFamilyMember(userId: string, agencyId: string): Promise<Client[]> {
    const rows = await this.db('clients as c')
      .join('family_relationships as fr', 'fr.client_id', 'c.id')
      .where('fr.family_user_id', userId)
      .andWhere('c.agency_id', agencyId)
      .select('c.*');
    return rows.map((row) => this.mapRowToClient(row));
  }

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
  async getClientGeofence(
    clientId: string,
    agencyId: string
  ): Promise<{ latitude: number | null; longitude: number | null; geofenceRadiusM: number | null } | undefined> {
    const row = await this.db('clients')
      .where({ id: clientId, agency_id: agencyId })
      .select('latitude', 'longitude', 'geofence_radius_m')
      .first();
    if (!row) return undefined;
    return {
      latitude: row.latitude === null || row.latitude === undefined ? null : Number(row.latitude),
      longitude: row.longitude === null || row.longitude === undefined ? null : Number(row.longitude),
      geofenceRadiusM:
        row.geofence_radius_m === null || row.geofence_radius_m === undefined
          ? null
          : Number(row.geofence_radius_m)
    };
  }

  /**
   * True when the client exists and belongs to the given agency. Used to guard
   * cross-tenant writes (e.g. creating an authorization for a clientId that
   * belongs to another agency).
   */
  async clientBelongsToAgency(clientId: string, agencyId: string): Promise<boolean> {
    const row = await this.db('clients')
      .where({ id: clientId, agency_id: agencyId })
      .first('id');
    return Boolean(row);
  }

  async createAuthorization(authorization: Authorization): Promise<Authorization> {
    const [inserted] = await this.db('authorizations').insert({
      id: authorization.id ?? crypto.randomUUID(),
      client_id: authorization.clientId,
      payer_id: authorization.payerId,
      units_authorized: authorization.unitsAuthorized,
      service_code: authorization.serviceCode,
      start_date: authorization.startDate,
      end_date: authorization.endDate
    }).returning('*');

    return this.mapRowToAuthorization(inserted);
  }

  /** Resolve a client's id from the source-system external_id (import linking). */
  async findIdByExternalId(agencyId: string, externalId: string): Promise<string | null> {
    const row = await this.db('clients')
      .where({ agency_id: agencyId, external_id: externalId })
      .first('id');
    return row ? (row.id as string) : null;
  }

  /**
   * Idempotent client upsert for the migration importer. Writes the full column
   * set (incl. address + geofence anchor + encrypted medicaid number). When
   * `externalId` is present and already known for this agency, the existing row
   * is updated; otherwise a new row is inserted. The CSV is treated as the
   * source of truth, so blank optional fields overwrite to null.
   */
  async upsertClientForImport(
    agencyId: string,
    row: ImportClientRow,
  ): Promise<{ id: string; action: ImportAction }> {
    const cols = {
      agency_id: agencyId,
      first_name: row.firstName,
      last_name: row.lastName,
      date_of_birth: row.dateOfBirth,
      medicaid_number: row.medicaidNumber !== undefined ? encryptCell(row.medicaidNumber) : null,
      address_line_1: row.addressLine1 ?? null,
      address_line_2: row.addressLine2 ?? null,
      city: row.city ?? null,
      state: row.state ?? null,
      postal_code: row.postalCode ?? null,
      latitude: row.latitude ?? null,
      longitude: row.longitude ?? null,
      geofence_radius_m: row.geofenceRadiusM ?? 150,
      external_id: row.externalId,
    };
    if (row.externalId) {
      const existing = await this.db('clients')
        .where({ agency_id: agencyId, external_id: row.externalId })
        .first('id');
      if (existing) {
        await this.db('clients')
          .where({ id: existing.id })
          .update({ ...cols, updated_at: this.db.fn.now() });
        return { id: existing.id as string, action: 'updated' };
      }
    }
    const [inserted] = await this.db('clients')
      .insert({ id: crypto.randomUUID(), ...cols })
      .returning('id');
    return { id: inserted.id as string, action: 'created' };
  }

  /**
   * Idempotent authorization upsert for the migration importer. The caller has
   * already resolved `clientId` from the row's client_external_id. When the
   * row's own `externalId` is present and already known for this client, the
   * existing authorization is updated; otherwise a new one is inserted.
   */
  async upsertAuthorizationForImport(
    clientId: string,
    row: ImportAuthorizationRow,
  ): Promise<{ id: string; action: ImportAction }> {
    const cols = {
      client_id: clientId,
      payer_id: row.payerId,
      units_authorized: row.unitsAuthorized,
      service_code: row.serviceCode,
      start_date: row.startDate,
      end_date: row.endDate,
      external_id: row.externalId,
    };
    if (row.externalId) {
      const existing = await this.db('authorizations')
        .where({ client_id: clientId, external_id: row.externalId })
        .first('id');
      if (existing) {
        await this.db('authorizations')
          .where({ id: existing.id })
          .update({ ...cols, updated_at: this.db.fn.now() });
        return { id: existing.id as string, action: 'updated' };
      }
    }
    const [inserted] = await this.db('authorizations')
      .insert({ id: crypto.randomUUID(), ...cols })
      .returning('id');
    return { id: inserted.id as string, action: 'created' };
  }

  async getAuthorizations(agencyId: string): Promise<Authorization[]> {
    const rows = await this.db('authorizations')
      .join('clients', 'authorizations.client_id', 'clients.id')
      .where('clients.agency_id', agencyId)
      .select('authorizations.*');
    return rows.map(row => this.mapRowToAuthorization(row));
  }

  private mapRowToClient(row: any): Client {
    return {
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      dateOfBirth: row.date_of_birth instanceof Date ? row.date_of_birth.toISOString().split('T')[0] : row.date_of_birth,
      // Decrypt at read. Legacy plaintext values round-trip; v1: ciphertext
      // returns the original Medicaid ID. Throws if ENCRYPTION_KEY is missing.
      medicaidNumber: decryptCell(row.medicaid_number) ?? undefined
    };
  }

  private mapRowToAuthorization(row: any): Authorization {
    return {
      id: row.id,
      clientId: row.client_id,
      payerId: row.payer_id,
      unitsAuthorized: Number(row.units_authorized),
      serviceCode: row.service_code,
      startDate: row.start_date instanceof Date ? row.start_date.toISOString().split('T')[0] : row.start_date,
      endDate: row.end_date instanceof Date ? row.end_date.toISOString().split('T')[0] : row.end_date
    };
  }
}
