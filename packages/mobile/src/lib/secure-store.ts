/**
 * Device-keystore/keychain-backed key-value storage for account-scoped EVV
 * data that must never touch AsyncStorage: the offline visit-schedule cache
 * (client names, addresses, coordinates). The offline EVV punch queue lives in
 * offline-queue.ts; this module is just the encrypted store and the cache
 * scoping types shared by offline-visit-cache.ts.
 *
 * On web (dev/preview builds only) expo-secure-store has no implementation
 * and its methods throw, so this falls back to localStorage, the same place
 * the web app keeps its session. Every module needing secure KV storage must
 * import `secureKvStore` from here rather than expo-secure-store directly,
 * or it will crash the web bundle.
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/** Minimal async KV surface, satisfied by expo-secure-store and by test doubles. */
export interface SecureKvStore {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

/** Scopes cached data to a single caregiver + agency so a device switch never leaks it. */
export interface CacheScope {
  userId: string;
  agencyId: string;
}

const secureOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

const nativeStore: SecureKvStore = {
  getItemAsync: (key) => SecureStore.getItemAsync(key, secureOptions),
  setItemAsync: (key, value) => SecureStore.setItemAsync(key, value, secureOptions),
  deleteItemAsync: (key) => SecureStore.deleteItemAsync(key, secureOptions),
};

const webStore: SecureKvStore = {
  getItemAsync: async (key) => (typeof localStorage === 'undefined' ? null : localStorage.getItem(key)),
  setItemAsync: async (key, value) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  },
  deleteItemAsync: async (key) => {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
  },
};

export const secureKvStore: SecureKvStore = Platform.OS === 'web' ? webStore : nativeStore;
