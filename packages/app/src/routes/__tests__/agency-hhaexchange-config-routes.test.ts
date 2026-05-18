import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as core from '@rayhealth/core';
import { createApp } from '../../app.js';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());

afterEach(() => {
  vi.restoreAllMocks();
});

const AGENCY_ID = '00000000-0000-4000-8000-00000000aaaa';
const USER_ID = '00000000-0000-4000-8000-00000000bbbb';
const CAREGIVER_ID = '00000000-0000-4000-8000-00000000cccc';

function token(role: Parameters<typeof makeToken>[0]): string {
  return makeToken(role, AGENCY_ID, USER_ID);
}

function makeMockDb() {
  // The repository is mocked separately via spyOn — db just needs to be
  // truthy and expose the standard knex surface so the route doesn't trip
  // on the existence check.
  const builder = {
    where: () => builder,
    first: async () => undefined,
    insert: () => builder,
    onConflict: () => builder,
    merge: async () => 1,
    update: async () => 1,
  };
  const fn = ((_t: string) => builder) as unknown as {
    (t: string): typeof builder;
    fn: { now: () => string };
    raw: (s: string) => string;
  };
  fn.fn = { now: () => 'NOW()' };
  fn.raw = (s: string) => s;
  return fn;
}

function mockRepo(seed: {
  current?: core.PartialHhaexchangeConfig;
  upserted?: core.PartialHhaexchangeConfig;
}): {
  findByAgency: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
} {
  const findByAgency = vi.fn().mockResolvedValue(seed.current);
  const upsert = vi.fn().mockImplementation((input: core.PartialHhaexchangeConfig) =>
    Promise.resolve(seed.upserted ?? input),
  );
  vi.spyOn(core, 'AgencyHhaexchangeConfigRepository').mockImplementation(function () {
    return {
      findByAgency,
      findValid: vi.fn(),
      upsert,
    } as unknown as core.AgencyHhaexchangeConfigRepository;
  } as unknown as typeof core.AgencyHhaexchangeConfigRepository);

  vi.spyOn(core, 'AuditEventRepository').mockImplementation(function () {
    return { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) } as unknown as core.AuditEventRepository;
  } as unknown as typeof core.AuditEventRepository);

  return { findByAgency, upsert };
}

describe('GET /agencies/me/hhaexchange-config', () => {
  it('returns an empty default when the agency has no row', async () => {
    mockRepo({});

    const app = createApp();
    app.set('db', makeMockDb());

    const response = await request(app)
      .get('/agencies/me/hhaexchange-config')
      .set('Authorization', `Bearer ${token('admin')}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.agencyTaxId).toBeNull();
    expect(response.body.data.hhaProviderId).toBeNull();
    expect(response.body.data.caregivers).toEqual([]);
    expect(response.body.data.services).toEqual([]);
    expect(response.body.data.enabled).toBe(false);
  });

  it('returns the stored config when one exists', async () => {
    mockRepo({
      current: {
        agencyId: AGENCY_ID,
        agencyTaxId: '123456789',
        hhaProviderId: 'P-100',
        timezone: 'America/New_York',
        caregivers: [{ caregiverId: CAREGIVER_ID, employeeId: 'E-1' }],
        services: [
          { internalServiceCode: 'PC', hhaServiceCode: '1051', label: 'Personal Care' },
        ],
        enabled: true,
      },
    });

    const app = createApp();
    app.set('db', makeMockDb());

    const response = await request(app)
      .get('/agencies/me/hhaexchange-config')
      .set('Authorization', `Bearer ${token('coordinator')}`);

    expect(response.status).toBe(200);
    expect(response.body.data.agencyTaxId).toBe('123456789');
    expect(response.body.data.caregivers).toHaveLength(1);
    expect(response.body.data.enabled).toBe(true);
  });
});

describe('PUT /agencies/me/hhaexchange-config', () => {
  it('rejects non-admins with 403', async () => {
    mockRepo({});
    const app = createApp();
    app.set('db', makeMockDb());

    const response = await request(app)
      .put('/agencies/me/hhaexchange-config')
      .set('Authorization', `Bearer ${token('coordinator')}`)
      .send({ agencyTaxId: '123456789', hhaProviderId: 'P-100' });

    expect(response.status).toBe(403);
  });

  it('rejects malformed tax IDs with 400', async () => {
    mockRepo({});
    const app = createApp();
    app.set('db', makeMockDb());

    const response = await request(app)
      .put('/agencies/me/hhaexchange-config')
      .set('Authorization', `Bearer ${token('admin')}`)
      .send({ agencyTaxId: '12-3456789' }); // dashes rejected

    expect(response.status).toBe(400);
  });

  it('persists the identity fields and merges with previous mappings', async () => {
    const { upsert } = mockRepo({
      current: {
        agencyId: AGENCY_ID,
        agencyTaxId: null,
        hhaProviderId: null,
        timezone: 'America/New_York',
        caregivers: [{ caregiverId: CAREGIVER_ID, employeeId: 'E-1' }],
        services: [],
        enabled: false,
      },
    });

    const app = createApp();
    app.set('db', makeMockDb());

    const response = await request(app)
      .put('/agencies/me/hhaexchange-config')
      .set('Authorization', `Bearer ${token('admin')}`)
      .send({ agencyTaxId: '123456789', hhaProviderId: 'P-100' });

    expect(response.status).toBe(200);
    // The PUT didn't touch caregivers — merge should preserve them.
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        agencyTaxId: '123456789',
        hhaProviderId: 'P-100',
        caregivers: [{ caregiverId: CAREGIVER_ID, employeeId: 'E-1' }],
      }),
    );
  });

  it('rejects enabled=true when identity fields are missing with 422', async () => {
    mockRepo({
      current: {
        agencyId: AGENCY_ID,
        agencyTaxId: null,
        hhaProviderId: 'P-100',
        timezone: 'America/New_York',
        caregivers: [],
        services: [],
        enabled: false,
      },
    });

    const app = createApp();
    app.set('db', makeMockDb());

    const response = await request(app)
      .put('/agencies/me/hhaexchange-config')
      .set('Authorization', `Bearer ${token('admin')}`)
      .send({ enabled: true });

    expect(response.status).toBe(422);
    expect(response.body.error).toMatch(/agencyTaxId/);
  });

  it('allows enabled=true when identity fields are present', async () => {
    const { upsert } = mockRepo({
      current: {
        agencyId: AGENCY_ID,
        agencyTaxId: '123456789',
        hhaProviderId: 'P-100',
        timezone: 'America/New_York',
        caregivers: [],
        services: [],
        enabled: false,
      },
    });

    const app = createApp();
    app.set('db', makeMockDb());

    const response = await request(app)
      .put('/agencies/me/hhaexchange-config')
      .set('Authorization', `Bearer ${token('admin')}`)
      .send({ enabled: true });

    expect(response.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true, agencyTaxId: '123456789' }),
    );
  });

  it('rejects malformed caregiver mappings with 400', async () => {
    mockRepo({});
    const app = createApp();
    app.set('db', makeMockDb());

    const response = await request(app)
      .put('/agencies/me/hhaexchange-config')
      .set('Authorization', `Bearer ${token('admin')}`)
      .send({
        caregivers: [{ caregiverId: 'not-a-uuid', employeeId: 'E-1' }],
      });

    expect(response.status).toBe(400);
  });

  it('rejects HCPCS-shaped HHAeXchange service code that exceeds max length', async () => {
    mockRepo({});
    const app = createApp();
    app.set('db', makeMockDb());

    const response = await request(app)
      .put('/agencies/me/hhaexchange-config')
      .set('Authorization', `Bearer ${token('admin')}`)
      .send({
        services: [
          {
            internalServiceCode: 'PC',
            hhaServiceCode: 'X'.repeat(64), // exceeds .max(16)
            label: 'Personal Care',
          },
        ],
      });

    expect(response.status).toBe(400);
  });
});
