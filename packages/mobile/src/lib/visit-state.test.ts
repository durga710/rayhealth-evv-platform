import { describe, it, expect } from 'vitest';
import { deriveVisitState, resumableVisit } from './visit-state';

describe('deriveVisitState', () => {
  it('is not_started when there is no visit today', () => {
    expect(deriveVisitState({ currentVisitId: null, currentClockInTime: null, currentClockOutTime: null })).toBe('not_started');
  });

  it('is in_progress when clocked in but not out', () => {
    expect(
      deriveVisitState({ currentVisitId: 'v1', currentClockInTime: '2026-06-28T13:00:00Z', currentClockOutTime: null }),
    ).toBe('in_progress');
  });

  it('is completed once clocked out', () => {
    expect(
      deriveVisitState({ currentVisitId: 'v1', currentClockInTime: '2026-06-28T13:00:00Z', currentClockOutTime: '2026-06-28T17:00:00Z' }),
    ).toBe('completed');
  });

  it('does not treat a clock-in with no visit id as resumable', () => {
    expect(deriveVisitState({ currentVisitId: null, currentClockInTime: '2026-06-28T13:00:00Z', currentClockOutTime: null })).toBe('not_started');
  });
});

describe('resumableVisit', () => {
  it('returns the open visit to resume when in progress', () => {
    expect(
      resumableVisit({ currentVisitId: 'v1', currentClockInTime: '2026-06-28T13:00:00Z', currentClockOutTime: null }),
    ).toEqual({ id: 'v1', clockInTime: '2026-06-28T13:00:00Z' });
  });

  it('returns null when not in progress', () => {
    expect(resumableVisit({ currentVisitId: 'v1', currentClockInTime: '2026-06-28T13:00:00Z', currentClockOutTime: '2026-06-28T17:00:00Z' })).toBeNull();
    expect(resumableVisit({ currentVisitId: null, currentClockInTime: null, currentClockOutTime: null })).toBeNull();
  });
});
