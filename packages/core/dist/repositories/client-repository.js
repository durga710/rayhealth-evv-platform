export class ClientRepository {
    constructor(db) {
        this.db = db;
    }
    async createClient(agencyId, client) {
        const [inserted] = await this.db('clients').insert({
            id: client.id ?? crypto.randomUUID(),
            agency_id: agencyId,
            first_name: client.firstName,
            last_name: client.lastName,
            date_of_birth: client.dateOfBirth,
            medicaid_number: client.medicaidNumber
        }).returning('*');
        return this.mapRowToClient(inserted);
    }
    async createAuthorization(authorization) {
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
    mapRowToClient(row) {
        return {
            id: row.id,
            firstName: row.first_name,
            lastName: row.last_name,
            dateOfBirth: row.date_of_birth instanceof Date ? row.date_of_birth.toISOString().split('T')[0] : row.date_of_birth,
            medicaidNumber: row.medicaid_number
        };
    }
    mapRowToAuthorization(row) {
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
//# sourceMappingURL=client-repository.js.map