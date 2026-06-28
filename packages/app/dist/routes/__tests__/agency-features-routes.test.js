import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';
import * as core from '@rayhealth/core';
import { makeToken, setTestJwtSecret } from './test-helpers.js';
beforeAll(() => setTestJwtSecret());
afterEach(() => {
    vi.restoreAllMocks();
});
function makeMockDb(initialFeatures, captureUpdate) {
    let stored = initialFeatures;
    const builder = {
        where: () => builder,
        first: async () => ({ features: stored }),
        update: async (data) => {
            stored = data.features ?? stored;
            if (captureUpdate)
                captureUpdate(data);
            return 1;
        },
    };
    const fn = ((_table) => builder);
    fn.fn = { now: () => 'NOW()' };
    return fn;
}
describe('GET /agencies/me/features', () => {
    it('returns parsed features for the caller agency', async () => {
        const app = createApp();
        app.set('db', makeMockDb({ aiCopilot: { enabled: true, plan: 'starter' } }));
        const response = await request(app)
            .get('/agencies/me/features')
            .set('Authorization', `Bearer ${makeToken('admin')}`);
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.aiCopilot.enabled).toBe(true);
        expect(response.body.data.aiCopilot.plan).toBe('starter');
    });
    it('falls back to defaults when the column is missing or malformed', async () => {
        const app = createApp();
        app.set('db', makeMockDb(null));
        const response = await request(app)
            .get('/agencies/me/features')
            .set('Authorization', `Bearer ${makeToken('coordinator')}`);
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.aiCopilot.enabled).toBe(false);
        expect(response.body.data.aiCopilot.plan).toBe('off');
    });
});
describe('PUT /agencies/me/features', () => {
    it('rejects non-admins with 403', async () => {
        const app = createApp();
        app.set('db', makeMockDb({ aiCopilot: { enabled: false, plan: 'off' } }));
        const response = await request(app)
            .put('/agencies/me/features')
            .set('Authorization', `Bearer ${makeToken('coordinator')}`)
            .send({ aiCopilot: { enabled: true, plan: 'pro' } });
        expect(response.status).toBe(403);
    });
    it('updates the agency features and writes an audit event', async () => {
        let captured = null;
        const app = createApp();
        app.set('db', makeMockDb({ aiCopilot: { enabled: false, plan: 'off' } }, (data) => { captured = data; }));
        const auditCreate = vi.fn().mockResolvedValue({
            id: 'audit-1',
            eventType: 'agency.feature.changed',
        });
        vi.spyOn(core, 'AuditEventRepository').mockImplementation(function AuditEventRepositoryMock() {
            return { create: auditCreate };
        });
        const response = await request(app)
            .put('/agencies/me/features')
            .set('Authorization', `Bearer ${makeToken('admin')}`)
            .send({ aiCopilot: { enabled: true, plan: 'starter' } });
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.aiCopilot.enabled).toBe(true);
        expect(response.body.data.aiCopilot.plan).toBe('starter');
        // Confirms the JSONB was set with the right shape
        expect(captured).toBeTruthy();
        const updateData = captured;
        expect(updateData.features).toBeDefined();
        const parsed = JSON.parse(updateData.features ?? '{}');
        expect(parsed.aiCopilot.enabled).toBe(true);
        // Confirms an audit event was written with previous/next diff
        const featureChange = auditCreate.mock.calls.find((args) => args[0].eventType === 'agency.feature.changed');
        expect(featureChange).toBeDefined();
        const auditPayload = featureChange?.[0];
        expect(auditPayload?.payload?.previous).toBeDefined();
        expect(auditPayload?.payload?.next).toBeDefined();
    });
    it('rejects invalid feature payload with 400', async () => {
        const app = createApp();
        app.set('db', makeMockDb({ aiCopilot: { enabled: false, plan: 'off' } }));
        const response = await request(app)
            .put('/agencies/me/features')
            .set('Authorization', `Bearer ${makeToken('admin')}`)
            .send({ aiCopilot: { enabled: true, plan: 'enterprise' } }); // 'enterprise' not in enum
        expect(response.status).toBe(400);
    });
});
describe('GET /learning/analytics', () => {
    it('returns the analytics envelope for the caller agency', async () => {
        vi.spyOn(core, 'LearningRepository').mockImplementation(function LearningRepositoryMock() {
            return {
                getCourseAnalytics: vi.fn().mockResolvedValue({
                    generatedAt: '2026-05-11T12:00:00.000Z',
                    rows: [
                        {
                            courseId: 'c-1',
                            courseCode: 'HIPAA-2026',
                            courseTitle: 'HIPAA Privacy & Security',
                            required: true,
                            cadence: 'annual',
                            totalEnrollments: 5,
                            completedCount: 3,
                            overdueCount: 1,
                            expiredCount: 0,
                            pendingCount: 1,
                            completionRate: 0.6,
                            averageDaysToComplete: 12.5,
                        },
                    ],
                }),
            };
        });
        const response = await request(createApp())
            .get('/learning/analytics')
            .set('Authorization', `Bearer ${makeToken('coordinator')}`);
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.rows).toHaveLength(1);
        expect(response.body.data.rows[0].completionRate).toBe(0.6);
    });
});
describe('GET /learning/courses/:id/caregivers', () => {
    it('returns the course caregiver envelope', async () => {
        vi.spyOn(core, 'LearningRepository').mockImplementation(function LearningRepositoryMock() {
            return {
                getCourseCaregivers: vi.fn().mockResolvedValue({
                    course: { id: 'c-1', code: 'HIPAA-2026', title: 'HIPAA', description: '', cadence: 'annual', expiresAfterDays: 365, required: true, durationMinutes: 45, agencyId: null, createdAt: '2026-01-01T00:00:00Z' },
                    caregivers: [
                        {
                            enrollment: { id: 'e-1', agencyId: 'a-1', caregiverId: 'cg-1', courseId: 'c-1', assignedAt: '2026-01-01', dueAt: null, lastCompletedAt: null, expiresAt: null, status: 'not_started' },
                            caregiver: { id: 'cg-1', firstName: 'Maria', lastName: 'Lopez', email: 'm@x.com' },
                            effectiveStatus: 'not_started',
                        },
                    ],
                }),
            };
        });
        const response = await request(createApp())
            .get('/learning/courses/c-1/caregivers')
            .set('Authorization', `Bearer ${makeToken('coordinator')}`);
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.caregivers).toHaveLength(1);
        expect(response.body.data.caregivers[0].caregiver.firstName).toBe('Maria');
    });
    it('returns 404 when the course is missing', async () => {
        vi.spyOn(core, 'LearningRepository').mockImplementation(function LearningRepositoryMock() {
            return {
                getCourseCaregivers: vi.fn().mockResolvedValue(undefined),
            };
        });
        const response = await request(createApp())
            .get('/learning/courses/unknown/caregivers')
            .set('Authorization', `Bearer ${makeToken('coordinator')}`);
        expect(response.status).toBe(404);
    });
});
//# sourceMappingURL=agency-features-routes.test.js.map