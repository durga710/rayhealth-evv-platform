/**
 * Pure watch-progress gating for the course player's training video. The
 * in-page player script measures which seconds of the video were actually
 * watched (skipped-over seconds earn no credit) and posts bridge events; this
 * module validates those events, folds them into one progress state, and
 * decides when the caregiver may continue.
 *
 * Two guarantees:
 *  1. Engagement: Next unlocks only after REQUIRED_WATCH_FRACTION of the
 *     video was genuinely watched. Seek jumps are detected and flagged so the
 *     screen can ask for a rewatch.
 *  2. Never trap: if the player errors (offline, video removed, non-YouTube
 *     URL), the caregiver can always continue. The server never depended on
 *     client video telemetry anyway.
 */

export const REQUIRED_WATCH_FRACTION = 0.85;

export interface VideoProgress {
  /** 0..1 fraction of unique seconds actually watched. */
  watchedPct: number;
  /** True once a seek jump past unwatched content was detected. */
  skipped: boolean;
  /** True once playback reached the end. */
  ended: boolean;
  /** True when the player failed; unlocks Next so nobody is trapped. */
  error: boolean;
}

export type VideoBridgeEvent =
  | { kind: 'progress'; watchedPct: number; skipped: boolean; ended: boolean }
  | { kind: 'error' };

export function initialVideoProgress(): VideoProgress {
  return { watchedPct: 0, skipped: false, ended: false, error: false };
}

/** Parse a raw postMessage payload from the player page. Null when invalid. */
export function parseVideoMessage(raw: string): VideoBridgeEvent | null {
  try {
    const msg = JSON.parse(raw) as Record<string, unknown>;
    if (msg.type === 'error') return { kind: 'error' };
    if (msg.type === 'progress') {
      const pct = Number(msg.watchedPct);
      if (!Number.isFinite(pct)) return null;
      return {
        kind: 'progress',
        watchedPct: Math.max(0, Math.min(1, pct)),
        skipped: msg.skipped === true,
        ended: msg.ended === true,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** Fold a bridge event into the running progress state (monotonic). */
export function foldVideoEvent(state: VideoProgress, event: VideoBridgeEvent): VideoProgress {
  if (event.kind === 'error') return { ...state, error: true };
  return {
    watchedPct: Math.max(state.watchedPct, event.watchedPct),
    skipped: state.skipped || event.skipped,
    ended: state.ended || event.ended,
    error: state.error,
  };
}

/** May the caregiver advance past the video step? */
export function isVideoSatisfied(state: VideoProgress): boolean {
  return state.error || state.watchedPct >= REQUIRED_WATCH_FRACTION;
}

/** Should the screen show the "you skipped ahead, please rewatch" warning? */
export function needsRewatchWarning(state: VideoProgress): boolean {
  return state.skipped && !isVideoSatisfied(state) && state.ended;
}
