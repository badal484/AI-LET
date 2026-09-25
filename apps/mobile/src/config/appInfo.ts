/** Keep in sync with `version` in apps/mobile/package.json (and the native build versionName). */
export const APP_VERSION = '0.1.0';

import { Platform } from 'react-native';

/**
 * API origin. In development the Android emulator reaches the host machine at 10.0.2.2
 * (`localhost` would be the emulator itself); iOS simulators share the host's localhost.
 * Release builds must use the deployed HTTPS origin — set PRODUCTION_API_ORIGIN before shipping.
 */
const PRODUCTION_API_ORIGIN = 'https://api.aicompanion.app';
const DEV_API_ORIGIN = `http://${Platform.OS === 'android' ? '10.0.2.2' : 'localhost'}:4000`;

export const API_ORIGIN = __DEV__ ? DEV_API_ORIGIN : PRODUCTION_API_ORIGIN;
export const API_BASE_URL = `${API_ORIGIN}/api/v1`;
export const WS_ORIGIN = API_ORIGIN.replace(/^http/, 'ws');
