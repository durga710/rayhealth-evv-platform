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
  current?: core.PartialSandataConfig;
  upserted?: core.PartialSandataConfig;
}): {
  findByAgency: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
} {
  const findByAgency = vi.fn().mockResolvedValue(seed.current);
  const upsert = vi.fn().mockImplementation((input: core.PartialSandataConfig) =>
    Promise.resolve(seed.upserted ?? input),
  );
  vi.spyOn(core, 'AgencySandataConfigRepository').mockImplementation(function () {
    return {
      findByAgency,
      findValid: vi.fn(),
      upsert,
    } as unknown as core.AgencySandataConfigRepository;
  } as unknown as typeof core.AgencySandataConfigRepository);

  vi.spyOn(core, 'AuditEventRepository').mockImplementation(function () {
    return { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) } as unknown as core.AuditEventRepository;
  } as unknown as typeof core.AuditEventRepository);

  return { findByAgency, upsert };
}

describe('GET /agencies/me/sandata-config', () => {
  it('returns an empty default when no row exists', async () => {
    mockRepo({});
    const app = createApp();
    app.set('db', makeMockDb());

    const response = await request(app)
      .get('/agencies/me/sandata-config')
      .set('Authorization', `Bearer ${token('admin')}`);

    expect(response.status).toBe(200);
    expect(response.body.data.providerId).toBeNull();
    expect(response.body.data.caregivers).toEqual([]);
    expect(response.body.data.enabled).toBe(false);
  });

  it('returns the stored config when one exists', async () => {
    mockRepo({
      current: {
        agencyId: AGENCY_ID,
        providerId: '123456789',
        timezone: 'America/New_York',
        caregivers: [{ caregiverId: CAREGIVER_ID, externalWorkerId: 'EW-1' }],
        services: [
          { internalServiceCode: 'PC', hcpcsCode: 'T1019', hcpcsModifier: 'U4', label: 'Personal Care' },
        ],
        enabled: true,
      },
    });
    const app = createApp();
    app.set('db', makeMockDb());

    const response = await request(app)
      .get('/agencies/me/sandata-config')
      .set('Authorization', `Bearer ${token('coordinator')}`);

    expect(response.status).toBe(200);
    expect(response.body.data.providerId).toBe('123456789');
    expect(response.body.data.caregivers).toHaveLength(1);
    expect(response.body.data.enabled).toBe(true);
  });
});

describe('PUT /agencies/me/sandata-config', () => {
  it('rejects non-admins with 403', async () => {
    mockRepo({});
    const app = createApp();
    app.set('db', makeMockDb());

    const response = await request(app)
      .put('/agencies/me/sandata-config')
      .set('Authorization', `Bearer ${token('coordinator')}`)
      .send({ providerId: '123456789' });

    expect(response.status).toBe(403);
  });

  it('rejects malformed provider IDs with 400', async () => {
    mockRepo({});
    const app = createApp();
    app.set('db', makeMockDb());

    const response = await request(app)
      .put('/agencies/me/sandata-config')
      .set('Authorization', `Bearer ${token('admin')}`)
      .send({ providerId: '12345' }); // not 9 digits

    expect(response.status).toBe(400);
  });

  it('rejects malformed HCPCS service mapping with 400', async () => {
    mockRepo({});
    const app = createApp();
    app.set('db', makeMockDb());

    const response = await request(app)
      .put('/agencies/me/sandata-config')
      .set('Authorization', `Bearer ${token('admin')}`)
      .send({
        services: [
          { internalServiceCode: 'PC', hcpcsCode: 'BAD', hcpcsModifier: 'U4', label: 'x' },
        ],
      });

    expect(response.status).toBe(400);
  });

  it('persists identity and merges with previous mappings', async () => {
    const { upsert } = mockRepo({
      current: {
        agencyId: AGENCY_ID,
        providerId: null,
        timezone: 'America/New_York',
        caregivers: [{ caregiverId: CAREGIVER_ID, externalWorkerId: 'EW-1' }],
        services: [],
        enabled: false,
      },
    });

    const app = createApp();
    app.set('db', makeMockDb());

    const response = await request(app)
      .put('/agencies/me/sandata-config')
      .set('Authorization', `Bearer ${token('admin')}`)
      .send({ providerId: '123456789' });

    expect(response.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: '123456789',
        caregivers: [{ caregiverId: CAREGIVER_ID, externalWorkerId: 'EW-1' }],
      }),
    );
  });

  it('rejects enabled=true when providerId is missing with 422', async () => {
    mockRepo({
      current: {
        agencyId: AGENCY_ID,
        providerId: null,
        timezone: 'America/New_York',
        caregivers: [],
        services: [],
        enabled: false,
      },
    });

    const app = createApp();
    app.set('db', makeMockDb());

    const response = await request(app)
      .put('/agencies/me/sandata-config')
      .set('Authorization', `Bearer ${token('admin')}`)
      .send({ enabled: true });

    expect(response.status).toBe(422);
    expect(response.body.error).toMatch(/providerId/);
  });

  it('allows enabled=true when providerId is set', async () => {
    const { upsert } = mockRepo({
      current: {
        agencyId: AGENCY_ID,
        providerId: '123456789',
        timezone: 'America/New_York',
        caregivers: [],
        services: [],
        enabled: false,
      },
    });

    const app = createApp();
    app.set('db', makeMockDb());

    const response = await request(app)
      .put('/agencies/me/sandata-config')
      .set('Authorization', `Bearer ${token('admin')}`)
      .send({ enabled: true });

    expect(response.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true, providerId: '123456789' }),
    );
  });
});
