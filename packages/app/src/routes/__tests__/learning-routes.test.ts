import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';
import * as core from '@rayhealth/core';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());

afterEach(() => {
  vi.restoreAllMocks();
});

function mockLearningRecordCompletion(): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue({
    id: 'completion-1',
    enrollmentId: 'enroll-1',
    caregiverId: 'caregiver-1',
    courseId: 'course-1',
    completedAt: '2026-05-11T12:00:00.000Z',
    score: 95,
    notes: 'Caregiver self-attested via mobile',
  });
  vi.spyOn(core, 'LearningRepository').mockImplementation(function LearningRepositoryMock() {
    return {
      recordCompletion: fn,
    } as unknown as core.LearningRepository;
  } as unknown as typeof core.LearningRepository);
  return fn;
}

function mockAuditCreate(): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue({
    id: 'audit-1',
    agencyId: 'agency-1',
    actorId: 'user-1',
    actorType: 'user',
    eventType: 'learning.course.completed',
    entityType: 'course_enrollment',
    entityId: 'enroll-1',
    outcome: 'success',
    payload: {},
  });
  vi.spyOn(core, 'AuditEventRepository').mockImplementation(function AuditEventRepositoryMock() {
    return {
      create: fn,
    } as unknown as core.AuditEventRepository;
  } as unknown as typeof core.AuditEventRepository);
  return fn;
}

describe('learning routes — completion audit write', () => {
  it('writes a learning.course.completed audit event with source=coordinator when caregiver != actor', async () => {
    const completion = mockLearningRecordCompletion();
    const auditCreate = mockAuditCreate();

    const response = await request(createApp())
      .post('/learning/complete')
      .set('Authorization', `Bearer ${makeToken('coordinator', 'agency-1', 'user-1')}`)
      .send({
        enrollmentId: 'enroll-1',
        caregiverId: 'caregiver-1',
        courseId: 'course-1',
        score: 95,
        notes: 'Marked complete by coordinator',
      });

    expect(response.status).toBe(201);
    expect(completion).toHaveBeenCalled();
    // auditCreate fires at least once from our structured event; the audit-log
    // middleware may also fire for the request itself. Find the specific
    // learning.course.completed call rather than asserting total count.
    const completedCall = auditCreate.mock.calls.find(
      (args) => (args[0] as { eventType?: string }).eventType === 'learning.course.completed',
    );
    expect(completedCall).toBeDefined();
    const auditPayload = completedCall?.[0] as Record<string, unknown>;
    expect(auditPayload?.entityType).toBe('course_enrollment');
    expect(auditPayload?.entityId).toBe('enroll-1');
    const eventPayload = auditPayload?.payload as Record<string, unknown>;
    expect(eventPayload?.source).toBe('coordinator');
    expect(eventPayload?.caregiverId).toBe('caregiver-1');
    expect(eventPayload?.score).toBe(95);
  });

  it('writes audit event with source=caregiver when the authed user IS the caregiver', async () => {
    mockLearningRecordCompletion();
    const auditCreate = mockAuditCreate();

    const response = await request(createApp())
      .post('/learning/complete')
      .set(
        'Authorization',
        `Bearer ${makeToken('caregiver', 'agency-1', 'user-1', 'caregiver-1')}`,
      )
      .send({
        enrollmentId: 'enroll-1',
        caregiverId: 'caregiver-1',
        courseId: 'course-1',
      });

    expect(response.status).toBe(201);
    const completedCall = auditCreate.mock.calls.find(
      (args) => (args[0] as { eventType?: string }).eventType === 'learning.course.completed',
    );
    expect(completedCall).toBeDefined();
    const eventPayload = (completedCall?.[0] as { payload?: Record<string, unknown> })?.payload;
    expect(eventPayload?.source).toBe('caregiver');
  });

  it('still returns success when the audit write itself errors (audit failures must not block users)', async () => {
    const completion = mockLearningRecordCompletion();
    const auditCreate = vi.fn().mockRejectedValue(new Error('audit table unreachable'));
    vi.spyOn(core, 'AuditEventRepository').mockImplementation(function AuditEventRepositoryMock() {
      return { create: auditCreate } as unknown as core.AuditEventRepository;
    } as unknown as typeof core.AuditEventRepository);

    const response = await request(createApp())
      .post('/learning/complete')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`)
      .send({
        enrollmentId: 'enroll-1',
        caregiverId: 'caregiver-1',
        courseId: 'course-1',
      });

    expect(response.status).toBe(201);
    expect(completion).toHaveBeenCalled();
    expect(auditCreate).toHaveBeenCalled();
  });

  it('returns 400 when required fields are missing', async () => {
    mockLearningRecordCompletion();
    mockAuditCreate();
    const response = await request(createApp())
      .post('/learning/complete')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`)
      .send({ enrollmentId: 'enroll-1' });
    expect(response.status).toBe(400);
  });
});

describe('assignments — preflight compliance-check endpoint', () => {
  it('returns blockers for a non-compliant caregiver', async () => {
    const blockers = [
      {
        enrollmentId: 'e1',
        courseCode: 'ORIENT-2026',
        courseTitle: 'Orientation',
        status: 'not_started' as const,
        reason: 'Orientation not yet completed',
      },
    ];
    vi.spyOn(core, 'LearningRepository').mockImplementation(function LearningRepositoryMock() {
      return {
        getAssignmentBlockers: vi.fn().mockResolvedValue({ compliant: false, blockers }),
      } as unknown as core.LearningRepository;
    } as unknown as typeof core.LearningRepository);

    const response = await request(createApp())
      .get('/assignments/compliance-check/caregiver-1')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.compliant).toBe(false);
    expect(response.body.data.blockers).toHaveLength(1);
  });

  it('returns compliant=true with empty blockers for a clean caregiver', async () => {
    vi.spyOn(core, 'LearningRepository').mockImplementation(function LearningRepositoryMock() {
      return {
        getAssignmentBlockers: vi.fn().mockResolvedValue({ compliant: true, blockers: [] }),
      } as unknown as core.LearningRepository;
    } as unknown as typeof core.LearningRepository);

    const response = await request(createApp())
      .get('/assignments/compliance-check/caregiver-1')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`);

    expect(response.status).toBe(200);
    expect(response.body.data.compliant).toBe(true);
    expect(response.body.data.blockers).toEqual([]);
  });
});
