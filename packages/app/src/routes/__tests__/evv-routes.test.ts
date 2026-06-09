import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';
import * as core from '@rayhealth/core';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());

afterEach(() => {
  vi.restoreAllMocks();
});

const caregiverId = '11111111-1111-4111-8111-111111111111';
const otherCaregiverId = '99999999-9999-4999-8999-999999999999';
const assignmentId = '22222222-2222-4222-8222-222222222222';
const visitId = '33333333-3333-4333-8333-333333333333';
const location = { lat: 40.2732, lng: -76.8867, accuracy: 18 };

describe('EVV routes', () => {
  it('allows a caregiver to clock in against their own assigned visit without schedule write access', async () => {
    const getAssignmentForCaregiver = vi.fn().mockResolvedValue({
      id: assignmentId,
      caregiverId,
      visitTemplateId: 'template-1'
    });
    const createVisit = vi.fn().mockResolvedValue({
      id: visitId,
      assignmentId,
      caregiverId,
      clockInTime: '2026-05-08T12:00:00.000Z',
      clockInLocation: location,
      status: 'pending'
    });

    vi.spyOn(core, 'ScheduleRepository').mockImplementation(function ScheduleRepositoryMock() {
      return { getAssignmentForCaregiver } as unknown as core.ScheduleRepository;
    } as unknown as typeof core.ScheduleRepository);
    vi.spyOn(core, 'EvvRepository').mockImplementation(function EvvRepositoryMock() {
      return { createVisit } as unknown as core.EvvRepository;
    } as unknown as typeof core.EvvRepository);

    const response = await request(createApp())
      .post('/api/evv/clock-in')
      .set('Authorization', `Bearer ${makeToken('caregiver', 'agency-1', 'user-1', caregiverId)}`)
      .send({ assignmentId, location });

    expect(response.status).toBe(201);
    expect(getAssignmentForCaregiver).toHaveBeenCalledWith(assignmentId, caregiverId);
    expect(createVisit).toHaveBeenCalledWith(
      expect.objectContaining({
        assignmentId,
        caregiverId,
        clockInLocation: location,
        status: 'pending'
      })
    );
  });

  it('rejects placeholder assignment IDs before creating an EVV record', async () => {
    const createVisit = vi.fn();
    vi.spyOn(core, 'EvvRepository').mockImplementation(function EvvRepositoryMock() {
      return { createVisit } as unknown as core.EvvRepository;
    } as unknown as typeof core.EvvRepository);

    const response = await request(createApp())
      .post('/api/evv/clock-in')
      .set('Authorization', `Bearer ${makeToken('caregiver', 'agency-1', 'user-1', caregiverId)}`)
      .send({ assignmentId: 'mock-assignment-id', location });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/valid assignment/i);
    expect(createVisit).not.toHaveBeenCalled();
  });

  it('rejects clock-in when the Android OS reports a mock-location provider', async () => {
    const createVisit = vi.fn();
    vi.spyOn(core, 'EvvRepository').mockImplementation(function EvvRepositoryMock() {
      return { createVisit } as unknown as core.EvvRepository;
    } as unknown as typeof core.EvvRepository);

    const response = await request(createApp())
      .post('/api/evv/clock-in')
      .set('Authorization', `Bearer ${makeToken('caregiver', 'agency-1', 'user-1', caregiverId)}`)
      .send({
        assignmentId,
        location: { ...location, integrity: { isMock: true, provider: 'mock' } }
      });

    expect(response.status).toBe(422);
    expect(response.body.code).toBe('LOCATION_INTEGRITY_REJECTED');
    expect(response.body.reasons).toContain('platform_mock_provider');
    expect(createVisit).not.toHaveBeenCalled();
  });

  it('persists a suspect clock-in with status "flagged"', async () => {
    const getAssignmentForCaregiver = vi.fn().mockResolvedValue({
      id: assignmentId,
      caregiverId,
      visitTemplateId: 'template-1'
    });
    const createVisit = vi.fn().mockImplementation((input) =>
      Promise.resolve({
        id: visitId,
        ...input
      })
    );

    vi.spyOn(core, 'ScheduleRepository').mockImplementation(function ScheduleRepositoryMock() {
      return { getAssignmentForCaregiver } as unknown as core.ScheduleRepository;
    } as unknown as typeof core.ScheduleRepository);
    vi.spyOn(core, 'EvvRepository').mockImplementation(function EvvRepositoryMock() {
      return { createVisit } as unknown as core.EvvRepository;
    } as unknown as typeof core.EvvRepository);

    const flaggedLocation = { ...location, accuracy: 0 };
    const response = await request(createApp())
      .post('/api/evv/clock-in')
      .set('Authorization', `Bearer ${makeToken('caregiver', 'agency-1', 'user-1', caregiverId)}`)
      .send({ assignmentId, location: flaggedLocation });

    expect(response.status).toBe(201);
    expect(response.headers['x-rayhealth-visit-flagged']).toMatch(/zero_accuracy/);
    expect(createVisit).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'flagged' })
    );
  });

  it('does not clock out a visit owned by another caregiver', async () => {
    const getVisitById = vi.fn().mockResolvedValue({
      id: visitId,
      assignmentId,
      caregiverId: otherCaregiverId,
      clockInTime: '2026-05-08T12:00:00.000Z',
      clockInLocation: location,
      status: 'pending'
    });
    const updateVisit = vi.fn();

    vi.spyOn(core, 'EvvRepository').mockImplementation(function EvvRepositoryMock() {
      return { getVisitById, updateVisit } as unknown as core.EvvRepository;
    } as unknown as typeof core.EvvRepository);

    const response = await request(createApp())
      .post(`/api/evv/clock-out/${visitId}`)
      .set('Authorization', `Bearer ${makeToken('caregiver', 'agency-1', 'user-1', caregiverId)}`)
      .send({ location });

    expect(response.status).toBe(404);
    expect(updateVisit).not.toHaveBeenCalled();
  });
});
