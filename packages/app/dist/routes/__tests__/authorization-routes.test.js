import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';
import * as core from '@rayhealth/core';
import { makeToken, setTestJwtSecret } from './test-helpers.js';
beforeAll(() => setTestJwtSecret());
const VALID_AUTH = {
    clientId: 'client-1',
    payerId: 'payer-1',
    unitsAuthorized: 100,
    serviceCode: 'T1019',
    startDate: '2026-06-01',
    endDate: '2026-06-30',
};
describe('authorization routes', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });
    it('rejects a non-canonical (W-series) service code with 400', async () => {
        const createAuthorization = vi.fn();
        vi.spyOn(core, 'ClientRepository').mockImplementation(() => ({
            clientBelongsToAgency: vi.fn().mockResolvedValue(true),
            createAuthorization,
        }));
        const res = await request(createApp())
            .post('/authorizations')
            .set('Authorization', `Bearer ${makeToken('coordinator')}`)
            .send({ ...VALID_AUTH, serviceCode: 'W1793' });
        expect(res.status).toBe(400);
        expect(createAuthorization).not.toHaveBeenCalled();
    });
    it('rejects an authorization for a client in another agency with 404', async () => {
        const createAuthorization = vi.fn();
        vi.spyOn(core, 'ClientRepository').mockImplementation(() => ({
            clientBelongsToAgency: vi.fn().mockResolvedValue(false),
            createAuthorization,
        }));
        const res = await request(createApp())
            .post('/authorizations')
            .set('Authorization', `Bearer ${makeToken('coordinator')}`)
            .send(VALID_AUTH);
        expect(res.status).toBe(404);
        expect(createAuthorization).not.toHaveBeenCalled();
    });
    it('creates a valid authorization with 201', async () => {
        const createAuthorization = vi.fn().mockResolvedValue({ id: 'auth-1', ...VALID_AUTH });
        vi.spyOn(core, 'ClientRepository').mockImplementation(() => ({
            clientBelongsToAgency: vi.fn().mockResolvedValue(true),
            createAuthorization,
        }));
        const res = await request(createApp())
            .post('/authorizations')
            .set('Authorization', `Bearer ${makeToken('coordinator')}`)
            .send(VALID_AUTH);
        expect(res.status).toBe(201);
        expect(res.body.id).toBe('auth-1');
        expect(createAuthorization).toHaveBeenCalled();
    });
    it('returns authorizations enriched with units used / remaining', async () => {
        vi.spyOn(core, 'ClientRepository').mockImplementation(() => ({
            getAuthorizations: vi.fn().mockResolvedValue([
                { id: 'auth-1', clientId: 'client-1', payerId: 'p', serviceCode: 'T1019', unitsAuthorized: 100, startDate: '2026-06-01', endDate: '2026-06-30' },
            ]),
        }));
        vi.spyOn(core, 'ClaimRepository').mockImplementation(() => ({
            getBilledLineUnits: vi.fn().mockResolvedValue([
                // In-window, same client + code → counts.
                { clientId: 'client-1', serviceCode: 'T1019', serviceDate: '2026-06-10', units: 30 },
                // Different service code → must NOT count.
                { clientId: 'client-1', serviceCode: 'S5125', serviceDate: '2026-06-11', units: 999 },
                // Out of window → must NOT count.
                { clientId: 'client-1', serviceCode: 'T1019', serviceDate: '2026-07-05', units: 999 },
            ]),
        }));
        const res = await request(createApp())
            .get('/authorizations')
            .set('Authorization', `Bearer ${makeToken('coordinator')}`);
        expect(res.status).toBe(200);
        expect(res.body[0].unitsUsed).toBe(30);
        expect(res.body[0].unitsRemaining).toBe(70);
    });
    it('updates units via PUT', async () => {
        const updateAuthorization = vi.fn().mockResolvedValue({ id: 'auth-1', ...VALID_AUTH, unitsAuthorized: 120 });
        vi.spyOn(core, 'ClientRepository').mockImplementation(() => ({ updateAuthorization }));
        const res = await request(createApp())
            .put('/authorizations/auth-1')
            .set('Authorization', `Bearer ${makeToken('coordinator')}`)
            .send({ unitsAuthorized: 120 });
        expect(res.status).toBe(200);
        expect(updateAuthorization).toHaveBeenCalledWith('auth-1', 'agency-1', { unitsAuthorized: 120 });
    });
    it('rejects a PUT that sets a non-canonical service code with 400', async () => {
        const updateAuthorization = vi.fn();
        vi.spyOn(core, 'ClientRepository').mockImplementation(() => ({ updateAuthorization }));
        const res = await request(createApp())
            .put('/authorizations/auth-1')
            .set('Authorization', `Bearer ${makeToken('coordinator')}`)
            .send({ serviceCode: 'W1793' });
        expect(res.status).toBe(400);
        expect(updateAuthorization).not.toHaveBeenCalled();
    });
    it('deletes an authorization (204) and 404s an unknown one', async () => {
        // Shared fn (not recreated per repository construction) so the once-queue
        // advances across the two requests: first delete succeeds, second misses.
        const deleteAuthorization = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
        vi.spyOn(core, 'ClientRepository').mockImplementation(() => ({ deleteAuthorization }));
        const ok = await request(createApp())
            .delete('/authorizations/auth-1')
            .set('Authorization', `Bearer ${makeToken('coordinator')}`);
        expect(ok.status).toBe(204);
        const missing = await request(createApp())
            .delete('/authorizations/missing')
            .set('Authorization', `Bearer ${makeToken('coordinator')}`);
        expect(missing.status).toBe(404);
    });
});
//# sourceMappingURL=authorization-routes.test.js.map