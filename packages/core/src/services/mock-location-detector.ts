import type { EvvClockLocation } from '../domain/evv.js';

/**
 * Verdict returned by the mock-location detector.
 *
 * - `clean`   — no integrity signal raised; allow the clock event.
 * - `suspect` — at least one heuristic tripped but nothing fatal. The visit
 *               should be persisted with status `flagged` and surfaced in the
 *               coordinator review queue.
 * - `rejected`— the OS itself attested the reading is fake (mock provider /
 *               iOS simulator in production). The clock event must be denied
 *               with HTTP 422 LOCATION_INTEGRITY_REJECTED.
 */
export type LocationIntegrityVerdict = 'clean' | 'suspect' | 'rejected';

export interface LocationIntegrityResult {
  verdict: LocationIntegrityVerdict;
  reasons: string[];
}

export interface MockLocationDetectorOptions {
  /**
   * When false (e.g. local dev), readings from the iOS Simulator are downgraded
   * from `rejected` to `suspect` so engineers can still smoke-test the flow.
   * Default: true (treat simulator as a hard reject in production).
   */
  readonly rejectSimulator?: boolean;

  /**
   * Reported accuracy in meters below which the reading is considered
   * suspiciously precise. Real consumer GPS rarely beats ~3 m outdoors;
   * exact-zero accuracy almost always indicates a synthetic source.
   * Default: 1.0 m.
   */
  readonly suspiciouslyPreciseAccuracyMeters?: number;
}

const DEFAULT_OPTIONS: Required<MockLocationDetectorOptions> = {
  rejectSimulator: true,
  suspiciouslyPreciseAccuracyMeters: 1.0
};

/**
 * Evaluates a single GPS reading for signs of mock/spoofed location.
 *
 * The detector deliberately does NOT throw. Callers decide what to do with
 * each verdict:
 *  - `rejected` → 422 to the client, audit `evv.clock.mock_rejected`.
 *  - `suspect`  → persist visit but mark `status: 'flagged'`, audit
 *                 `evv.clock.mock_suspected`, surface in coordinator queue.
 *  - `clean`    → continue normal flow.
 */
export function evaluateLocationIntegrity(
  location: EvvClockLocation,
  options: MockLocationDetectorOptions = {}
): LocationIntegrityResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const integrity = location.integrity;
  const reasons: string[] = [];
  let verdict: LocationIntegrityVerdict = 'clean';

  const escalate = (next: LocationIntegrityVerdict): void => {
    if (next === 'rejected') verdict = 'rejected';
    else if (next === 'suspect' && verdict === 'clean') verdict = 'suspect';
  };

  if (integrity?.isMock === true) {
    reasons.push('platform_mock_provider');
    escalate('rejected');
  }

  if (integrity?.isSimulator === true) {
    reasons.push('ios_simulator');
    escalate(opts.rejectSimulator ? 'rejected' : 'suspect');
  }

  // Reported accuracy of exactly 0 is impossible from real GPS hardware; some
  // emulators report it. Anything below ~1 m is also suspicious for caregiver
  // shifts in residential settings.
  if (location.accuracy === 0) {
    reasons.push('zero_accuracy');
    escalate('suspect');
  } else if (location.accuracy < opts.suspiciouslyPreciseAccuracyMeters) {
    reasons.push('suspiciously_precise_accuracy');
    escalate('suspect');
  }

  // Many spoofing apps emit perfect-zero speed AND heading together. Either
  // alone is fine — at rest you'd expect speed ~0 — but reporting both as
  // exact zeros alongside no altitude often indicates a synthetic source.
  if (
    integrity?.speed === 0 &&
    integrity?.heading === 0 &&
    integrity?.altitude === undefined
  ) {
    reasons.push('synthetic_motion_signature');
    escalate('suspect');
  }

  return { verdict, reasons };
}

/**
 * Convenience: true when the verdict means the request must be denied.
 */
export function isRejectedVerdict(result: LocationIntegrityResult): boolean {
  return result.verdict === 'rejected';
}
