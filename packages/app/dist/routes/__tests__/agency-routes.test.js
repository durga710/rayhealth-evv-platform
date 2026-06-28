import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as core from '@rayhealth/core';
import { createApp } from '../../app.js';
import { makeToken, setTestJwtSecret } from './test-helpers.js';
beforeAll(() => setTestJwtSecret());
afterEach(() => {
    vi.restoreAllMocks();
});
describe('GET /agencies/current', () => {
    it('loads the authenticated agency from the repository', async () => {
        const findById = vi.fn().mockResolvedValue({
            id: 'agency-1',
            name: 'Allegheny Home Care',
            state: 'PA',
            operatingTracks: ['home-health'],
        });
        vi.spyOn(core, 'AgencyRepository').mockImplementation(function AgencyRepositoryMock() {
            return { findById };
        });
        const app = createApp();
        app.set('db', {});
        const response = await request(app)
            .get('/agencies/current')
            .set('Authorization', `Bearer ${makeToken('admin')}`);
        expect(response.status).toBe(200);
        expect(response.body.name).toBe('Allegheny Home Care');
        expect(findById).toHaveBeenCalledWith('agency-1');
    });
});
describe('PUT /agencies/current', () => {
    it('updates the authenticated agency name and writes an audit event', async () => {
        const updateProfile = vi.fn().mockResolvedValue({
            id: 'agency-1',
            name: 'New Keystone Care',
            state: 'PA',
            operatingTracks: ['personal-assistance'],
        });
        vi.spyOn(core, 'AgencyRepository').mockImplementation(function AgencyRepositoryMock() {
            return { updateProfile };
        });
        const auditCreate = vi.fn().mockResolvedValue({ id: 'audit-1' });
        vi.spyOn(core, 'AuditEventRepository').mockImplementation(function AuditEventRepositoryMock() {
            return { create: auditCreate };
        });
        const app = createApp();
        app.set('db', {});
        const response = await request(app)
            .put('/agencies/current')
            .set('Authorization', `Bearer ${makeToken('admin')}`)
            .send({ name: '  New Keystone Care  ' });
        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            id: 'agency-1',
            name: 'New Keystone Care',
            state: 'PA',
            operatingTracks: ['personal-assistance'],
        });
        expect(updateProfile).toHaveBeenCalledWith('agency-1', { name: 'New Keystone Care' });
        expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({
            agencyId: 'agency-1',
            actorId: 'user-1',
            eventType: 'agency.profile.changed',
            entityType: 'agency',
            entityId: 'agency-1',
            outcome: 'success',
            payload: { name: 'New Keystone Care' },
        }));
    });
    it('rejects blank agency names', async () => {
        const app = createApp();
        app.set('db', {});
        const response = await request(app)
            .put('/agencies/current')
            .set('Authorization', `Bearer ${makeToken('admin')}`)
            .send({ name: '   ' });
        expect(response.status).toBe(400);
        expect(response.body.message).toMatch(/agency name/i);
    });
    it('requires agency write access', async () => {
        const app = createApp();
        app.set('db', {});
        const response = await request(app)
            .put('/agencies/current')
            .set('Authorization', `Bearer ${makeToken('coordinator')}`)
            .send({ name: 'New Keystone Care' });
        expect(response.status).toBe(403);
    });
});
//# sourceMappingURL=agency-routes.test.js.map