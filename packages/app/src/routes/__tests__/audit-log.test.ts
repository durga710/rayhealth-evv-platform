import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as core from '@rayhealth/core';
import { createApp } from '../../app.js';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());

afterEach(() => {
  vi.restoreAllMocks();
});

function mockAuditEventRepository(createAuditEvent: ReturnType<typeof vi.fn>): void {
  vi.spyOn(core, 'AuditEventRepository').mockImplementation(function AuditEventRepositoryMock() {
    return { create: createAuditEvent } as unknown as core.AuditEventRepository;
  } as unknown as typeof core.AuditEventRepository);
}

interface KnexLike {
  (table: string): KnexBuilder;
  raw: (s: string) => string;
  fn: { now: () => string };
}
interface KnexBuilder {
  insert: (row: unknown) => KnexBuilder;
  returning: (cols: string | string[]) => Promise<unknown[]>;
  where: (filter: unknown) => KnexBuilder;
  first: (col?: string) => Promise<unknown>;
  update: (data: unknown) => Promise<number>;
  orderBy: (col: string, dir?: string) => Promise<unknown[]>;
}

// Minimal mock db so the new invite route's DB writes succeed and the audit-log
// middleware still fires.
function makeMockDb(): KnexLike {
  let insertedRow: Record<string, unknown> | null = null;
  const builder: KnexBuilder = {
    insert: (row: unknown) => {
      insertedRow = {
        ...(row as Record<string, unknown>),
        id: 'invite-1',
        created_at: new Date(),
      };
      return builder;
    },
    returning: async () => (insertedRow ? [insertedRow] : []),
    where: () => builder,
    first: async (col?: string) => {
      if (col === 'name') return { name: 'Test Agency' };
      return insertedRow;
    },
    update: async () => 1,
    orderBy: async () => (insertedRow ? [insertedRow] : []),
  };
  const fn = ((_table: string) => builder) as KnexLike;
  fn.raw = (s: string) => s;
  fn.fn = { now: () => 'NOW()' };
  return fn;
}

describe('audit logging middleware', () => {
  it('persists a structured audit event for protected write requests', async () => {
    const createAuditEvent = vi.fn().mockResolvedValue({});
    mockAuditEventRepository(createAuditEvent);
    const app = createApp();
    app.set('db', makeMockDb());

    const response = await request(app)
      .post('/invites')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ email: 'caregiver@keystone.example', role: 'caregiver' });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(response.status).toBe(201);
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'request.write',
      outcome: 'success',
      payload: expect.objectContaining({
        method: 'POST',
        path: '/invites',
        authMethod: 'bearer'
      })
    }));
  });

  it('records the actual resource name when protected writes arrive through /api', async () => {
    const createAuditEvent = vi.fn().mockResolvedValue({});
    mockAuditEventRepository(createAuditEvent);
    const app = createApp();
    app.set('db', makeMockDb());

    const response = await request(app)
      .post('/api/invites')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ email: 'caregiver@keystone.example', role: 'caregiver' });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(response.status).toBe(201);
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'invites',
      payload: expect.objectContaining({
        path: '/api/invites'
      })
    }));
  });
});
