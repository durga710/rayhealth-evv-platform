import type { Knex } from 'knex';
import type { AuditEvent } from '../domain/audit.js';

export class AuditRepository {
  constructor(private readonly db: Knex) {}

  async append(event: Omit<AuditEvent, 'id' | 'createdAt'>): Promise<AuditEvent> {
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

  async findByEntity(entityType: string, entityId: string): Promise<AuditEvent[]> {
    const rows = await this.db('audit_events')
      .where({ entity_type: entityType, entity_id: entityId })
      .orderBy('created_at', 'desc');
    return rows.map((r: Record<string, unknown>) => this.mapRow(r));
  }

  async findByAgency(agencyId: string, limit = 100): Promise<AuditEvent[]> {
    const rows = await this.db('audit_events')
      .where({ agency_id: agencyId })
      .orderBy('created_at', 'desc')
      .limit(limit);
    return rows.map((r: Record<string, unknown>) => this.mapRow(r));
  }

  private mapRow(row: Record<string, unknown>): AuditEvent {
    return {
      id: row.id as string,
      agencyId: row.agency_id as string,
      actorId: row.actor_id as string,
      eventType: row.event_type as AuditEvent['eventType'],
      entityType: row.entity_type as string,
      entityId: row.entity_id as string,
      payload: typeof row.payload === 'string'
        ? JSON.parse(row.payload)
        : row.payload as Record<string, unknown>,
      createdAt: row.created_at instanceof Date
        ? row.created_at.toISOString()
        : row.created_at as string,
    };
  }
}
