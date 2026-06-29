import { describe, it, expect } from 'vitest';
import { haversineM, evaluateGeofence, formatDistance } from './geofence';

describe('haversineM', () => {
  it('is ~0 for identical points', () => {
    expect(haversineM({ lat: 40.0, lng: -75.0 }, { lat: 40.0, lng: -75.0 })).toBeCloseTo(0, 5);
  });

  it('approximates a known short distance (~111m per 0.001° latitude)', () => {
    const d = haversineM({ lat: 40.0, lng: -75.0 }, { lat: 40.001, lng: -75.0 });
    expect(d).toBeGreaterThan(105);
    expect(d).toBeLessThan(118);
  });
});

describe('evaluateGeofence', () => {
  const client = { lat: 40.0, lng: -75.0 };

  it('returns no-geolock when the client has no coordinates', () => {
    expect(evaluateGeofence({ lat: 40.0, lng: -75.0 }, null, 150)).toEqual({ kind: 'no-geolock' });
  });

  it('is inside when within the allowed radius', () => {
    const r = evaluateGeofence({ lat: 40.0, lng: -75.0 }, client, 150);
    expect(r.kind).toBe('inside');
  });

  it('is outside when beyond the allowed radius', () => {
    // ~111m away, radius 50m → outside
    const r = evaluateGeofence({ lat: 40.001, lng: -75.0 }, client, 50);
    expect(r.kind).toBe('outside');
    if (r.kind === 'outside') expect(r.distanceM).toBeGreaterThan(50);
  });

  it('treats the boundary as inside (<=)', () => {
    const d = haversineM({ lat: 40.001, lng: -75.0 }, client);
    const r = evaluateGeofence({ lat: 40.001, lng: -75.0 }, client, d);
    expect(r.kind).toBe('inside');
  });
});

describe('formatDistance', () => {
  it('uses metres under 1km', () => {
    expect(formatDistance(42.4)).toBe('42 m');
  });
  it('uses kilometres at/over 1km', () => {
    expect(formatDistance(1500)).toBe('1.5 km');
  });
});
