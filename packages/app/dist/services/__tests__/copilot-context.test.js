import { describe, expect, it, vi } from 'vitest';
import * as core from '@rayhealth/core';
import { buildCopilotContext, contextSizeSummary } from '../copilot-context.js';
/**
 * The context builder calls CaregiverRepository + LearningRepository methods.
 * We mock both repos via vi.spyOn so tests don't need a real DB connection.
 */
function mockRepos(seed) {
    vi.spyOn(core, 'CaregiverRepository').mockImplementation(function CaregiverRepoMock() {
        return {
            findByAgency: vi.fn().mockResolvedValue(seed.caregivers),
            findById: vi.fn().mockResolvedValue(seed.selfCaregiver),
        };
    });
    vi.spyOn(core, 'LearningRepository').mockImplementation(function LearningRepoMock() {
        return {
            listCourses: vi.fn().mockResolvedValue(seed.courses),
        };
    });
}
function caregiver(overrides = {}) {
    return {
        id: 'caregiver-1',
        agencyId: 'agency-1',
        firstName: 'Maria',
        lastName: 'Lopez',
        email: 'm@x.com',
        status: 'active',
        ...overrides,
    };
}
function course(overrides = {}) {
    return {
        id: 'course-1',
        agencyId: null,
        code: 'HIPAA-2026',
        title: 'HIPAA Privacy & Security',
        description: '',
        cadence: 'annual',
        expiresAfterDays: 365,
        required: true,
        durationMinutes: 45,
        createdAt: '2026-01-01T00:00:00Z',
        ...overrides,
    };
}
describe('buildCopilotContext', () => {
    it('admin gets active caregivers + all courses', async () => {
        mockRepos({
            caregivers: [
                caregiver({ id: 'cg-1', firstName: 'Maria', lastName: 'Lopez' }),
                caregiver({ id: 'cg-2', firstName: 'Jorge', lastName: 'Diaz' }),
                // suspended caregivers should be excluded
                caregiver({ id: 'cg-3', firstName: 'Suspended', lastName: 'Smith', status: 'suspended' }),
            ],
            courses: [course({ id: 'c-1' }), course({ id: 'c-2', code: 'BLS', title: 'BLS' })],
        });
        const ctx = await buildCopilotContext({
            db: {},
            agencyId: 'agency-1',
            role: 'admin',
        });
        expect(ctx.caregivers).toHaveLength(2);
        expect(ctx.caregivers.map((c) => c.id)).toEqual(['cg-1', 'cg-2']);
        expect(ctx.courses).toHaveLength(2);
        // Text blob should contain both UUIDs so the model can copy them.
        expect(ctx.text).toContain('cg-1');
        expect(ctx.text).toContain('c-1');
        expect(ctx.text).toContain('Agency context for this conversation');
    });
    it('coordinator gets the same view as admin', async () => {
        mockRepos({
            caregivers: [caregiver({ id: 'cg-1' })],
            courses: [course()],
        });
        const ctx = await buildCopilotContext({
            db: {},
            agencyId: 'agency-1',
            role: 'coordinator',
        });
        expect(ctx.caregivers).toHaveLength(1);
        expect(ctx.courses).toHaveLength(1);
    });
    it('caregiver role sees only their own record', async () => {
        const self = caregiver({ id: 'cg-self', firstName: 'Self', lastName: 'Caregiver' });
        mockRepos({
            caregivers: [
                caregiver({ id: 'cg-1' }),
                caregiver({ id: 'cg-2' }),
            ],
            courses: [course()],
            selfCaregiver: self,
        });
        const ctx = await buildCopilotContext({
            db: {},
            agencyId: 'agency-1',
            role: 'caregiver',
            callerCaregiverId: 'cg-self',
        });
        expect(ctx.caregivers).toHaveLength(1);
        expect(ctx.caregivers[0].id).toBe('cg-self');
        // Other caregivers' UUIDs MUST NOT appear in the rendered blob.
        expect(ctx.text).not.toContain('cg-1');
        expect(ctx.text).not.toContain('cg-2');
    });
    it('caregiver role with no callerCaregiverId returns empty caregiver list', async () => {
        mockRepos({
            caregivers: [],
            courses: [course()],
        });
        const ctx = await buildCopilotContext({
            db: {},
            agencyId: 'agency-1',
            role: 'caregiver',
            // no callerCaregiverId
        });
        expect(ctx.caregivers).toHaveLength(0);
        // Courses can still be shown so the caregiver can ask "what training do I owe?"
        expect(ctx.courses).toHaveLength(1);
    });
    it('family role returns empty context (no caregiver/course context exposed)', async () => {
        mockRepos({
            caregivers: [caregiver({ id: 'cg-1' })],
            courses: [course()],
        });
        const ctx = await buildCopilotContext({
            db: {},
            agencyId: 'agency-1',
            role: 'family',
        });
        expect(ctx.caregivers).toHaveLength(0);
        expect(ctx.courses).toHaveLength(0);
        expect(ctx.text).toBe('');
    });
    it('caps caregivers at 50 for admin role', async () => {
        const many = Array.from({ length: 80 }, (_, i) => caregiver({ id: `cg-${i}`, firstName: `First${i}`, lastName: `Last${i}` }));
        mockRepos({ caregivers: many, courses: [] });
        const ctx = await buildCopilotContext({
            db: {},
            agencyId: 'agency-1',
            role: 'admin',
        });
        expect(ctx.caregivers).toHaveLength(50);
    });
    it('degrades to empty context when a repo call throws', async () => {
        vi.spyOn(core, 'CaregiverRepository').mockImplementation(function () {
            return {
                findByAgency: vi.fn().mockRejectedValue(new Error('db down')),
                findById: vi.fn(),
            };
        });
        vi.spyOn(core, 'LearningRepository').mockImplementation(function () {
            return {
                listCourses: vi.fn().mockResolvedValue([]),
            };
        });
        const ctx = await buildCopilotContext({
            db: {},
            agencyId: 'agency-1',
            role: 'admin',
        });
        expect(ctx.text).toBe('');
        expect(ctx.caregivers).toEqual([]);
        expect(ctx.courses).toEqual([]);
    });
    it('contextSizeSummary returns counts', () => {
        const sample = {
            text: 'ignored',
            caregivers: [
                { id: 'a', name: 'A B', status: 'active' },
                { id: 'b', name: 'C D', status: 'active' },
            ],
            courses: [{ id: 'x', code: 'X', title: 'X', required: true }],
        };
        expect(contextSizeSummary(sample)).toEqual({ caregivers: 2, courses: 1 });
    });
});
//# sourceMappingURL=copilot-context.test.js.map