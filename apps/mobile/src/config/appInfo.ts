/** Keep in sync with `version` in apps/mobile/package.json (and the native build versionName). */
export const APP_VERSION = '0.1.0';

import { NativeModules } from 'react-native';

/**
 * Determine development host IP dynamically:
 * 1. For Android with adb reverse (or iOS simulator), localhost routes directly over USB tunnel
 * 2. If running standalone on device, extract from Metro bundle scriptURL
 */
function getDevHost(): string {
  try {
    const scriptURL: string | undefined = (NativeModules as any)?.SourceCode?.scriptURL;
    if (scriptURL) {
      const match = scriptURL.match(/^https?:\/\/([^:/]+)/);
      if (match && match[1]) {
        return match[1];
      }
    }
  } catch {}

  // Fallback to localhost
  return 'localhost';
}

const PRODUCTION_API_ORIGIN = 'https://api.aicompanion.app';
const DEV_API_ORIGIN = `http://${getDevHost()}:4000`;

const isDev = typeof __DEV__ !== 'undefined' ? Boolean(__DEV__) : process.env.NODE_ENV !== 'production';
export const API_ORIGIN = isDev ? DEV_API_ORIGIN : PRODUCTION_API_ORIGIN;
export const API_BASE_URL = `${API_ORIGIN}/api/v1`;
export const WS_ORIGIN = API_ORIGIN.replace(/^http/, 'ws');
