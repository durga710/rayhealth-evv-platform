import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as core from '@rayhealth/core';
import { createApp } from '../../app.js';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());

afterEach(() => {
  vi.restoreAllMocks();
});

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

function mockAuditCreate(): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue({ id: 'audit-1' });
  vi.spyOn(core, 'AuditEventRepository').mockImplementation(function AuditEventRepositoryMock() {
    return { create: fn } as unknown as core.AuditEventRepository;
  } as unknown as typeof core.AuditEventRepository);
  return fn;
}

// ---- Shared fixture helpers ----

interface InviteFixture {
  id: string;
  agency_id: string;
  email: string;
  role: string;
  status: string;
  invited_by: string;
  expires_at: Date;
  token: string;
  access_code: string;
  accepted_at: Date | null;
  last_sent_at: Date | null;
  first_name: string | null;
  last_name: string | null;
  created_at: Date;
}

function makeInviteFixture(overrides: Partial<InviteFixture> = {}): InviteFixture {
  return {
    id: 'invite-1',
    agency_id: 'agency-1',
    email: 'maria@keystone.example',
    role: 'caregiver',
    status: 'pending',
    invited_by: 'user-1',
    expires_at: new Date(Date.now() + 14 * 86400000),
    token: 'tok-abc',
    access_code: 'ABCD-1234',
    accepted_at: null,
    last_sent_at: null,
    first_name: 'Maria',
    last_name: 'Lopez',
    created_at: new Date(),
    ...overrides,
  };
}

/**
 * Mock DB for read/update operations against an existing invite row.
 * `updateCount` controls the value that `.update()` resolves with
 * (1 = found+updated, 0 = not-found/already-resolved → 404).
 */
function makeDbWithInvite(invite: InviteFixture | null, updateCount = 1): KnexLike {
  const builder: KnexBuilder = {
    insert: () => builder,
    returning: async () => [],
    where: () => builder,
    first: async (col?: string) => {
      if (col === 'name') return { name: 'Test Agency' };
      return invite ?? undefined;
    },
    update: async () => updateCount,
    orderBy: async () => (invite ? [invite] : []),
  };
  const fn = ((_table: string) => builder) as KnexLike;
  fn.raw = (s: string) => s;
  fn.fn = { now: () => 'NOW()' };
  return fn;
}

// ---- Tests ----

describe('POST /invites (create)', () => {
  it('creates a pending invite and returns it with an acceptance URL', async () => {
    mockAuditCreate();
    const app = createApp();
    app.set('db', makeMockDb());

    const response = await request(app)
      .post('/invites')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ email: 'caregiver@keystone.example', role: 'caregiver', firstName: 'Maria' });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.email).toBe('caregiver@keystone.example');
    expect(response.body.data.role).toBe('caregiver');
    expect(response.body.data.status).toBe('pending');
    expect(response.body.data.acceptanceUrl).toMatch(/\/accept\//);
    // RESEND_API_KEY not set in test env → emailSent should be false but invite still created
    expect(response.body.emailSent).toBe(false);
  });

  it('rejects invalid email with 400', async () => {
    mockAuditCreate();
    const app = createApp();
    app.set('db', makeMockDb());

    const response = await request(app)
      .post('/invites')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ email: 'not-an-email', role: 'caregiver' });

    expect(response.status).toBe(400);
  });

  it('rejects invalid role with 400', async () => {
    mockAuditCreate();
    const app = createApp();
    app.set('db', makeMockDb());

    const response = await request(app)
      .post('/invites')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ email: 'a@b.com', role: 'wizard' });

    expect(response.status).toBe(400);
  });
});

describe('POST /invites/:id/resend', () => {
  it('resends a pending invite (no RESEND_API_KEY in test → emailSent false)', async () => {
    mockAuditCreate();
    const app = createApp();
    app.set('db', makeDbWithInvite(makeInviteFixture()));

    const response = await request(app)
      .post('/invites/invite-1/resend')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe('invite-1');
    expect(response.body.data.email).toBe('maria@keystone.example');
    expect(response.body.emailSent).toBe(false);
    // Sensitive fields must not appear in the public shape.
    expect(response.body.data.token).toBeUndefined();
    expect(response.body.data.access_code).toBeUndefined();
  });

  it('returns 404 when invite is not found', async () => {
    mockAuditCreate();
    const app = createApp();
    app.set('db', makeDbWithInvite(null));

    const response = await request(app)
      .post('/invites/nonexistent/resend')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({});

    expect(response.status).toBe(404);
  });

  it('returns 409 when invite is already accepted', async () => {
    mockAuditCreate();
    const app = createApp();
    app.set('db', makeDbWithInvite(makeInviteFixture({ status: 'accepted' })));

    const response = await request(app)
      .post('/invites/invite-1/resend')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({});

    expect(response.status).toBe(409);
    expect(response.body.error).toMatch(/accepted/);
  });

  it('returns 409 when invite is already revoked', async () => {
    mockAuditCreate();
    const app = createApp();
    app.set('db', makeDbWithInvite(makeInviteFixture({ status: 'revoked' })));

    const response = await request(app)
      .post('/invites/invite-1/resend')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({});

    expect(response.status).toBe(409);
    expect(response.body.error).toMatch(/revoked/);
  });
});

describe('POST /invites/:id/revoke', () => {
  it('revokes a pending invite and returns success', async () => {
    mockAuditCreate();
    const app = createApp();
    app.set('db', makeDbWithInvite(makeInviteFixture(), 1));

    const response = await request(app)
      .post('/invites/invite-1/revoke')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('returns 404 when invite is not found or already resolved', async () => {
    mockAuditCreate();
    const app = createApp();
    // updateCount=0 simulates no matching pending invite (already revoked/accepted or wrong id)
    app.set('db', makeDbWithInvite(makeInviteFixture(), 0));

    const response = await request(app)
      .post('/invites/not-found/revoke')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({});

    expect(response.status).toBe(404);
  });
});

describe('GET /invites', () => {
  it('returns empty list when agency has no invites', async () => {
    const app = createApp();
    app.set('db', makeDbWithInvite(null));

    const response = await request(app)
      .get('/invites')
      .set('Authorization', `Bearer ${makeToken('admin')}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual([]);
  });

  it('returns invites with public shape and no sensitive field leakage', async () => {
    const app = createApp();
    app.set('db', makeDbWithInvite(makeInviteFixture()));

    const response = await request(app)
      .get('/invites')
      .set('Authorization', `Bearer ${makeToken('admin')}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    const item = response.body.data[0];
    expect(item.email).toBe('maria@keystone.example');
    expect(item.role).toBe('caregiver');
    expect(item.status).toBe('pending');
    expect(item.acceptanceUrl).toMatch(/\/accept\//);
    // Raw token and access_code must never appear in the list response.
    expect(item.token).toBeUndefined();
    expect(item.access_code).toBeUndefined();
  });
});
