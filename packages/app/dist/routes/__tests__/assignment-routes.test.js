import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';
import * as core from '@rayhealth/core';
import { makeToken, setTestJwtSecret } from './test-helpers.js';
beforeAll(() => setTestJwtSecret());
describe('assignment routes', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });
    it('creates an assignment when the authorization and caregiver are valid', async () => {
        const mockCreateAssignment = vi.fn().mockResolvedValue({
            id: '123',
            caregiverId: 'caregiver-1',
            visitTemplateId: 'template-1'
        });
        vi.spyOn(core, 'ScheduleRepository').mockImplementation(() => ({
            createAssignment: mockCreateAssignment,
            getTemplateClient: vi.fn().mockResolvedValue({ clientId: 'client-1' }),
            getCaregiverScheduleForConflict: vi.fn().mockResolvedValue([])
        }));
        // The route now verifies caregiver belongs to the agency before creating.
        vi.spyOn(core, 'CaregiverRepository').mockImplementation(() => ({
            findById: vi.fn().mockResolvedValue({ id: 'caregiver-1', agencyId: 'agency-id', status: 'active' }),
            getCredentials: vi.fn().mockResolvedValue([])
        }));
        // Conflict-gate dependencies (authorizations, billed units, audit).
        vi.spyOn(core, 'ClientRepository').mockImplementation(() => ({
            getAuthorizations: vi.fn().mockResolvedValue([])
        }));
        vi.spyOn(core, 'ClaimRepository').mockImplementation(() => ({
            getBilledLineUnits: vi.fn().mockResolvedValue([])
        }));
        vi.spyOn(core, 'AuditEventRepository').mockImplementation(() => ({
            create: vi.fn().mockResolvedValue({})
        }));
        const response = await request(createApp())
            .post('/assignments')
            .set('Authorization', `Bearer ${makeToken('coordinator')}`)
            .send({
            clientId: 'client-1',
            caregiverId: 'caregiver-1',
            visitTemplateId: 'template-1',
            authorizationId: 'auth-1',
            visitDate: '2026-05-20'
        });
        expect(response.status).toBe(201);
        expect(mockCreateAssignment).toHaveBeenCalled();
    });
    it('warns (does not block) when the caregiver has non-active credentials', async () => {
        vi.spyOn(core, 'ScheduleRepository').mockImplementation(() => ({
            createAssignment: vi.fn().mockResolvedValue({ id: '124', caregiverId: 'caregiver-1', visitTemplateId: 'template-1' }),
            getTemplateClient: vi.fn().mockResolvedValue({ clientId: 'client-1' }),
            getCaregiverScheduleForConflict: vi.fn().mockResolvedValue([])
        }));
        vi.spyOn(core, 'CaregiverRepository').mockImplementation(() => ({
            findById: vi.fn().mockResolvedValue({ id: 'caregiver-1', agencyId: 'agency-id', status: 'active' }),
            getCredentials: vi.fn().mockResolvedValue([
                { credentialType: 'tb-screening', status: 'expired' }
            ])
        }));
        vi.spyOn(core, 'ClientRepository').mockImplementation(() => ({
            getAuthorizations: vi.fn().mockResolvedValue([])
        }));
        vi.spyOn(core, 'ClaimRepository').mockImplementation(() => ({
            getBilledLineUnits: vi.fn().mockResolvedValue([])
        }));
        vi.spyOn(core, 'AuditEventRepository').mockImplementation(() => ({
            create: vi.fn().mockResolvedValue({})
        }));
        const response = await request(createApp())
            .post('/assignments')
            .set('Authorization', `Bearer ${makeToken('coordinator')}`)
            .send({ clientId: 'client-1', caregiverId: 'caregiver-1', visitTemplateId: 'template-1', visitDate: '2026-05-20' });
        expect(response.status).toBe(201);
        expect(response.body.warnings.some((w) => w.includes('non-active credentials'))).toBe(true);
    });
    it('forbids caregivers from creating assignments', async () => {
        const mockCreateAssignment = vi.fn();
        vi.spyOn(core, 'ScheduleRepository').mockImplementation(() => ({
            createAssignment: mockCreateAssignment
        }));
        const response = await request(createApp())
            .post('/assignments')
            .set('Authorization', `Bearer ${makeToken('caregiver', 'agency-1', 'user-1', 'caregiver-1')}`)
            .send({
            caregiverId: 'caregiver-2',
            visitTemplateId: 'template-1',
            visitDate: '2026-05-20'
        });
        expect(response.status).toBe(403);
        expect(mockCreateAssignment).not.toHaveBeenCalled();
    });
    it('rejects assignment creation without an explicit visit template', async () => {
        const mockCreateAssignment = vi.fn().mockResolvedValue({
            id: '123',
            caregiverId: 'caregiver-1',
            visitTemplateId: '00000000-0000-0000-0000-000000000000'
        });
        vi.spyOn(core, 'ScheduleRepository').mockImplementation(() => ({
            createAssignment: mockCreateAssignment
        }));
        const response = await request(createApp())
            .post('/assignments')
            .set('Authorization', `Bearer ${makeToken('coordinator')}`)
            .send({
            caregiverId: 'caregiver-1',
            visitDate: '2026-05-20'
        });
        expect(response.status).toBe(400);
        expect(mockCreateAssignment).not.toHaveBeenCalled();
    });
    // Shared no-conflict mocks for the reschedule path (which now re-runs the gate).
    function mockRescheduleDeps(overrides = {}) {
        const updateAssignment = overrides.updateAssignment ??
            vi.fn().mockResolvedValue({
                id: 'a1', caregiverId: 'caregiver-1', visitTemplateId: 'template-1', visitDate: '2026-06-01',
            });
        vi.spyOn(core, 'ScheduleRepository').mockImplementation(() => ({
            updateAssignment,
            getAssignmentById: vi.fn().mockResolvedValue({
                id: 'a1', caregiverId: 'caregiver-1', visitTemplateId: 'template-1', clientId: 'client-1', visitDate: '2026-05-20',
            }),
            getTemplateClient: vi.fn().mockResolvedValue({ clientId: 'client-1' }),
            getCaregiverScheduleForConflict: overrides.getCaregiverScheduleForConflict ?? vi.fn().mockResolvedValue([]),
        }));
        vi.spyOn(core, 'CaregiverRepository').mockImplementation(() => ({
            findById: vi.fn().mockResolvedValue({ id: 'caregiver-1', agencyId: 'agency-1', status: 'active' }),
            getCredentials: vi.fn().mockResolvedValue([]),
        }));
        vi.spyOn(core, 'ClientRepository').mockImplementation(() => ({
            getAuthorizations: vi.fn().mockResolvedValue([]),
        }));
        vi.spyOn(core, 'ClaimRepository').mockImplementation(() => ({
            getBilledLineUnits: vi.fn().mockResolvedValue([]),
        }));
        return updateAssignment;
    }
    it('reschedules an assignment via PUT', async () => {
        const updateAssignment = mockRescheduleDeps();
        const response = await request(createApp())
            .put('/assignments/a1')
            .set('Authorization', `Bearer ${makeToken('coordinator')}`)
            .send({ visitDate: '2026-06-01' });
        expect(response.status).toBe(200);
        expect(updateAssignment).toHaveBeenCalledWith('a1', 'agency-1', { visitDate: '2026-06-01' });
    });
    it('blocks a reschedule that would double-book the caregiver (409)', async () => {
        // The caregiver already has template-1 on 2026-06-01 (a different assignment).
        const updateAssignment = mockRescheduleDeps({
            getCaregiverScheduleForConflict: vi
                .fn()
                .mockResolvedValue([{ visitTemplateId: 'template-1', visitDate: '2026-06-01' }]),
        });
        const response = await request(createApp())
            .put('/assignments/a1')
            .set('Authorization', `Bearer ${makeToken('coordinator')}`)
            .send({ visitDate: '2026-06-01' });
        expect(response.status).toBe(409);
        expect(response.body.code).toBe('SCHEDULE_CONFLICT');
        expect(updateAssignment).not.toHaveBeenCalled();
    });
    it('rejects a PUT with a malformed visitDate', async () => {
        const updateAssignment = vi.fn();
        vi.spyOn(core, 'ScheduleRepository').mockImplementation(() => ({ updateAssignment }));
        const response = await request(createApp())
            .put('/assignments/a1')
            .set('Authorization', `Bearer ${makeToken('coordinator')}`)
            .send({ visitDate: 'next tuesday' });
        expect(response.status).toBe(400);
        expect(updateAssignment).not.toHaveBeenCalled();
    });
    it('deletes an assignment with no EVV visit (204)', async () => {
        vi.spyOn(core, 'ScheduleRepository').mockImplementation(() => ({
            deleteAssignment: vi.fn().mockResolvedValue('deleted'),
        }));
        const response = await request(createApp())
            .delete('/assignments/a1')
            .set('Authorization', `Bearer ${makeToken('coordinator')}`);
        expect(response.status).toBe(204);
    });
    it('refuses to delete an assignment that already has an EVV visit (409)', async () => {
        vi.spyOn(core, 'ScheduleRepository').mockImplementation(() => ({
            deleteAssignment: vi.fn().mockResolvedValue('has_dependencies'),
        }));
        const response = await request(createApp())
            .delete('/assignments/a1')
            .set('Authorization', `Bearer ${makeToken('coordinator')}`);
        expect(response.status).toBe(409);
        expect(response.body.code).toBe('HAS_DEPENDENCIES');
    });
});
//# sourceMappingURL=assignment-routes.test.js.map