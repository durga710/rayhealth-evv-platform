import type { Knex } from 'knex';
import type { Client, Authorization } from '../domain/client.js';
export declare class ClientRepository {
    private readonly db;
    constructor(db: Knex);
    createClient(agencyId: string, client: Client): Promise<Client>;
    getClients(agencyId: string): Promise<Client[]>;
    createAuthorization(authorization: Authorization): Promise<Authorization>;
    getAuthorizations(agencyId: string): Promise<Authorization[]>;
    private mapRowToClient;
    private mapRowToAuthorization;
}
//# sourceMappingURL=client-repository.d.ts.map