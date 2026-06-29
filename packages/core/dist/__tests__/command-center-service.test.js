import { describe, it, expect } from 'vitest';
import { buildCommandCenterAttention, buildBriefingPrompt, deriveTodayVisitStatus, } from '../services/command-center-service.js';
const clean = {
    today: { scheduledToday: 8, completed: 8, inProgress: 0, lateStart: 0, upcoming: 0 },
    exceptions: {
        openExceptions: 0,
        lateClockInOpen: 0,
        missingLocationOpen: 0,
        manualEntryOpen: 0,
        telephonyFallbackOpen: 0,
        vmurPending: 0,
    },
    authorizations: { activeAuthorizations: 5, expiringIn14d: 0, expiringIn30d: 0, recentlyExpired: 0 },
    credentials: {
        activeCredentials: 10,
        pendingCredentials: 0,
        expiredCredentials: 0,
        expiringIn30d: 0,
        expiringIn90d: 0,
        recentlyExpired: 0,
    },
    claims: { verifiedVisitsLast7d: 8, verifiedVisitsLast30d: 30, flaggedVisitsLast7d: 0, pendingVisits: 0 },
    payroll: { verifiedHoursLast7d: 40, verifiedHoursLast30d: 160, completedVisitsLast7d: 8, inProgressVisits: 0 },
    training: { complianceRate: 1, overdue: 0, expired: 0 },
    coverage: { totalGaps: 0 },
};
describe('buildCommandCenterAttention', () => {
    it('returns no items for a clean agency (all clear)', () => {
        expect(buildCommandCenterAttention(clean)).toEqual([]);
    });
    it('only surfaces items whose driving count is > 0', () => {
        const s = {
            ...clean,
            exceptions: { ...clean.exceptions, openExceptions: 3 },
        };
        const items = buildCommandCenterAttention(s);
        expect(items).toHaveLength(1);
        expect(items[0].id).toBe('evv-exceptions-open');
        expect(items[0].severity).toBe('warning');
        expect(items[0].count).toBe(3);
        expect(items[0].to).toBe('/admin/compliance-engine/exceptions');
    });
    it('ranks critical before warning before info, then by count desc', () => {
        const s = {
            ...clean,
            today: { ...clean.today, lateStart: 2 }, // critical
            credentials: { ...clean.credentials, recentlyExpired: 5, expiringIn30d: 9 }, // critical + warning
            claims: { ...clean.claims, flaggedVisitsLast7d: 4 }, // info
            exceptions: { ...clean.exceptions, openExceptions: 1 }, // warning
        };
        const items = buildCommandCenterAttention(s);
        const severities = items.map((i) => i.severity);
        // criticals first
        expect(severities[0]).toBe('critical');
        expect(severities[1]).toBe('critical');
        // within critical, higher count first (recentlyExpired 5 > lateStart 2)
        expect(items[0].id).toBe('credentials-expired');
        expect(items[1].id).toBe('visits-late-start');
        // info is always last
        expect(severities[severities.length - 1]).toBe('info');
        expect(items[items.length - 1].id).toBe('billing-flagged');
        // no warning appears before a critical
        expect(severities.indexOf('warning')).toBeGreaterThan(severities.lastIndexOf('critical'));
    });
    it('pluralizes titles correctly for a single item', () => {
        const s = { ...clean, today: { ...clean.today, lateStart: 1 } };
        const [item] = buildCommandCenterAttention(s);
        expect(item.title).toBe('1 visit late to start');
    });
    it('surfaces ungenerated coverage gaps as a warning linking to recurring schedules', () => {
        const s = { ...clean, coverage: { totalGaps: 4 } };
        const items = buildCommandCenterAttention(s);
        const gap = items.find((i) => i.id === 'coverage-gaps');
        expect(gap).toBeDefined();
        expect(gap?.severity).toBe('warning');
        expect(gap?.count).toBe(4);
        expect(gap?.to).toBe('/admin/recurring-schedules');
    });
});
describe('buildBriefingPrompt', () => {
    it('embeds the headline counts and the prioritized flags (count-only, no PHI)', () => {
        const s = {
            ...clean,
            today: { ...clean.today, lateStart: 2, scheduledToday: 10 },
            credentials: { ...clean.credentials, recentlyExpired: 1 },
        };
        const { system, prompt } = buildBriefingPrompt(s);
        expect(system).toMatch(/home-care/i);
        expect(system).toMatch(/do not invent/i);
        // Numbers from the snapshot are present...
        expect(prompt).toContain('late to start 2');
        expect(prompt).toContain('Visits scheduled today: 10');
        // ...and the prioritized flags are listed for the model.
        expect(prompt).toContain('[critical]');
        expect(prompt).toMatch(/late to start/);
    });
    it('still produces a usable prompt for a clean agency', () => {
        const { prompt } = buildBriefingPrompt(clean);
        expect(prompt).toContain('Nothing currently flagged.');
    });
});
describe('deriveTodayVisitStatus', () => {
    // Fixed reference clock so the test is deterministic (no Date.now()).
    const now = new Date('2026-06-28T14:00:00.000Z').getTime();
    it('is completed once clocked out (regardless of other fields)', () => {
        expect(deriveTodayVisitStatus({ clockInTime: '2026-06-28T09:00:00Z', clockOutTime: '2026-06-28T13:00:00Z', scheduledStartTime: '2026-06-28T09:00:00Z' }, now)).toBe('completed');
    });
    it('is in_progress when clocked in but not out', () => {
        expect(deriveTodayVisitStatus({ clockInTime: '2026-06-28T13:30:00Z', clockOutTime: null, scheduledStartTime: '2026-06-28T13:00:00Z' }, now)).toBe('in_progress');
    });
    it('is late when start + grace has passed with no clock-in', () => {
        // scheduled 13:00, now 14:00 → well past the 15-min grace
        expect(deriveTodayVisitStatus({ clockInTime: null, clockOutTime: null, scheduledStartTime: '2026-06-28T13:00:00Z' }, now)).toBe('late');
    });
    it('is upcoming when still within grace / scheduled later', () => {
        // scheduled 13:50, now 14:00, grace 15min → 14:05 cutoff not yet reached
        expect(deriveTodayVisitStatus({ clockInTime: null, clockOutTime: null, scheduledStartTime: '2026-06-28T13:50:00Z' }, now)).toBe('upcoming');
        // scheduled later today
        expect(deriveTodayVisitStatus({ clockInTime: null, clockOutTime: null, scheduledStartTime: '2026-06-28T16:00:00Z' }, now)).toBe('upcoming');
    });
    it('treats a missing scheduled time as upcoming (cannot be late without a start)', () => {
        expect(deriveTodayVisitStatus({ clockInTime: null, clockOutTime: null, scheduledStartTime: null }, now)).toBe('upcoming');
    });
});
//# sourceMappingURL=command-center-service.test.js.map