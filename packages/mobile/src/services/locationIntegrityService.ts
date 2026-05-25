import * as Location from 'expo-location';

/**
 * LocationIntegrityResult
 *
 * Returned by checkLocationIntegrity(). Includes the fetched position so
 * callers can use it directly without a second GPS request.
 */
export interface LocationIntegrityResult {
  /** True if a mock location provider was detected. */
  isMocked: boolean;
  /** Human-readable reason for the mock detection (null when isMocked is false). */
  reason: string | null;
  /** The position reading used for the check (null only on error). */
  position: Location.LocationObject | null;
}

/**
 * Fetches the current GPS position and checks whether it appears to come
 * from a mock location provider.
 *
 * Detection strategy (layered, fail-open):
 *
 * 1. Android OS flag — expo-location exposes `mocked` on LocationObject
 *    on Android when the developer option "Allow mock locations" is active
 *    and a mock-provider app is running (e.g. Fake GPS, Lexa GPS).
 *    This is the most reliable signal.
 *
 * 2. Zero-accuracy heuristic — A real GPS receiver always has some
 *    measurement error; accuracy of exactly 0 is physically impossible
 *    and is a characteristic of programmatically constructed positions.
 *
 * 3. Fail-open: if the position cannot be fetched, we surface the error
 *    but do NOT block the clock-in (the backend geofence check is the
 *    authoritative gate). Blocking on GPS errors would prevent legitimate
 *    caregivers in poor-signal areas from clocking in.
 *
 * PA DHS audit context: PA requires geofence enforcement within 100 m ±
 * GPS accuracy. Mock-location detection is a recommended additional control.
 *
 * @throws Does not throw — errors are encoded in the return value.
 */
export async function checkLocationIntegrity(): Promise<LocationIntegrityResult> {
  let position: Location.LocationObject;

  try {
    position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
  } catch (err) {
    // GPS unavailable — fail open (backend is the authoritative gate)
    console.warn('[locationIntegrity] GPS fetch failed:', err);
    return { isMocked: false, reason: null, position: null };
  }

  // Android: OS-level mock flag
  // LocationObject.coords is typed without `mocked` in Expo's typedefs
  // because it's Android-only, so we cast via unknown.
  const coords = position.coords as unknown as {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    mocked?: boolean;
  };

  if (coords.mocked === true) {
    return {
      isMocked: true,
      reason: 'Mock location provider detected (OS flag)',
      position,
    };
  }

  // Heuristic: accuracy of exactly 0 is unrealistic on a real device
  if (coords.accuracy === 0) {
    return {
      isMocked: true,
      reason: 'Unrealistic GPS accuracy (0 m) — possible mock location',
      position,
    };
  }

  return { isMocked: false, reason: null, position };
}
