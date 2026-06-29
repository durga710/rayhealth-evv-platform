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
import { encryptCell, decryptCell } from '../security/cell-cipher.js';
function parseSettings(value) {
    if (value && typeof value === 'object' && !Array.isArray(value))
        return value;
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
        }
        catch {
            return {};
        }
    }
    return {};
}
function rowToPartial(row) {
    return {
        agencyId: row.agency_id,
        transport: row.transport || 'sftp',
        endpoint: row.endpoint ?? null,
        settings: parseSettings(row.settings),
        enabled: Boolean(row.enabled),
        hasCredentials: Boolean(row.credentials_encrypted),
    };
}
export class AgencyClearinghouseConfigRepository {
    constructor(db) {
        this.db = db;
    }
    async findByAgency(agencyId) {
        const row = (await this.db('agency_clearinghouse_config')
            .where({ agency_id: agencyId })
            .first());
        return row ? rowToPartial(row) : undefined;
    }
    /**
     * Returns the full submission config WITH decrypted credentials — for the
     * clearinghouse client only. Never expose this to an API response.
     */
    async findSubmissionConfig(agencyId) {
        const row = (await this.db('agency_clearinghouse_config')
            .where({ agency_id: agencyId })
            .first());
        if (!row)
            return undefined;
        let credentials = null;
        if (row.credentials_encrypted) {
            const plain = decryptCell(row.credentials_encrypted);
            if (plain) {
                try {
                    credentials = JSON.parse(plain);
                }
                catch {
                    credentials = null;
                }
            }
        }
        return {
            enabled: Boolean(row.enabled),
            transport: row.transport || 'sftp',
            endpoint: row.endpoint ?? null,
            credentials,
            settings: parseSettings(row.settings),
        };
    }
    async upsert(input) {
        const payload = {
            agency_id: input.agencyId,
            transport: input.transport || 'sftp',
            endpoint: input.endpoint,
            settings: JSON.stringify(input.settings ?? {}),
            enabled: input.enabled,
            updated_at: this.db.fn.now(),
        };
        if (input.credentials !== undefined) {
            payload.credentials_encrypted = input.credentials
                ? encryptCell(JSON.stringify(input.credentials))
                : null;
        }
        await this.db('agency_clearinghouse_config')
            .insert({ ...payload, created_at: this.db.fn.now() })
            .onConflict('agency_id')
            .merge(payload);
        const stored = await this.findByAgency(input.agencyId);
        if (!stored) {
            throw new Error(`upsert succeeded but no row found for agency=${input.agencyId}`);
        }
        return stored;
    }
}
//# sourceMappingURL=agency-clearinghouse-config-repository.js.map