export class AuditRepository {
    constructor(db) {
        this.db = db;
    }
    async append(event) {
        const [row] = await this.db('audit_events').insert({
            id: this.db.raw('gen_random_uuid()'),
            agency_id: event.agencyId,
            actor_id: event.actorId,
            event_type: event.eventType,
            entity_type: event.entityType,
            entity_id: event.entityId,
            payload: JSON.stringify(event.payload ?? {}),
        }).returning('*');
        return this.mapRow(row);
    }
    async findByEntity(entityType, entityId) {
        const rows = await this.db('audit_events')
            .where({ entity_type: entityType, entity_id: entityId })
            .orderBy('created_at', 'desc');
        return rows.map((r) => this.mapRow(r));
    }
    async findByAgency(agencyId, limit = 100) {
        const rows = await this.db('audit_events')
            .where({ agency_id: agencyId })
            .orderBy('created_at', 'desc')
            .limit(limit);
        return rows.map((r) => this.mapRow(r));
    }
    mapRow(row) {
        return {
            id: row.id,
            agencyId: row.agency_id,
            actorId: row.actor_id,
            eventType: row.event_type,
            entityType: row.entity_type,
            entityId: row.entity_id,
            payload: typeof row.payload === 'string'
                ? JSON.parse(row.payload)
                : row.payload,
            createdAt: row.created_at instanceof Date
                ? row.created_at.toISOString()
                : row.created_at,
        };
    }
}
//# sourceMappingURL=audit-repository.js.map