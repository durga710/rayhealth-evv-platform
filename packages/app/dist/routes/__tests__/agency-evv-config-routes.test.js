import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as core from '@rayhealth/core';
import { createApp } from '../../app.js';
import { makeToken, setTestJwtSecret } from './test-helpers.js';
beforeAll(() => setTestJwtSecret());
afterEach(() => {
    vi.restoreAllMocks();
});
function makeMockDb(setup) {
    const builder = {
        where(_filter) { return builder; },
        first: async (..._cols) => {
            const table = lastTable;
            if (table === 'agencies')
                return setup.agency;
            if (table === 'agency_sandata_config')
                return setup.sandata ?? undefined;
            if (table === 'agency_hhaexchange_config')
                return setup.hhaexchange ?? undefined;
            return undefined;
        },
        update: async () => 1,
        insert(_row) { return builder; },
        onConflict: () => builder,
        merge: async () => 1,
    };
    let lastTable = '';
    const fn = ((table) => {
        lastTable = table;
        return builder;
    });
    fn.fn = { now: () => 'NOW()' };
    fn.raw = (s) => s;
    return fn;
}
function mockEvvRepo(seed) {
    const upsert = vi.fn().mockImplementation((input) => Promise.resolve(seed.upserted ?? input));
    const findOrInitialize = vi.fn().mockResolvedValue(seed.current ?? {
        agencyId: 'agency-1',
        aggregator: 'none',
        stateCode: 'PA',
        productionReady: false,
    });
    const findByAgency = vi.fn().mockResolvedValue(seed.current);
    vi.spyOn(core, 'AgencyEvvConfigRepository').mockImplementation(function MockRepo() {
        return { findByAgency, findOrInitialize, upsert };
    });
    return { findByAgency, findOrInitialize, upsert };
}
function mockAuditCreate() {
    const fn = vi.fn().mockResolvedValue({ id: 'audit-1' });
    vi.spyOn(core, 'AuditEventRepository').mockImplementation(function AuditEventRepositoryMock() {
        return { create: fn };
    });
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
        expect(repo.upsert).toHaveBeenCalledWith(expect.objectContaining({
            aggregator: 'hhaexchange',
            stateCode: 'PA',
            productionReady: false,
        }));
        expect(audit).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'agency.evv-config.changed',
            outcome: 'success',
        }));
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
//# sourceMappingURL=agency-evv-config-routes.test.js.map