import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import { SecureAuthStorage } from '../auth/SecureAuthStorage.js';
import { Analytics } from '../analytics/AnalyticsSDK.js';
import { SocialDraftStorage } from '../../features/social/state/socialClientState.js';

export interface KeyValueStorageEngine {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

/**
 * Secrets (auth tokens) live in the platform keystore (iOS Keychain / Android Keystore), one
 * keychain "service" per key, available only while the device is unlocked.
 */
export const secureStorageEngine: KeyValueStorageEngine = {
  async getItem(key) {
    const entry = await Keychain.getGenericPassword({ service: key });
    return entry ? entry.password : null;
  },
  async setItem(key, value) {
    await Keychain.setGenericPassword('session', value, {
      service: key,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },
  async removeItem(key) {
    await Keychain.resetGenericPassword({ service: key });
  },
};

/** Non-secret local state (analytics offline queue, unsent social drafts). */
export const localStorageEngine: KeyValueStorageEngine = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

let installed = false;

/**
 * Attaches the persistent engines. Must run before the auth store bootstraps, otherwise the saved
 * session is not found and the user is signed out on every app launch.
 */
export function installStorageEngines(): void {
  if (installed) return;
  installed = true;
  SecureAuthStorage.setStorageEngine(secureStorageEngine);
  SocialDraftStorage.setStorageEngine(localStorageEngine);
  Analytics.setStorageEngine(localStorageEngine);
}
