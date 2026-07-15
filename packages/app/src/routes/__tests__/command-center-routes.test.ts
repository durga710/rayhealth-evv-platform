import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';
import * as core from '@rayhealth/core';
import * as ai from '../../ai.js';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());

function mockEngine(overrides: Record<string, unknown> = {}) {
  vi.spyOn(core, 'ComplianceEngineRepository').mockImplementation(() => ({
    getTodaysVisitOps: vi.fn().mockResolvedValue({
      scheduledToday: 6, completed: 3, inProgress: 1, lateStart: 2, upcoming: 0,
    }),
    getExceptionResolution: vi.fn().mockResolvedValue({
      openExceptions: 4, lateClockInOpen: 2, missingLocationOpen: 1, manualEntryOpen: 1,
      telephonyFallbackOpen: 0, vmurPending: 0,
    }),
    getAuthorizationOversight: vi.fn().mockResolvedValue({
      activeAuthorizations: 9, expiringIn14d: 1, expiringIn30d: 2, recentlyExpired: 0,
    }),
    getCredentialsCompliance: vi.fn().mockResolvedValue({
      activeCredentials: 12, pendingCredentials: 0, expiredCredentials: 1,
      expiringIn30d: 0, expiringIn90d: 3, recentlyExpired: 0,
    }),
    getClaimMatching: vi.fn().mockResolvedValue({
      verifiedVisitsLast7d: 20, verifiedVisitsLast30d: 80, flaggedVisitsLast7d: 0, pendingVisits: 0,
    }),
    getPayrollReconciliation: vi.fn().mockResolvedValue({
      verifiedHoursLast7d: 120, verifiedHoursLast30d: 480, completedVisitsLast7d: 20, inProgressVisits: 0,
    }),
    getTodaysVisitBoard: vi.fn().mockResolvedValue([
      // upcoming (scheduled far in the future relative to any test clock)
      { assignmentId: 'a1', clientName: 'Client One', caregiverName: 'Care One', scheduledStartTime: '2999-01-01T20:00:00Z', clockInTime: null, clockOutTime: null },
      // late (scheduled far in the past, never clocked in)
      { assignmentId: 'a2', clientName: 'Client Two', caregiverName: 'Care Two', scheduledStartTime: '2000-01-01T08:00:00Z', clockInTime: null, clockOutTime: null },
      // completed
      { assignmentId: 'a3', clientName: 'Client Three', caregiverName: 'Care Three', scheduledStartTime: '2000-01-01T09:00:00Z', clockInTime: '2000-01-01T09:01:00Z', clockOutTime: '2000-01-01T13:00:00Z' },
      // in progress
      { assignmentId: 'a4', clientName: 'Client Four', caregiverName: 'Care Four', scheduledStartTime: '2000-01-01T10:00:00Z', clockInTime: '2000-01-01T10:02:00Z', clockOutTime: null },
    ]),
    ...overrides,
  } as any));
  vi.spyOn(core, 'LearningRepository').mockImplementation(() => ({
    getAgencyRollup: vi.fn().mockResolvedValue({
      totalCaregivers: 12, totalEnrollments: 30, notStarted: 0, inProgress: 0,
      completed: 28, overdue: 0, expired: 0, complianceRate: 0.93,
    }),
  } as any));
  vi.spyOn(core, 'RecurringScheduleRepository').mockImplementation(() => ({
    forecastCoverage: vi.fn().mockResolvedValue({
      windowStart: '2026-06-28', windowEnd: '2026-07-12', totalGaps: 3, gaps: [],
    }),
  } as any));
}

describe('command center routes', () => {
  afterEach(() => vi.restoreAllMocks());

  it('blocks caregivers (agency.read required)', async () => {
    const res = await request(createApp())
      .get('/command-center/summary')
      .set('Authorization', `Bearer ${makeToken('caregiver')}`);
    expect(res.status).toBe(403);
  });

  it('returns a composed snapshot + prioritized attention list for an admin', async () => {
    mockEngine();
    const res = await request(createApp())
      .get('/command-center/summary')
      .set('Authorization', `Bearer ${makeToken('admin')}`);

    expect(res.status).toBe(200);
    expect(res.body.today.lateStart).toBe(2);
    expect(res.body.training.complianceRate).toBeCloseTo(0.93);
    expect(res.body.coverage.totalGaps).toBe(3);
    expect(res.body.attention.map((a: { id: string }) => a.id)).toContain('coverage-gaps');

    // Attention list: late starts (critical) must rank above open exceptions (warning).
    const ids = res.body.attention.map((a: { id: string }) => a.id);
    expect(ids).toContain('visits-late-start');
    expect(ids).toContain('evv-exceptions-open');
    expect(ids.indexOf('visits-late-start')).toBeLessThan(ids.indexOf('evv-exceptions-open'));
    expect(res.body.attention[0].severity).toBe('critical');
  });

  it('coordinators may read the command center too', async () => {
    mockEngine();
    const res = await request(createApp())
      .get('/command-center/summary')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`);
    expect(res.status).toBe(200);
  });

  it('blocks caregivers from the today board (agency.read required)', async () => {
    const res = await request(createApp())
      .get('/command-center/today')
      .set('Authorization', `Bearer ${makeToken('caregiver')}`);
    expect(res.status).toBe(403);
  });

  it('returns a status-derived, action-ordered today board for an admin', async () => {
    mockEngine();
    const res = await request(createApp())
      .get('/command-center/today')
      .set('Authorization', `Bearer ${makeToken('admin')}`);

    expect(res.status).toBe(200);
    expect(res.body.counts).toMatchObject({
      scheduledToday: 4, late: 1, inProgress: 1, upcoming: 1, completed: 1,
    });

    // Action-first ordering: late → in_progress → upcoming → completed.
    const statuses = res.body.visits.map((v: { status: string }) => v.status);
    expect(statuses).toEqual(['late', 'in_progress', 'upcoming', 'completed']);

    // Each row carries operational identity + a derived status, no clinical PHI.
    const late = res.body.visits[0];
    expect(late.status).toBe('late');
    expect(late.clientName).toBe('Client Two');
    expect(late.caregiverName).toBe('Care Two');
  });

  it('blocks caregivers from the AI briefing', async () => {
    const res = await request(createApp())
      .post('/command-center/briefing')
      .set('Authorization', `Bearer ${makeToken('caregiver')}`);
    expect(res.status).toBe(403);
  });

  it('returns available:false when no AI provider is configured', async () => {
    vi.spyOn(ai, 'isAIConfigured').mockReturnValue(false);
    const res = await request(createApp())
      .post('/command-center/briefing')
      .set('Authorization', `Bearer ${makeToken('admin')}`);
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
  });

  it('generates an AI briefing when a provider is configured', async () => {
    mockEngine();
    const auditCreate = vi.fn().mockResolvedValue({});
    vi.spyOn(core, 'AuditEventRepository').mockImplementation(
      () => ({ create: auditCreate }) as any,
    );
    vi.spyOn(ai, 'isAIConfigured').mockReturnValue(true);
    const askAI = vi.spyOn(ai, 'askAI').mockResolvedValue({
      text: 'Prioritize coverage for the 2 visits late to start.',
      usageTokens: 42,
      model: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
      provider: 'bedrock',
    });

    const res = await request(createApp())
      .post('/command-center/briefing')
      .set('Authorization', `Bearer ${makeToken('admin')}`);

    expect(res.status).toBe(200);
    expect(res.body.available).toBe(true);
    expect(res.body.briefing).toContain('late to start');
    expect(res.body.provider).toBe('bedrock');
    expect(askAI).toHaveBeenCalled();
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'copilot.query',
        entityType: 'command_center_briefing',
        payload: expect.objectContaining({
          surface: 'command-center-briefing',
          promptHash: expect.stringMatching(/^[a-f0-9]{64}$/),
          responseHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      }),
    );
  });
});
