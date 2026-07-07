import { describe, it, expect } from 'vitest';
import {
  foldVideoEvent,
  initialVideoProgress,
  isVideoSatisfied,
  needsRewatchWarning,
  parseVideoMessage,
  REQUIRED_WATCH_FRACTION,
} from './video-progress';

describe('parseVideoMessage', () => {
  it('parses a valid progress message and clamps the fraction', () => {
    expect(parseVideoMessage(JSON.stringify({ type: 'progress', watchedPct: 0.5, skipped: false, ended: false })))
      .toEqual({ kind: 'progress', watchedPct: 0.5, skipped: false, ended: false });
    expect(parseVideoMessage(JSON.stringify({ type: 'progress', watchedPct: 3 }))!).toMatchObject({ watchedPct: 1 });
    expect(parseVideoMessage(JSON.stringify({ type: 'progress', watchedPct: -1 }))!).toMatchObject({ watchedPct: 0 });
  });

  it('parses error messages', () => {
    expect(parseVideoMessage(JSON.stringify({ type: 'error' }))).toEqual({ kind: 'error' });
  });

  it('rejects garbage', () => {
    expect(parseVideoMessage('not json')).toBeNull();
    expect(parseVideoMessage(JSON.stringify({ type: 'progress', watchedPct: 'lots' }))).toBeNull();
    expect(parseVideoMessage(JSON.stringify({ type: 'other' }))).toBeNull();
  });
});

describe('foldVideoEvent', () => {
  it('is monotonic: watched fraction and flags never regress', () => {
    let s = initialVideoProgress();
    s = foldVideoEvent(s, { kind: 'progress', watchedPct: 0.6, skipped: true, ended: false });
    s = foldVideoEvent(s, { kind: 'progress', watchedPct: 0.3, skipped: false, ended: true });
    expect(s).toEqual({ watchedPct: 0.6, skipped: true, ended: true, error: false });
  });

  it('records errors without losing progress', () => {
    let s = foldVideoEvent(initialVideoProgress(), { kind: 'progress', watchedPct: 0.4, skipped: false, ended: false });
    s = foldVideoEvent(s, { kind: 'error' });
    expect(s.error).toBe(true);
    expect(s.watchedPct).toBe(0.4);
  });
});

describe('isVideoSatisfied', () => {
  it('unlocks exactly at the required fraction', () => {
    const base = initialVideoProgress();
    expect(isVideoSatisfied({ ...base, watchedPct: REQUIRED_WATCH_FRACTION })).toBe(true);
    expect(isVideoSatisfied({ ...base, watchedPct: REQUIRED_WATCH_FRACTION - 0.01 })).toBe(false);
  });

  it('never traps: a player error always unlocks', () => {
    expect(isVideoSatisfied({ ...initialVideoProgress(), error: true })).toBe(true);
  });

  it('skipping alone does not block once enough was watched', () => {
    expect(isVideoSatisfied({ watchedPct: 0.9, skipped: true, ended: true, error: false })).toBe(true);
  });
});

describe('needsRewatchWarning', () => {
  it('warns when the video ended after skipping without enough coverage', () => {
    expect(needsRewatchWarning({ watchedPct: 0.4, skipped: true, ended: true, error: false })).toBe(true);
  });

  it('does not warn mid-watch, without skips, or once satisfied', () => {
    expect(needsRewatchWarning({ watchedPct: 0.4, skipped: true, ended: false, error: false })).toBe(false);
    expect(needsRewatchWarning({ watchedPct: 0.4, skipped: false, ended: true, error: false })).toBe(false);
    expect(needsRewatchWarning({ watchedPct: 0.9, skipped: true, ended: true, error: false })).toBe(false);
  });
});
