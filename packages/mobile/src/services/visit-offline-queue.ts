/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Offline visit-action queue.
 *
 * The 21st-Century-Cures-Act EVV requirements (and PA DHS) require that
 * visits get logged with the location and timestamp of clock-in/out
 * even when the caregiver's phone has no signal. Today, a network
 * failure during `dataService.startVisit` would silently bubble up an
 * error and the punch would be lost.
 *
 * This module wraps the start/end visit calls so a network failure
 * (or known-offline state via `navigator.onLine === false`) enqueues
 * the action with its location + timestamp into Capacitor secure
 * storage. When the device comes back online we flush in FIFO order.
 *
 * Storage: `rayhealth.mobile.visit-queue` (JSON-serialized array).
 * Persistence: Capacitor SecureStorage on native, localStorage on web
 * preview — see `mobile-storage.ts`.
 *
 * The queue retains the ORIGINAL `queuedAt` timestamp on flush so the
 * server records the actual clock-in moment, not the network-recovery
 * moment. The backend's audit_event for the visit captures both via
 * the optional `queuedAt` field if/when the API surface accepts it.
 */
import { rayhealthApi } from './rayhealth-api';
import { readStoredJson, writeStoredJson } from './mobile-storage';

const QUEUE_STORAGE_KEY = 'rayhealth.mobile.visit-queue';

export interface QueuedVisitAction {
  id: string;
  kind: 'start' | 'end';
  visitId: string;
  location: Record<string, unknown>;
  deviceInfo: Record<string, unknown>;
  notes?: string;
  queuedAt: string;
}

let flushInProgress = false;

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `vq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function readQueue(): Promise<QueuedVisitAction[]> {
  return readStoredJson<QueuedVisitAction[]>(QUEUE_STORAGE_KEY, []);
}

async function writeQueue(queue: QueuedVisitAction[]): Promise<void> {
  await writeStoredJson(QUEUE_STORAGE_KEY, queue);
}

export async function getPendingActions(): Promise<QueuedVisitAction[]> {
  return readQueue();
}

export async function enqueueVisitAction(
  action: Omit<QueuedVisitAction, 'id' | 'queuedAt'>
): Promise<QueuedVisitAction> {
  const queue = await readQueue();
  const item: QueuedVisitAction = {
    ...action,
    id: newId(),
    queuedAt: new Date().toISOString()
  };
  queue.push(item);
  await writeQueue(queue);
  return item;
}

/**
 * Try the live API first; on network failure (TypeError from fetch) or
 * a known-offline state, enqueue and surface a queued: true response so
 * the UI can tell the user "queued — will sync when online."
 *
 * Non-network errors (4xx/5xx with body) bubble up as-is — those are
 * real problems the caller should display.
 */
async function attemptOrEnqueue(
  action: Omit<QueuedVisitAction, 'id' | 'queuedAt'>
): Promise<{ queued: boolean }> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    await enqueueVisitAction(action);
    return { queued: true };
  }
  try {
    if (action.kind === 'start') {
      await rayhealthApi.startVisit(action.visitId, {
        location: action.location,
        deviceInfo: action.deviceInfo
      });
    } else {
      await rayhealthApi.endVisit(action.visitId, {
        location: action.location,
        deviceInfo: action.deviceInfo,
        ...(action.notes ? { notes: action.notes } : {})
      });
    }
    return { queued: false };
  } catch (err) {
    // Treat fetch network errors as queueable. RayHealthApiError with a
    // status code is a real backend rejection — propagate.
    const isNetworkError = err instanceof TypeError;
    const hasStatus =
      err && typeof err === 'object' && 'status' in (err as Record<string, unknown>);
    if (isNetworkError || !hasStatus) {
      await enqueueVisitAction(action);
      return { queued: true };
    }
    throw err;
  }
}

/**
 * Public entry points used by dataService.startVisit / endVisit. Each
 * returns `{ queued }` so the caller can render the right toast.
 */
export async function startVisitWithQueue(
  visitId: string,
  location: Record<string, unknown>,
  deviceInfo: Record<string, unknown>
): Promise<{ queued: boolean }> {
  return attemptOrEnqueue({ kind: 'start', visitId, location, deviceInfo });
}

export async function endVisitWithQueue(
  visitId: string,
  location: Record<string, unknown>,
  deviceInfo: Record<string, unknown>,
  notes?: string
): Promise<{ queued: boolean }> {
  return attemptOrEnqueue({
    kind: 'end',
    visitId,
    location,
    deviceInfo,
    ...(notes ? { notes } : {})
  });
}

/**
 * Drain queued actions in FIFO order. Successful items are removed;
 * the first failure stops the drain so the order is preserved (a
 * later end-visit must not run before its earlier start-visit).
 *
 * Idempotent — guarded by `flushInProgress` so the online event
 * firing during an in-flight flush doesn't double-flush.
 */
export async function flushVisitQueue(): Promise<{
  flushed: number;
  remaining: number;
  errored: boolean;
}> {
  if (flushInProgress) return { flushed: 0, remaining: 0, errored: false };
  flushInProgress = true;
  let flushed = 0;
  let errored = false;
  try {
    let queue = await readQueue();
    while (queue.length > 0) {
      const head = queue[0];
      try {
        if (head.kind === 'start') {
          await rayhealthApi.startVisit(head.visitId, {
            location: head.location,
            deviceInfo: head.deviceInfo
          });
        } else {
          await rayhealthApi.endVisit(head.visitId, {
            location: head.location,
            deviceInfo: head.deviceInfo,
            ...(head.notes ? { notes: head.notes } : {})
          });
        }
        queue = queue.slice(1);
        await writeQueue(queue);
        flushed += 1;
      } catch (err) {
        // Stop draining on first failure; preserve queue order.
        errored = true;
        console.warn('Visit-queue flush stopped at item', head.id, err);
        break;
      }
    }
    return { flushed, remaining: queue.length, errored };
  } finally {
    flushInProgress = false;
  }
}

/**
 * Wire a one-time `online` event listener that drains the queue when
 * connectivity returns. Idempotent — call from App.tsx mount.
 */
let onlineListenerInstalled = false;
export function installVisitQueueAutoFlush(): void {
  if (onlineListenerInstalled) return;
  if (typeof window === 'undefined') return;
  onlineListenerInstalled = true;
  window.addEventListener('online', () => {
    void flushVisitQueue().catch((err) => {
      console.warn('Auto-flush on online failed', err);
    });
  });
}
