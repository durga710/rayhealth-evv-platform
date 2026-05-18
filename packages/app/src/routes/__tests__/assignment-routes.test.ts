import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';
import * as core from '@rayhealth/core';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Stub LearningRepository.getAssignmentBlockers so the assignment route's
 * compliance gate has a deterministic answer in tests. Pass blockers=[] to
 * simulate a compliant caregiver, or a populated array to simulate blockers.
 */
function mockLearningCompliance(
  blockers: Array<{ enrollmentId: string; courseCode: string; courseTitle: string; status: string; reason: string }> = [],
): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue({ compliant: blockers.length === 0, blockers });
  vi.spyOn(core, 'LearningRepository').mockImplementation(function LearningRepositoryMock() {
    return {
      getAssignmentBlockers: fn,
    } as unknown as core.LearningRepository;
  } as unknown as typeof core.LearningRepository);
  return fn;
}

describe('assignment routes', () => {
  it('creates an assignment when the caregiver is training-compliant', async () => {
    const mockCreateAssignment = vi.fn().mockResolvedValue({
      id: '123',
      caregiverId: 'caregiver-1',
      visitTemplateId: 'template-1'
    });
    vi.spyOn(core, 'ScheduleRepository').mockImplementation(function ScheduleRepositoryMock() {
      return {
        createAssignment: mockCreateAssignment
      } as unknown as core.ScheduleRepository;
    } as unknown as typeof core.ScheduleRepository);
    mockLearningCompliance([]);

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

  it('rejects assignment creation when visitTemplateId is missing', async () => {
    const mockCreateAssignment = vi.fn();
    vi.spyOn(core, 'ScheduleRepository').mockImplementation(function ScheduleRepositoryMock() {
      return {
        createAssignment: mockCreateAssignment
      } as unknown as core.ScheduleRepository;
    } as unknown as typeof core.ScheduleRepository);
    mockLearningCompliance([]);

    const response = await request(createApp())
      .post('/assignments')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`)
      .send({
        clientId: 'client-1',
        caregiverId: 'caregiver-1',
        authorizationId: 'auth-1',
        visitDate: '2026-05-20'
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/visitTemplateId/i);
    expect(mockCreateAssignment).not.toHaveBeenCalled();
  });

  it('blocks assignment when caregiver has incomplete required training', async () => {
    const mockCreateAssignment = vi.fn();
    vi.spyOn(core, 'ScheduleRepository').mockImplementation(function ScheduleRepositoryMock() {
      return {
        createAssignment: mockCreateAssignment
      } as unknown as core.ScheduleRepository;
    } as unknown as typeof core.ScheduleRepository);
    mockLearningCompliance([
      {
        enrollmentId: 'enroll-1',
        courseCode: 'ORIENT-2026',
        courseTitle: 'New caregiver orientation',
        status: 'not_started',
        reason: 'New caregiver orientation not yet completed',
      },
    ]);

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

    expect(response.status).toBe(422);
    expect(response.body.code).toBe('CAREGIVER_NOT_COMPLIANT');
    expect(response.body.blockers).toHaveLength(1);
    expect(response.body.blockers[0].courseCode).toBe('ORIENT-2026');
    expect(mockCreateAssignment).not.toHaveBeenCalled();
  });

  it('allows assignment with force=true override despite blockers', async () => {
    const mockCreateAssignment = vi.fn().mockResolvedValue({
      id: '124',
      caregiverId: 'caregiver-1',
      visitTemplateId: 'template-1'
    });
    vi.spyOn(core, 'ScheduleRepository').mockImplementation(function ScheduleRepositoryMock() {
      return {
        createAssignment: mockCreateAssignment
      } as unknown as core.ScheduleRepository;
    } as unknown as typeof core.ScheduleRepository);
    mockLearningCompliance([
      {
        enrollmentId: 'enroll-2',
        courseCode: 'HIPAA-2026',
        courseTitle: 'HIPAA Privacy & Security',
        status: 'overdue',
        reason: 'HIPAA Privacy & Security is overdue',
      },
    ]);

    const response = await request(createApp())
      .post('/assignments')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`)
      .send({
        clientId: 'client-1',
        caregiverId: 'caregiver-1',
        visitTemplateId: 'template-1',
        authorizationId: 'auth-1',
        visitDate: '2026-05-20',
        force: true,
        overrideReason: 'Caregiver completed in-person training, certificate pending upload',
      });

    expect(response.status).toBe(201);
    expect(mockCreateAssignment).toHaveBeenCalled();
  });
});
