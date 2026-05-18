import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import * as core from '@rayhealth/core';
import { createApp } from '../../app.js';
import { setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());

afterEach(() => {
  vi.restoreAllMocks();
});

// ------ Mock DB helpers ------

interface InviteFixture {
  id: string;
  agency_id: string;
  email: string;
  role: string;
  status: 'pending' | 'accepted' | 'revoked';
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

function fixtureInvite(overrides: Partial<InviteFixture> = {}): InviteFixture {
  const expiresInDays = 14;
  return {
    id: 'invite-1',
    agency_id: 'agency-1',
    email: 'maria@keystone.example',
    role: 'caregiver',
    status: 'pending',
    invited_by: 'user-admin-1',
    expires_at: new Date(Date.now() + expiresInDays * 86400000),
    token: 'token-abc-123',
    access_code: 'ABCD-1234',
    accepted_at: null,
    last_sent_at: null,
    first_name: 'Maria',
    last_name: 'Lopez',
    created_at: new Date(),
    ...overrides,
  };
}

interface MockState {
  invite: InviteFixture;
  existingUser: { id: string; email: string } | null;
  insertedCaregiver: Record<string, unknown> | null;
  insertedUser: Record<string, unknown> | null;
  inviteUpdated: boolean;
}

interface QueryShape {
  table: string;
  filters: Array<Record<string, unknown>>;
  insertRow: Record<string, unknown> | null;
}

function makeMockDb(state: MockState) {
  const buildBuilder = (table: string) => {
    const ctx: QueryShape = { table, filters: [], insertRow: null };
    const builder = {
      where(filter: Record<string, unknown>) {
        ctx.filters.push(filter);
        return builder;
      },
      insert(row: Record<string, unknown>) {
        ctx.insertRow = row;
        return builder;
      },
      async returning(_cols: string | string[]) {
        if (ctx.table === 'caregivers' && ctx.insertRow) {
          const out = {
            id: 'caregiver-1',
            agency_id: ctx.insertRow.agency_id,
            first_name: ctx.insertRow.first_name,
            last_name: ctx.insertRow.last_name,
            email: ctx.insertRow.email,
            phone: ctx.insertRow.phone ?? null,
            npi: null,
            hire_date: null,
            status: ctx.insertRow.status ?? 'active',
          };
          state.insertedCaregiver = out;
          return [out];
        }
        if (ctx.table === 'users' && ctx.insertRow) {
          const out = {
            id: 'user-new-1',
            agency_id: ctx.insertRow.agency_id,
            email: ctx.insertRow.email,
            password_hash: ctx.insertRow.password_hash,
            role: ctx.insertRow.role,
            caregiver_id: ctx.insertRow.caregiver_id ?? null,
          };
          state.insertedUser = out;
          return [out];
        }
        return [];
      },
      async first(col?: string) {
        if (ctx.table === 'staff_invites') {
          const filter = Object.assign({}, ...ctx.filters);
          if (filter.token === state.invite.token) return state.invite;
          return undefined;
        }
        if (ctx.table === 'agencies' && col === 'name') return { name: 'Keystone Home Care' };
        if (ctx.table === 'users') {
          const filter = Object.assign({}, ...ctx.filters);
          if (state.existingUser && filter.email === state.existingUser.email) {
            return {
              id: state.existingUser.id,
              email: state.existingUser.email,
              agency_id: 'agency-1',
              password_hash: 'hash',
              role: 'caregiver',
            };
          }
          return undefined;
        }
        return undefined;
      },
      async update(data: Record<string, unknown>) {
        if (ctx.table === 'staff_invites' && data.status === 'accepted') {
          state.inviteUpdated = true;
          state.invite.status = 'accepted';
          state.invite.accepted_at = (data.accepted_at as Date) ?? new Date();
          return 1;
        }
        return 1;
      },
      orderBy: async () => [],
      async count(_col: string) {
        return [{ count: '0' }];
      },
    };
    return builder;
  };

  const fn = ((table: string) => buildBuilder(table)) as unknown as {
    (table: string): ReturnType<typeof buildBuilder>;
    raw: (s: string) => string;
    fn: { now: () => string };
    transaction: <T>(cb: (trx: typeof fn) => Promise<T>) => Promise<T>;
  };
  fn.raw = (s: string) => s;
  fn.fn = { now: () => 'NOW()' };
  fn.transaction = async <T,>(cb: (trx: typeof fn) => Promise<T>) => cb(fn);
  return fn;
}

function mockAuditCreate(): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue({ id: 'audit-1' });
  vi.spyOn(core, 'AuditEventRepository').mockImplementation(function AuditEventRepositoryMock() {
    return { create: fn } as unknown as core.AuditEventRepository;
  } as unknown as typeof core.AuditEventRepository);
  return fn;
}

// ------ Tests ------

describe('invite acceptance routes', () => {
  describe('GET /invites/accept/:token', () => {
    it('returns invite info for a pending invite', async () => {
      mockAuditCreate();
      const state: MockState = {
        invite: fixtureInvite(),
        existingUser: null,
        insertedCaregiver: null,
        insertedUser: null,
        inviteUpdated: false,
      };

      const app = createApp();
      app.set('db', makeMockDb(state));

      const response = await request(app).get('/invites/accept/token-abc-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('maria@keystone.example');
      expect(response.body.data.role).toBe('caregiver');
      expect(response.body.data.firstName).toBe('Maria');
      expect(response.body.data.agencyName).toBe('Keystone Home Care');
      expect(response.body.data.status).toBe('pending');
      // Sensitive fields must not leak — no access_code, no token, no id
      expect(response.body.data.accessCode).toBeUndefined();
      expect(response.body.data.token).toBeUndefined();
      expect(response.body.data.id).toBeUndefined();
    });

    it('reports expired invites with status=expired', async () => {
      mockAuditCreate();
      const state: MockState = {
        invite: fixtureInvite({ expires_at: new Date(Date.now() - 86400000) }),
        existingUser: null,
        insertedCaregiver: null,
        insertedUser: null,
        inviteUpdated: false,
      };

      const app = createApp();
      app.set('db', makeMockDb(state));

      const response = await request(app).get('/invites/accept/token-abc-123');
      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('expired');
    });

    it('reports revoked invites with status=revoked', async () => {
      mockAuditCreate();
      const state: MockState = {
        invite: fixtureInvite({ status: 'revoked' }),
        existingUser: null,
        insertedCaregiver: null,
        insertedUser: null,
        inviteUpdated: false,
      };

      const app = createApp();
      app.set('db', makeMockDb(state));

      const response = await request(app).get('/invites/accept/token-abc-123');
      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('revoked');
    });

    it('returns 404 for unknown token', async () => {
      mockAuditCreate();
      const state: MockState = {
        invite: fixtureInvite(),
        existingUser: null,
        insertedCaregiver: null,
        insertedUser: null,
        inviteUpdated: false,
      };

      const app = createApp();
      app.set('db', makeMockDb(state));

      const response = await request(app).get('/invites/accept/wrong-token');
      expect(response.status).toBe(404);
    });

    it('does NOT require authentication', async () => {
      // Sanity check — no Authorization header present, and authContext is not invoked.
      mockAuditCreate();
      const state: MockState = {
        invite: fixtureInvite(),
        existingUser: null,
        insertedCaregiver: null,
        insertedUser: null,
        inviteUpdated: false,
      };

      const app = createApp();
      app.set('db', makeMockDb(state));

      const response = await request(app).get('/invites/accept/token-abc-123');
      expect(response.status).toBe(200);
    });
  });

  describe('POST /invites/accept/:token', () => {
    it('creates caregiver + user, marks invite accepted, returns bearer token', async () => {
      const audit = mockAuditCreate();
      const state: MockState = {
        invite: fixtureInvite(),
        existingUser: null,
        insertedCaregiver: null,
        insertedUser: null,
        inviteUpdated: false,
      };

      const app = createApp();
      app.set('db', makeMockDb(state));

      const response = await request(app)
        .post('/invites/accept/token-abc-123')
        .send({
          accessCode: 'abcd-1234', // lowercase + dash to verify normalization
          password: 'CorrectHorseStaple12!',
          firstName: 'Maria',
          lastName: 'Lopez',
          phone: '+1-555-0100',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeTruthy();
      expect(response.body.data.role).toBe('caregiver');
      expect(response.body.data.userId).toBe('user-new-1');
      expect(response.body.data.caregiverId).toBe('caregiver-1');

      expect(state.insertedCaregiver).toBeTruthy();
      expect(state.insertedCaregiver?.first_name).toBe('Maria');
      expect(state.insertedCaregiver?.phone).toBe('+1-555-0100');

      expect(state.insertedUser).toBeTruthy();
      expect(state.insertedUser?.email).toBe('maria@keystone.example');
      expect(state.insertedUser?.role).toBe('caregiver');
      // Password must be hashed — not stored plaintext.
      expect(state.insertedUser?.password_hash).not.toBe('CorrectHorseStaple12!');
      const matches = await bcrypt.compare(
        'CorrectHorseStaple12!',
        state.insertedUser?.password_hash as string,
      );
      expect(matches).toBe(true);

      expect(state.inviteUpdated).toBe(true);
      expect(audit).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'invite.accepted', outcome: 'success' }),
      );
    });

    it('rejects wrong access code with 401 and audits the failure', async () => {
      const audit = mockAuditCreate();
      const state: MockState = {
        invite: fixtureInvite(),
        existingUser: null,
        insertedCaregiver: null,
        insertedUser: null,
        inviteUpdated: false,
      };

      const app = createApp();
      app.set('db', makeMockDb(state));

      const response = await request(app)
        .post('/invites/accept/token-abc-123')
        .send({
          accessCode: 'WRONG-CODE',
          password: 'CorrectHorseStaple12!',
          firstName: 'Maria',
          lastName: 'Lopez',
        });

      expect(response.status).toBe(401);
      expect(state.insertedUser).toBeNull();
      expect(state.inviteUpdated).toBe(false);
      expect(audit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'invite.access_code_failed',
          outcome: 'failure',
        }),
      );
    });

    it('rejects short passwords with 400', async () => {
      mockAuditCreate();
      const state: MockState = {
        invite: fixtureInvite(),
        existingUser: null,
        insertedCaregiver: null,
        insertedUser: null,
        inviteUpdated: false,
      };

      const app = createApp();
      app.set('db', makeMockDb(state));

      const response = await request(app)
        .post('/invites/accept/token-abc-123')
        .send({
          accessCode: 'ABCD-1234',
          password: 'short',
          firstName: 'Maria',
          lastName: 'Lopez',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/at least 12/);
    });

    it('rejects expired invites with 410', async () => {
      mockAuditCreate();
      const state: MockState = {
        invite: fixtureInvite({ expires_at: new Date(Date.now() - 86400000) }),
        existingUser: null,
        insertedCaregiver: null,
        insertedUser: null,
        inviteUpdated: false,
      };

      const app = createApp();
      app.set('db', makeMockDb(state));

      const response = await request(app)
        .post('/invites/accept/token-abc-123')
        .send({
          accessCode: 'ABCD-1234',
          password: 'CorrectHorseStaple12!',
          firstName: 'Maria',
          lastName: 'Lopez',
        });

      expect(response.status).toBe(410);
      expect(response.body.error).toMatch(/expired/);
    });

    it('rejects revoked invites with 410', async () => {
      mockAuditCreate();
      const state: MockState = {
        invite: fixtureInvite({ status: 'revoked' }),
        existingUser: null,
        insertedCaregiver: null,
        insertedUser: null,
        inviteUpdated: false,
      };

      const app = createApp();
      app.set('db', makeMockDb(state));

      const response = await request(app)
        .post('/invites/accept/token-abc-123')
        .send({
          accessCode: 'ABCD-1234',
          password: 'CorrectHorseStaple12!',
          firstName: 'Maria',
          lastName: 'Lopez',
        });

      expect(response.status).toBe(410);
      expect(response.body.error).toMatch(/revoked/);
    });

    it('rejects already-accepted invites with 409', async () => {
      mockAuditCreate();
      const state: MockState = {
        invite: fixtureInvite({ status: 'accepted', accepted_at: new Date() }),
        existingUser: null,
        insertedCaregiver: null,
        insertedUser: null,
        inviteUpdated: false,
      };

      const app = createApp();
      app.set('db', makeMockDb(state));

      const response = await request(app)
        .post('/invites/accept/token-abc-123')
        .send({
          accessCode: 'ABCD-1234',
          password: 'CorrectHorseStaple12!',
          firstName: 'Maria',
          lastName: 'Lopez',
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toMatch(/already accepted/);
    });

    it('rejects when user with this email already exists', async () => {
      mockAuditCreate();
      const state: MockState = {
        invite: fixtureInvite(),
        existingUser: { id: 'user-existing-1', email: 'maria@keystone.example' },
        insertedCaregiver: null,
        insertedUser: null,
        inviteUpdated: false,
      };

      const app = createApp();
      app.set('db', makeMockDb(state));

      const response = await request(app)
        .post('/invites/accept/token-abc-123')
        .send({
          accessCode: 'ABCD-1234',
          password: 'CorrectHorseStaple12!',
          firstName: 'Maria',
          lastName: 'Lopez',
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toMatch(/already exists/);
      expect(state.inviteUpdated).toBe(false);
    });

    it('rejects missing firstName/lastName when invite did not pre-fill them', async () => {
      mockAuditCreate();
      const state: MockState = {
        invite: fixtureInvite({ first_name: null, last_name: null }),
        existingUser: null,
        insertedCaregiver: null,
        insertedUser: null,
        inviteUpdated: false,
      };

      const app = createApp();
      app.set('db', makeMockDb(state));

      const response = await request(app)
        .post('/invites/accept/token-abc-123')
        .send({ accessCode: 'ABCD-1234', password: 'CorrectHorseStaple12!' });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/firstName/);
    });
  });
});
