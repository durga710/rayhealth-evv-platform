import type { User } from '../types';
import { mapRayHealthUser, type RayHealthLoginResult } from './rayhealth-contract';
import { readStoredJson, readStoredString, removeStoredString, writeStoredJson, writeStoredString } from './mobile-storage';

export interface RayHealthSession {
  user: User;
  accessToken: string;
  refreshToken: string;
  photoURL?: string;
}

const SESSION_STORAGE_KEY = 'rayhealth.mobile.session';
const DEVICE_ID_STORAGE_KEY = 'rayhealth.mobile.device-id';
let sessionCache: RayHealthSession | null = null;
let sessionHydrationPromise: Promise<RayHealthSession | null> | null = null;
let deviceIdCache: string | null = null;
let deviceIdPromise: Promise<string> | null = null;

export function getStoredSession(): RayHealthSession | null {
  return sessionCache;
}

export async function loadStoredSession(): Promise<RayHealthSession | null> {
  if (sessionHydrationPromise !== null) {
    return await sessionHydrationPromise;
  }

  sessionHydrationPromise = (async () => {
    sessionCache = await readStoredJson<RayHealthSession | null>(SESSION_STORAGE_KEY, null);
    return sessionCache;
  })();

  return await sessionHydrationPromise;
}

export function saveSession(session: RayHealthSession): RayHealthSession {
  sessionCache = session;
  sessionHydrationPromise = Promise.resolve(session);
  void writeStoredJson(SESSION_STORAGE_KEY, session);
  return session;
}

export function clearSession(): void {
  sessionCache = null;
  sessionHydrationPromise = Promise.resolve(null);
  void removeStoredString(SESSION_STORAGE_KEY);
}

export function updateStoredSession(
  partial: Omit<Partial<RayHealthSession>, 'user'> & { user?: Partial<User> },
): RayHealthSession | null {
  const current = getStoredSession();
  if (!current) {
    return null;
  }

  const next = {
    ...current,
    ...partial,
    user: {
      ...current.user,
      ...(partial.user ?? {}),
      ...(partial.photoURL !== undefined ? { photoURL: partial.photoURL } : {}),
    },
  };
  return saveSession(next);
}

export function buildSessionFromLogin(result: RayHealthLoginResult): RayHealthSession {
  return {
    user: mapRayHealthUser(result.user),
    accessToken: result.tokens.accessToken,
    refreshToken: result.tokens.refreshToken,
  };
}

export async function getStableDeviceId(): Promise<string> {
  if (deviceIdCache) {
    return deviceIdCache;
  }

  if (deviceIdPromise !== null) {
    return await deviceIdPromise;
  }

  deviceIdPromise = (async () => {
    const existing = await readStoredString(DEVICE_ID_STORAGE_KEY);
    if (existing) {
      deviceIdCache = existing;
      return existing;
    }

    const created = globalThis.crypto?.randomUUID?.() ?? `device-${Date.now()}`;
    deviceIdCache = created;
    await writeStoredString(DEVICE_ID_STORAGE_KEY, created);
    return created;
  })();

  return await deviceIdPromise;
}
