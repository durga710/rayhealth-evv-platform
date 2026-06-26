import { Capacitor } from '@capacitor/core';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';

/**
 * On native (iOS / Android), tokens go to the platform's secure store —
 * iOS Keychain (kSecClassGenericPassword) and Android Keystore-backed
 * EncryptedSharedPreferences. This replaces the previous
 * @capacitor/preferences storage which writes to plaintext UserDefaults
 * (iOS) and SharedPreferences XML (Android). The gap analysis lives in
 * docs/compliance/hipaa/ENCRYPTION_VERIFICATION.md §3.3 in the
 * platform repo.
 *
 * On web, fall back to localStorage. Web previews are dev-only; the
 * production build runs in the native shell where the keychain path
 * applies.
 */
function hasLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export async function readStoredString(key: string): Promise<string | null> {
  if (Capacitor.isNativePlatform()) {
    try {
      const v = await SecureStorage.get(key);
      return typeof v === 'string' ? v : null;
    } catch {
      // SecureStorage throws on missing key; treat as null so the
      // caller can fall through to its "no session yet" path.
      return null;
    }
  }
  if (!hasLocalStorage()) return null;
  return window.localStorage.getItem(key);
}

export async function writeStoredString(key: string, value: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    // sync=false keeps the entry device-local (no iCloud Keychain
    // mirror across the user's other devices); accessOnLocked=false
    // forces post-first-unlock access so the token isn't readable
    // while the device is locked at rest.
    await SecureStorage.set(key, value, false, false);
    return;
  }
  if (hasLocalStorage()) {
    window.localStorage.setItem(key, value);
  }
}

export async function removeStoredString(key: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await SecureStorage.remove(key);
    } catch {
      /* missing key is fine */
    }
    return;
  }
  if (hasLocalStorage()) {
    window.localStorage.removeItem(key);
  }
}

export async function readStoredJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await readStoredString(key);
  if (raw === null || raw === '') {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`Failed to parse stored JSON for ${key}`, error);
    return fallback;
  }
}

export async function writeStoredJson<T>(key: string, value: T): Promise<void> {
  await writeStoredString(key, JSON.stringify(value));
}
