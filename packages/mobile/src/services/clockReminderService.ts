/**
 * Clock-in/out reminder service — RayHealthEVV's signature 30-second
 * pre-warning. For every assignment scheduled today:
 *   • 30s before scheduled_start_time → fire local notification +
 *     haptic vibration ("Time to clock in for Lok at 7:44 PM")
 *   • 30s before scheduled_end_time → fire local notification +
 *     haptic vibration ("Time to clock out — your shift ends at
 *     11:44 PM")
 *
 * The service runs while the dashboard is mounted (in foreground)
 * AND schedules iOS/Android local notifications via
 * `@capacitor/local-notifications` so the prompt fires even when the
 * app is backgrounded. Local notifications run on the OS's scheduler
 * — once we register them with the platform we don't need a JS timer
 * to fire them. The in-app foreground tick is only there to surface
 * the reminder visually if the app happens to be active at that moment
 * (and to drive the haptic, which can't be scheduled remotely).
 *
 * Permissions: requests notification permission on first start. If
 * declined, falls back to in-app foreground reminders only. Haptic
 * vibration always works (no permission required).
 */

import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { TodayScheduleRow } from './rayhealth-contract';

const PREWARN_MS = 30_000;
const FOREGROUND_TICK_MS = 5_000;

// Stable, hashable bucket of notification IDs we own. We delete and
// re-create them on every refresh so notifications drift correctly as
// the schedule changes (e.g. coordinator moves a visit).
const NOTIFICATION_ID_PREFIX = 1_000_000;

let foregroundTimer: ReturnType<typeof setInterval> | null = null;
let permissionChecked = false;
let permissionGranted = false;
const firedKeys = new Set<string>();

/**
 * Check the OS notification permission. We DO NOT prompt on launch —
 * Apple's HIG and the App Store review guidelines both prefer that
 * permission requests come at the contextually-relevant moment (i.e.
 * when the caregiver actually clocks in for the first time). On
 * launch we only schedule reminders if permission is already granted;
 * if it's not, the reminder service silently no-ops and the prompt
 * is deferred to the first clock-in flow via
 * `requestClockReminderPermission()`.
 */
async function ensurePermission(): Promise<boolean> {
  if (permissionChecked) return permissionGranted;
  permissionChecked = true;
  try {
    const { display } = await LocalNotifications.checkPermissions();
    permissionGranted = display === 'granted';
    return permissionGranted;
  } catch {
    // Web preview / unsupported platform — silently disable.
    permissionGranted = false;
    return false;
  }
}

/**
 * Explicitly prompt for notification permission. Call this from the
 * clock-in flow (or a Settings toggle), not from app boot. Idempotent:
 * once permission is granted (or denied permanently) further calls
 * short-circuit.
 */
export async function requestClockReminderPermission(): Promise<boolean> {
  if (permissionGranted) return true;
  try {
    const requested = await LocalNotifications.requestPermissions();
    permissionGranted = requested.display === 'granted';
    permissionChecked = true;
    return permissionGranted;
  } catch {
    permissionGranted = false;
    permissionChecked = true;
    return false;
  }
}

/**
 * Compute a deterministic 32-bit notification id from an
 * assignment id + boundary kind ('start' | 'end'). Same input always
 * produces the same id, so re-scheduling cancels the prior reminder
 * for that boundary cleanly.
 */
function notificationIdFor(assignmentId: string, kind: 'start' | 'end'): number {
  // FNV-1a 32-bit hash; deterministic, cheap, no crypto needed.
  let h = 0x811c9dc5;
  const s = `${assignmentId}:${kind}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  // Coalesce into our prefix bucket so we can find/clear our own
  // notifications without disturbing other plugins'.
  return NOTIFICATION_ID_PREFIX + (h % 1_000_000);
}

function clientLabel(row: TodayScheduleRow): string {
  return row.clientFirstName || row.clientLastName || 'your client';
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/**
 * Schedule (or re-schedule) all local notifications for the rows in
 * the latest schedule. Cancels any prior boundary reminders for these
 * assignments so a moved visit doesn't fire its old time.
 */
async function scheduleNotificationsFor(rows: TodayScheduleRow[]): Promise<void> {
  if (!(await ensurePermission())) return;

  const idsToReplace: { id: number }[] = [];
  type ToSchedule = {
    id: number;
    title: string;
    body: string;
    scheduleAt: Date;
  };
  const toSchedule: ToSchedule[] = [];

  for (const row of rows) {
    if (row.scheduledStartTime) {
      const id = notificationIdFor(row.assignmentId, 'start');
      idsToReplace.push({ id });
      const at = new Date(new Date(row.scheduledStartTime).getTime() - PREWARN_MS);
      if (at.getTime() > Date.now()) {
        toSchedule.push({
          id,
          title: 'Time to clock in',
          body: `${clientLabel(row)} — ${formatTime(row.scheduledStartTime)}`,
          scheduleAt: at,
        });
      }
    }
    if (row.scheduledEndTime) {
      const id = notificationIdFor(row.assignmentId, 'end');
      idsToReplace.push({ id });
      const at = new Date(new Date(row.scheduledEndTime).getTime() - PREWARN_MS);
      if (at.getTime() > Date.now()) {
        toSchedule.push({
          id,
          title: 'Time to clock out',
          body: `Shift ends at ${formatTime(row.scheduledEndTime)}`,
          scheduleAt: at,
        });
      }
    }
  }

  try {
    if (idsToReplace.length) {
      await LocalNotifications.cancel({ notifications: idsToReplace });
    }
    if (toSchedule.length) {
      await LocalNotifications.schedule({
        notifications: toSchedule.map((n) => ({
          id: n.id,
          title: n.title,
          body: n.body,
          schedule: { at: n.scheduleAt, allowWhileIdle: true },
        })),
      });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[clockReminderService] schedule failed:', err);
  }
}

/**
 * Foreground tick — fires haptic + dispatches an in-app banner event
 * when within 30s of a boundary AND we haven't already fired for this
 * exact boundary instance. The OS-scheduled notification fires
 * independently from `LocalNotifications.schedule()`; this tick exists
 * to drive the haptic vibration (which Capacitor can't pre-schedule)
 * and to render an inline UI cue.
 */
async function tick(rows: TodayScheduleRow[]): Promise<void> {
  const now = Date.now();
  for (const row of rows) {
    for (const [iso, kind] of [
      [row.scheduledStartTime, 'start' as const],
      [row.scheduledEndTime, 'end' as const],
    ]) {
      if (!iso) continue;
      const at = new Date(iso).getTime();
      const delta = at - now;
      const key = `${row.assignmentId}:${kind}:${iso}`;
      if (delta > 0 && delta <= PREWARN_MS && !firedKeys.has(key)) {
        firedKeys.add(key);
        try {
          await Haptics.impact({ style: ImpactStyle.Heavy });
        } catch {
          /* haptics unsupported on web preview */
        }
        window.dispatchEvent(
          new CustomEvent('rayhealth:clock-reminder', {
            detail: {
              assignmentId: row.assignmentId,
              kind,
              clientName: clientLabel(row),
              scheduledAt: iso,
            },
          }),
        );
      }
    }
  }
}

let activeRows: TodayScheduleRow[] = [];

/**
 * Public entry point — call once with today's schedule from the
 * dashboard. Re-call whenever the dashboard refetches the schedule
 * (e.g. on focus, on pull-to-refresh).
 */
export async function startClockReminderService(rows: TodayScheduleRow[]): Promise<void> {
  activeRows = rows;
  await scheduleNotificationsFor(rows);
  if (foregroundTimer) clearInterval(foregroundTimer);
  foregroundTimer = setInterval(() => {
    void tick(activeRows);
  }, FOREGROUND_TICK_MS);
}

/**
 * Stop the foreground tick. The OS-scheduled notifications remain
 * registered (they're how the prompt reaches a backgrounded app), but
 * we won't fire any more haptics from this app instance.
 */
export function stopClockReminderService(): void {
  if (foregroundTimer) {
    clearInterval(foregroundTimer);
    foregroundTimer = null;
  }
  activeRows = [];
}
