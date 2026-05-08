import type { Knex } from 'knex';
import type { AuditEvent } from '../domain/audit.js';
export declare class AuditRepository {
    private readonly db;
    constructor(db: Knex);
    append(event: Omit<AuditEvent, 'id' | 'createdAt'>): Promise<AuditEvent>;
    findByEntity(entityType: string, entityId: string): Promise<AuditEvent[]>;
    findByAgency(agencyId: string, limit?: number): Promise<AuditEvent[]>;
    private mapRow;
}
//# sourceMappingURL=audit-repository.d.ts.map