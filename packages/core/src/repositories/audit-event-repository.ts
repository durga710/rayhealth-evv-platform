import type { Knex } from 'knex';
import type { AuditEvent } from '../domain/audit.js';

export type NewAuditEvent = Omit<AuditEvent, 'id' | 'createdAt'>;

type AuditEventRow = {
  id: string;
  agency_id: string;
  actor_id: string;
  actor_type?: string | null;
  event_type: AuditEvent['eventType'];
  entity_type: string;
  entity_id: string;
  outcome?: AuditEvent['outcome'] | null;
  correlation_id?: string | null;
  payload?: Record<string, unknown> | string | null;
  occurred_at?: Date | string | null;
  created_at?: Date | string | null;
};

function toIso(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function parsePayload(payload: AuditEventRow['payload']): Record<string, unknown> {
  if (!payload) return {};
  return typeof payload === 'string' ? JSON.parse(payload) as Record<string, unknown> : payload;
}

export class AuditEventRepository {
  constructor(protected readonly db: Knex) {}

  async create(event: NewAuditEvent): Promise<AuditEvent> {
    const [row] = await this.db('audit_events')
      .insert({
        id: this.db.raw('gen_random_uuid()'),
        agency_id: event.agencyId,
        actor_id: event.actorId,
        actor_type: event.actorType,
        event_type: event.eventType,
        entity_type: event.entityType,
        entity_id: event.entityId,
        outcome: event.outcome,
        correlation_id: event.correlationId ?? null,
        payload: event.payload ?? {},
        occurred_at: event.occurredAt ?? this.db.fn.now()
      })
      .returning('*');

    return this.mapRow(row);
  }

  async findByEntity(entityType: string, entityId: string): Promise<AuditEvent[]> {
    const rows = await this.db('audit_events')
      .where({ entity_type: entityType, entity_id: entityId })
      .orderBy('occurred_at', 'desc');
    return rows.map((row) => this.mapRow(row));
  }

  async findByAgency(agencyId: string, limit = 100): Promise<AuditEvent[]> {
    const rows = await this.db('audit_events')
      .where({ agency_id: agencyId })
      .orderBy('occurred_at', 'desc')
      .limit(limit);
    return rows.map((row) => this.mapRow(row));
  }

  /**
   * Aggregate retention status for the agency's audit_events. Used by
   * the admin /admin/audit-retention/status endpoint as HIPAA evidence
   * (45 CFR §164.530(j) — 6-year retention floor for audit logs).
   *
   * Returns:
   *   - totalRows         : every audit_event for this agency
   *   - oldestOccurredAt  : ISO timestamp of the earliest record
   *   - eventsLast30Days  : recent activity sanity-check
   *   - eventsApproachingSixYearLimit : rows older than 5y 9m — the
   *                                     bucket that needs cold-storage
   *                                     extraction in the next 90 days
   *
   * Read-only: never mutates audit_events (the table is enforced
   * append-only at the DB layer via `audit_events_block_mutation_trg`).
   */
  async getRetentionStats(agencyId: string): Promise<{
    totalRows: number;
    oldestOccurredAt: string | null;
    eventsLast30Days: number;
    eventsApproachingSixYearLimit: number;
  }> {
    const base = () => this.db('audit_events').where({ agency_id: agencyId });

    const [{ count: totalRowsRaw }] = await base().count<{ count: string | number }[]>('id as count');
    const totalRows = Number(totalRowsRaw ?? 0);

    const oldestRow = await base().orderBy('occurred_at', 'asc').first('occurred_at');
    const oldestOccurredAt = toIso((oldestRow as { occurred_at?: Date | string | null } | undefined)?.occurred_at) ?? null;

    const [{ count: recentRaw }] = await base()
      .whereRaw("occurred_at >= now() - interval '30 days'")
      .count<{ count: string | number }[]>('id as count');
    const eventsLast30Days = Number(recentRaw ?? 0);

    const [{ count: approachingRaw }] = await base()
      .whereRaw("occurred_at < now() - interval '5 years 9 months'")
      .count<{ count: string | number }[]>('id as count');
    const eventsApproachingSixYearLimit = Number(approachingRaw ?? 0);

    return {
      totalRows,
      oldestOccurredAt,
      eventsLast30Days,
      eventsApproachingSixYearLimit
    };
  }

  protected mapRow(row: AuditEventRow): AuditEvent {
    return {
      id: row.id,
      agencyId: row.agency_id,
      actorId: row.actor_id,
      actorType: row.actor_type as AuditEvent['actorType'] ?? 'user',
      eventType: row.event_type,
      entityType: row.entity_type,
      entityId: row.entity_id,
      outcome: row.outcome ?? 'success',
      correlationId: row.correlation_id ?? undefined,
      payload: parsePayload(row.payload),
      occurredAt: toIso(row.occurred_at),
      createdAt: toIso(row.created_at)
    };
  }
}
