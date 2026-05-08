import type { Knex } from 'knex';
import type { Client, Authorization } from '../domain/client.js';
export declare class ClientRepository {
    private readonly db;
    constructor(db: Knex);
    createClient(agencyId: string, client: Client): Promise<Client>;
    createAuthorization(authorization: Authorization): Promise<Authorization>;
    private mapRowToClient;
    private mapRowToAuthorization;
}
//# sourceMappingURL=client-repository.d.ts.map