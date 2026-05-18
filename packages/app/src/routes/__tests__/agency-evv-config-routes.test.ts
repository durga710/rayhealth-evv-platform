import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as core from '@rayhealth/core';
import { createApp } from '../../app.js';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Mock surface:
 *   - `db('agencies').where(...).first('state')` returns the agency's state.
 *   - `db('agency_sandata_config').where(...).first('enabled', 'provider_id')`
 *     returns Sandata readiness so the production-ready guard has something to
 *     read. Tests vary this per-case.
 *   - `AgencyEvvConfigRepository` is mocked via `vi.spyOn(core, ...)` so we
 *     don't have to fake the upsert/conflict semantics in raw knex.
 *   - `AuditEventRepository` is mocked so we can assert on its calls.
 */

interface AgencyRow {
  state?: string;
}

interface SandataRow {
  enabled?: boolean;
  provider_id?: string | null;
}

interface HhaexchangeRow {
  enabled?: boolean;
  agency_tax_id?: string | null;
  hha_provider_id?: string | null;
}

interface MockSetup {
  agency: AgencyRow;
  sandata?: SandataRow;
  hhaexchange?: HhaexchangeRow;
}

function makeMockDb(setup: MockSetup) {
  const builder = {
    where(_filter: unknown) { return builder; },
    first: async (..._cols: string[]) => {
      const table = lastTable;
      if (table === 'agencies') return setup.agency;
      if (table === 'agency_sandata_config') return setup.sandata ?? undefined;
      if (table === 'agency_hhaexchange_config') return setup.hhaexchange ?? undefined;
      return undefined;
    },
    update: async () => 1,
    insert(_row: unknown) { return builder; },
    onConflict: () => builder,
    merge: async () => 1,
  };
  let lastTable = '';
  const fn = ((table: string) => {
    lastTable = table;
    return builder;
  }) as unknown as {
    (table: string): typeof builder;
    fn: { now: () => string };
    raw: (s: string) => string;
  };
  fn.fn = { now: () => 'NOW()' };
  fn.raw = (s: string) => s;
  return fn;
}

function mockEvvRepo(seed: {
  current?: core.AgencyEvvConfig;
  upserted?: core.AgencyEvvConfig;
}): {
  findByAgency: ReturnType<typeof vi.fn>;
  findOrInitialize: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
} {
  const upsert = vi.fn().mockImplementation((input: core.AgencyEvvConfig) =>
    Promise.resolve(seed.upserted ?? input),
  );
  const findOrInitialize = vi.fn().mockResolvedValue(
    seed.current ?? {
      agencyId: 'agency-1',
      aggregator: 'none',
      stateCode: 'PA',
      productionReady: false,
    },
  );
  const findByAgency = vi.fn().mockResolvedValue(seed.current);
  vi.spyOn(core, 'AgencyEvvConfigRepository').mockImplementation(function MockRepo() {
    return { findByAgency, findOrInitialize, upsert } as unknown as core.AgencyEvvConfigRepository;
  } as unknown as typeof core.AgencyEvvConfigRepository);
  return { findByAgency, findOrInitialize, upsert };
}

function mockAuditCreate(): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue({ id: 'audit-1' });
  vi.spyOn(core, 'AuditEventRepository').mockImplementation(function AuditEventRepositoryMock() {
    return { create: fn } as unknown as core.AuditEventRepository;
  } as unknown as typeof core.AuditEventRepository);
  return fn;
}

describe('GET /agencies/me/evv-config', () => {
  it('returns the stored config decorated with state metadata (PA, choice available)', async () => {
    mockAuditCreate();
    mockEvvRepo({
      current: {
        agencyId: 'agency-1',
        aggregator: 'sandata',
        stateCode: 'PA',
        productionReady: false,
      },
    });

    const app = createApp();
    app.set('db', makeMockDb({ agency: { state: 'PA' } }));

    const response = await request(app)
      .get('/agencies/me/evv-config')
      .set('Authorization', `Bearer ${makeToken('admin')}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.aggregator).toBe('sandata');
    expect(response.body.data.stateCode).toBe('PA');
    expect(response.body.data.choiceAvailable).toBe(true);
    expect(response.body.data.stateDefaultAggregator).toBe('sandata');
  });

  it('marks choiceAvailable=false for forced-aggregator states (NJ)', async () => {
    mockAuditCreate();
    mockEvvRepo({
      current: {
        agencyId: 'agency-1',
        aggregator: 'hhaexchange',
        stateCode: 'NJ',
        productionReady: false,
      },
    });

    const app = createApp();
    app.set('db', makeMockDb({ agency: { state: 'NJ' } }));

    const response = await request(app)
      .get('/agencies/me/evv-config')
      .set('Authorization', `Bearer ${makeToken('admin')}`);

    expect(response.status).toBe(200);
    expect(response.body.data.choiceAvailable).toBe(false);
    expect(response.body.data.stateDefaultAggregator).toBe('hhaexchange');
  });
});

describe('PUT /agencies/me/evv-config', () => {
  it('rejects non-admins with 403', async () => {
    mockAuditCreate();
    mockEvvRepo({});

    const app = createApp();
    app.set('db', makeMockDb({ agency: { state: 'PA' } }));

    const response = await request(app)
      .put('/agencies/me/evv-config')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`)
      .send({ aggregator: 'hhaexchange' });

    expect(response.status).toBe(403);
  });

  it('updates the aggregator and writes an audit event', async () => {
    const audit = mockAuditCreate();
    const repo = mockEvvRepo({
      current: {
        agencyId: 'agency-1',
        aggregator: 'sandata',
        stateCode: 'PA',
        productionReady: false,
      },
      upserted: {
        agencyId: 'agency-1',
        aggregator: 'hhaexchange',
        stateCode: 'PA',
        productionReady: false,
      },
    });

    const app = createApp();
    app.set('db', makeMockDb({ agency: { state: 'PA' } }));

    const response = await request(app)
      .put('/agencies/me/evv-config')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ aggregator: 'hhaexchange' });

    expect(response.status).toBe(200);
    expect(response.body.data.aggregator).toBe('hhaexchange');
    expect(repo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregator: 'hhaexchange',
        stateCode: 'PA',
        productionReady: false,
      }),
    );
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'agency.evv-config.changed',
        outcome: 'success',
      }),
    );
  });

  it('rejects invalid aggregator value with 400', async () => {
    mockAuditCreate();
    mockEvvRepo({});
    const app = createApp();
    app.set('db', makeMockDb({ agency: { state: 'PA' } }));

    const response = await request(app)
      .put('/agencies/me/evv-config')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ aggregator: 'not-an-aggregator' });

    expect(response.status).toBe(400);
  });

  it('refuses to set Sandata for NJ (no aggregator choice)', async () => {
    mockAuditCreate();
    mockEvvRepo({
      current: {
        agencyId: 'agency-1',
        aggregator: 'hhaexchange',
        stateCode: 'NJ',
        productionReady: false,
      },
    });

    const app = createApp();
    app.set('db', makeMockDb({ agency: { state: 'NJ' } }));

    const response = await request(app)
      .put('/agencies/me/evv-config')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ aggregator: 'sandata' });

    expect(response.status).toBe(422);
    expect(response.body.error).toMatch(/does not allow aggregator choice/);
  });

  it('refuses production_ready when Sandata config is missing provider_id', async () => {
    mockAuditCreate();
    mockEvvRepo({
      current: {
        agencyId: 'agency-1',
        aggregator: 'sandata',
        stateCode: 'PA',
        productionReady: false,
      },
    });

    const app = createApp();
    app.set('db', makeMockDb({
      agency: { state: 'PA' },
      sandata: { enabled: true, provider_id: null },
    }));

    const response = await request(app)
      .put('/agencies/me/evv-config')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ aggregator: 'sandata', productionReady: true });

    expect(response.status).toBe(422);
    expect(response.body.error).toMatch(/Sandata/);
  });

  it('refuses HHAeXchange production_ready when tax_id or provider_id missing', async () => {
    mockAuditCreate();
    mockEvvRepo({
      current: {
        agencyId: 'agency-1',
        aggregator: 'hhaexchange',
        stateCode: 'NJ',
        productionReady: false,
      },
    });

    const app = createApp();
    app.set('db', makeMockDb({
      agency: { state: 'NJ' },
      hhaexchange: { enabled: true, agency_tax_id: null, hha_provider_id: 'P-100' },
    }));

    const response = await request(app)
      .put('/agencies/me/evv-config')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ aggregator: 'hhaexchange', productionReady: true });

    expect(response.status).toBe(422);
    expect(response.body.error).toMatch(/HHAeXchange/);
  });

  it('allows HHAeXchange production_ready when tax_id, provider_id, and enabled are all set', async () => {
    mockAuditCreate();
    mockEvvRepo({
      current: {
        agencyId: 'agency-1',
        aggregator: 'hhaexchange',
        stateCode: 'NJ',
        productionReady: false,
      },
      upserted: {
        agencyId: 'agency-1',
        aggregator: 'hhaexchange',
        stateCode: 'NJ',
        productionReady: true,
      },
    });

    const app = createApp();
    app.set('db', makeMockDb({
      agency: { state: 'NJ' },
      hhaexchange: { enabled: true, agency_tax_id: '987654321', hha_provider_id: 'P-100' },
    }));

    const response = await request(app)
      .put('/agencies/me/evv-config')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ aggregator: 'hhaexchange', productionReady: true });

    expect(response.status).toBe(200);
    expect(response.body.data.productionReady).toBe(true);
  });

  it('allows production_ready when Sandata config is enabled with provider_id', async () => {
    mockAuditCreate();
    mockEvvRepo({
      current: {
        agencyId: 'agency-1',
        aggregator: 'sandata',
        stateCode: 'PA',
        productionReady: false,
      },
      upserted: {
        agencyId: 'agency-1',
        aggregator: 'sandata',
        stateCode: 'PA',
        productionReady: true,
      },
    });

    const app = createApp();
    app.set('db', makeMockDb({
      agency: { state: 'PA' },
      sandata: { enabled: true, provider_id: '123456789' },
    }));

    const response = await request(app)
      .put('/agencies/me/evv-config')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ aggregator: 'sandata', productionReady: true });

    expect(response.status).toBe(200);
    expect(response.body.data.productionReady).toBe(true);
  });
});
