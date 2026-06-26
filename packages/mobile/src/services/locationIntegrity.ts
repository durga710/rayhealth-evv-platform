/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Location integrity / mock-GPS detection for EVV clock-in.
 *
 * Pennsylvania DHS EVV requires that the recorded clock-in/out location reflect
 * the caregiver's real physical presence at the client's home. GPS spoofing
 * tools — "Fake GPS" apps, Android developer "mock location" providers, or
 * emulator location injection — can defeat the 150 m server-side geofence by
 * reporting fabricated coordinates.
 *
 * The mobile app reads location through the WebView `navigator.geolocation`
 * API. Unlike the native Android `Location.isFromMockProvider()` / `isMock()`
 * flag, the web API does NOT tell us whether a fix was synthesised, and iOS
 * exposes no public mock-detection API at all. So we infer spoofing
 * heuristically from the *shape* of the data:
 *
 *   - Real consumer GPS fixes always jitter slightly between consecutive
 *     fresh samples; a spoofer typically pins identical coordinates.
 *   - Real fixes carry a plausible accuracy radius (rarely < 1 m on a phone);
 *     many spoofers report 0 m, 1 m, or a constant value.
 *   - Real movement is bounded by human/vehicle speed; "teleporting" between
 *     two samples implies injection.
 *
 * IMPORTANT: this module is a *signal*, not a gate. The server is the authority
 * on the geofence, and a heuristic must never lock a legitimate caregiver out
 * of their shift on a false positive. The verdict is attached to the clock-in
 * payload for the agency's audit/review and surfaced to the caregiver as a
 * non-blocking warning when risk is high.
 *
 * The scoring functions are pure and browser-free so they can be unit-tested
 * under `node:test`; the only browser dependency, `captureLocationSamples`,
 * touches `navigator.geolocation` lazily inside the function body.
 */

/** A single geolocation fix, normalised from `GeolocationPosition`. */
export interface LocationSample {
  latitude: number;
  longitude: number;
  /** Horizontal accuracy radius in metres, or `null` if the platform omitted it. */
  accuracy: number | null;
  /** Epoch milliseconds when the fix was taken. */
  timestamp: number;
  /** Ground speed in m/s, if reported. */
  speed?: number | null;
  /** Altitude in metres, if reported. */
  altitude?: number | null;
}

/** Overall trust level derived from the risk score. */
export type IntegrityTrust = 'ok' | 'suspect' | 'high_risk';

export type IntegritySignalCode =
  | 'zero_jitter'
  | 'implausible_accuracy'
  | 'constant_accuracy'
  | 'teleportation'
  | 'insufficient_samples';

/** One reason the location was (or could not be) trusted. */
export interface IntegritySignal {
  code: IntegritySignalCode;
  /** Human-readable explanation, safe to store in the audit log. */
  detail: string;
  /** Points this signal contributes to the risk score (0 = informational). */
  weight: number;
}

/** The structured result attached to a clock-in/out location payload. */
export interface IntegrityVerdict {
  trust: IntegrityTrust;
  /** 0 (clean) … 100 (almost certainly spoofed). */
  score: number;
  signals: IntegritySignal[];
  sampleCount: number;
}

export interface CaptureOptions {
  /** How many fixes to collect. Default 4. */
  samples?: number;
  /** Delay between fixes in ms. Default 350. */
  intervalMs?: number;
  /** Per-fix timeout in ms. Default 8000. */
  timeoutMs?: number;
}

/**
 * Smallest accuracy radius (metres) a genuine consumer phone GPS fix
 * realistically reports. Spoofers commonly report 0.
 */
const MIN_PLAUSIBLE_ACCURACY_M = 1;

/**
 * Maximum human-plausible ground speed (m/s) between two clock-in samples,
 * ~270 km/h — above any car/train a caregiver would use, below physical
 * impossibility. Measurement uncertainty is subtracted before comparing.
 */
const MAX_PLAUSIBLE_SPEED_MPS = 75;

/** Risk-score weights per signal, reflecting how strongly each implies spoofing. */
const WEIGHT = {
  teleportation: 60,
  zeroJitter: 45,
  implausibleAccuracy: 30,
  constantAccuracy: 15,
} as const;

/** Score at/above which a location is treated as high risk vs merely suspect. */
const HIGH_RISK_THRESHOLD = 60;
const SUSPECT_THRESHOLD = 30;

const EARTH_RADIUS_M = 6_371_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Great-circle distance between two coordinates in metres (haversine).
 * Pure and side-effect free.
 */
export function haversineMeters(
  a: Pick<LocationSample, 'latitude' | 'longitude'>,
  b: Pick<LocationSample, 'latitude' | 'longitude'>,
): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function trustFromScore(score: number): IntegrityTrust {
  if (score >= HIGH_RISK_THRESHOLD) {
    return 'high_risk';
  }
  if (score >= SUSPECT_THRESHOLD) {
    return 'suspect';
  }
  return 'ok';
}

function capScore(signals: readonly IntegritySignal[]): number {
  return Math.min(100, signals.reduce((sum, s) => sum + s.weight, 0));
}

/**
 * Assess a burst of geolocation samples for signs of GPS spoofing.
 *
 * Pure function: deterministic, no I/O, no globals — unit-tested under
 * `node:test`. Returns a verdict whose `score` is the capped sum of the
 * triggered signal weights.
 */
export function assessLocationIntegrity(samples: readonly LocationSample[]): IntegrityVerdict {
  const signals: IntegritySignal[] = [];

  // --- Single-sample check: implausibly precise accuracy (e.g. 0 m). --------
  const implausible = samples.find(
    (s) => s.accuracy !== null && s.accuracy < MIN_PLAUSIBLE_ACCURACY_M,
  );
  if (implausible) {
    signals.push({
      code: 'implausible_accuracy',
      detail: `Reported accuracy of ${implausible.accuracy} m is below the ${MIN_PLAUSIBLE_ACCURACY_M} m floor for real phone GPS.`,
      weight: WEIGHT.implausibleAccuracy,
    });
  }

  // Multi-sample checks need at least two fixes.
  if (samples.length < 2) {
    signals.push({
      code: 'insufficient_samples',
      detail: `Only ${samples.length} sample(s) captured; jitter and teleport checks were skipped.`,
      weight: 0,
    });
    const score = capScore(signals);
    return { trust: trustFromScore(score), score, signals, sampleCount: samples.length };
  }

  // --- Zero jitter: every fresh fix is byte-for-byte identical. -------------
  const first = samples[0];
  const allIdentical = samples.every(
    (s) => s.latitude === first.latitude && s.longitude === first.longitude,
  );
  if (allIdentical) {
    signals.push({
      code: 'zero_jitter',
      detail: 'All fresh GPS fixes returned identical coordinates; real GPS always jitters.',
      weight: WEIGHT.zeroJitter,
    });
  }

  // --- Constant accuracy across >=3 fixes. ----------------------------------
  const accuracies = samples.map((s) => s.accuracy);
  if (
    samples.length >= 3 &&
    accuracies.every((a): a is number => a !== null) &&
    accuracies.every((a) => a === accuracies[0])
  ) {
    signals.push({
      code: 'constant_accuracy',
      detail: `Accuracy was a constant ${accuracies[0]} m across all fixes; real accuracy fluctuates.`,
      weight: WEIGHT.constantAccuracy,
    });
  }

  // --- Teleportation: implied speed beyond human plausibility. --------------
  let maxImpliedSpeed = 0;
  for (let i = 1; i < samples.length; i += 1) {
    const prev = samples[i - 1];
    const curr = samples[i];
    const dtSeconds = (curr.timestamp - prev.timestamp) / 1000;
    if (dtSeconds <= 0) {
      continue;
    }
    const distance = haversineMeters(prev, curr);
    const uncertainty = (prev.accuracy ?? 0) + (curr.accuracy ?? 0);
    const netDisplacement = distance - uncertainty;
    if (netDisplacement <= 0) {
      continue;
    }
    const impliedSpeed = netDisplacement / dtSeconds;
    if (impliedSpeed > maxImpliedSpeed) {
      maxImpliedSpeed = impliedSpeed;
    }
  }
  if (maxImpliedSpeed > MAX_PLAUSIBLE_SPEED_MPS) {
    signals.push({
      code: 'teleportation',
      detail: `Implied movement of ${Math.round(maxImpliedSpeed)} m/s exceeds the ${MAX_PLAUSIBLE_SPEED_MPS} m/s plausibility ceiling.`,
      weight: WEIGHT.teleportation,
    });
  }

  const score = capScore(signals);
  return { trust: trustFromScore(score), score, signals, sampleCount: samples.length };
}

/** A short, log-friendly one-line summary of a verdict. */
export function summarizeVerdict(verdict: IntegrityVerdict): string {
  if (verdict.signals.length === 0) {
    return `location integrity ${verdict.trust} (score ${verdict.score})`;
  }
  const codes = verdict.signals.map((s) => s.code).join(', ');
  return `location integrity ${verdict.trust} (score ${verdict.score}): ${codes}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readOneSample(timeoutMs: number): Promise<LocationSample | null> {
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { coords } = position;
        resolve({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: Number.isFinite(coords.accuracy) ? coords.accuracy : null,
          timestamp: position.timestamp,
          speed: Number.isFinite(coords.speed) ? coords.speed : null,
          altitude: Number.isFinite(coords.altitude) ? coords.altitude : null,
        });
      },
      () => resolve(null),
      { enableHighAccuracy: true, maximumAge: 0, timeout: timeoutMs },
    );
  });
}

/**
 * Collect a short burst of fresh geolocation fixes for integrity assessment.
 *
 * Uses `maximumAge: 0` so each read is a genuine new fix — identical
 * coordinates across the burst then become a meaningful spoof signal. Returns
 * an empty array when geolocation is unavailable; failed individual reads are
 * dropped. Browser-only; not exercised by the pure unit tests.
 */
export async function captureLocationSamples(options: CaptureOptions = {}): Promise<LocationSample[]> {
  const { samples = 4, intervalMs = 350, timeoutMs = 8_000 } = options;

  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return [];
  }

  const collected: LocationSample[] = [];
  for (let i = 0; i < samples; i += 1) {
    const sample = await readOneSample(timeoutMs);
    if (sample) {
      collected.push(sample);
    }
    if (i < samples - 1) {
      await delay(intervalMs);
    }
  }
  return collected;
}

/** Pick the most precise sample (smallest accuracy radius) from a burst. */
export function pickBestSample(samples: readonly LocationSample[]): LocationSample | null {
  if (samples.length === 0) {
    return null;
  }
  return samples.reduce((best, candidate) => {
    const bestAcc = best.accuracy ?? Number.POSITIVE_INFINITY;
    const candAcc = candidate.accuracy ?? Number.POSITIVE_INFINITY;
    return candAcc < bestAcc ? candidate : best;
  });
}
