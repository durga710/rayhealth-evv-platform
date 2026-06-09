import { describe, expect, it } from 'vitest';
import {
  evaluateLocationIntegrity,
  isRejectedVerdict,
  type EvvClockLocation
} from '../index.js';

const baseLocation: EvvClockLocation = {
  lat: 40.2732,
  lng: -76.8867,
  accuracy: 18
};

describe('evaluateLocationIntegrity', () => {
  it('returns clean for a plain real-world reading with no integrity payload', () => {
    const result = evaluateLocationIntegrity(baseLocation);
    expect(result.verdict).toBe('clean');
    expect(result.reasons).toEqual([]);
    expect(isRejectedVerdict(result)).toBe(false);
  });

  it('returns clean when integrity is present but unsuspicious', () => {
    const result = evaluateLocationIntegrity({
      ...baseLocation,
      integrity: {
        isMock: false,
        isSimulator: false,
        provider: 'fused',
        altitude: 230.4,
        speed: 0.3,
        heading: 87
      }
    });
    expect(result.verdict).toBe('clean');
  });

  it('rejects when the Android OS reports a mock provider', () => {
    const result = evaluateLocationIntegrity({
      ...baseLocation,
      integrity: { isMock: true, provider: 'mock' }
    });
    expect(result.verdict).toBe('rejected');
    expect(result.reasons).toContain('platform_mock_provider');
    expect(isRejectedVerdict(result)).toBe(true);
  });

  it('rejects iOS Simulator readings by default', () => {
    const result = evaluateLocationIntegrity({
      ...baseLocation,
      integrity: { isSimulator: true, provider: 'ios' }
    });
    expect(result.verdict).toBe('rejected');
    expect(result.reasons).toContain('ios_simulator');
  });

  it('downgrades iOS Simulator to suspect when rejectSimulator=false (dev mode)', () => {
    const result = evaluateLocationIntegrity(
      { ...baseLocation, integrity: { isSimulator: true } },
      { rejectSimulator: false }
    );
    expect(result.verdict).toBe('suspect');
    expect(result.reasons).toContain('ios_simulator');
  });

  it('flags exact-zero accuracy as suspect', () => {
    const result = evaluateLocationIntegrity({ ...baseLocation, accuracy: 0 });
    expect(result.verdict).toBe('suspect');
    expect(result.reasons).toContain('zero_accuracy');
  });

  it('flags impossibly precise sub-meter accuracy as suspect', () => {
    const result = evaluateLocationIntegrity({ ...baseLocation, accuracy: 0.4 });
    expect(result.verdict).toBe('suspect');
    expect(result.reasons).toContain('suspiciously_precise_accuracy');
  });

  it('flags the synthetic-motion signature (speed=0, heading=0, no altitude)', () => {
    const result = evaluateLocationIntegrity({
      ...baseLocation,
      integrity: { speed: 0, heading: 0 }
    });
    expect(result.verdict).toBe('suspect');
    expect(result.reasons).toContain('synthetic_motion_signature');
  });

  it('does not flag synthetic-motion when altitude is present', () => {
    const result = evaluateLocationIntegrity({
      ...baseLocation,
      integrity: { speed: 0, heading: 0, altitude: 215 }
    });
    expect(result.verdict).toBe('clean');
  });

  it('escalates to rejected when both a hard signal and a soft signal fire', () => {
    const result = evaluateLocationIntegrity({
      ...baseLocation,
      accuracy: 0,
      integrity: { isMock: true }
    });
    expect(result.verdict).toBe('rejected');
    expect(result.reasons).toEqual(
      expect.arrayContaining(['platform_mock_provider', 'zero_accuracy'])
    );
  });
});
