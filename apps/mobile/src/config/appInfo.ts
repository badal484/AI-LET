/** Keep in sync with `version` in apps/mobile/package.json (and the native build versionName). */
export const APP_VERSION = '0.1.0';

import { NativeModules } from 'react-native';

/**
 * Determine development host IP dynamically:
 * 1. From Metro bundle scriptURL if available (supports whatever IP Metro served to the phone)
 * 2. Fallback to Mac Wi-Fi LAN IP (192.168.1.45) for physical Android devices
 * 3. Fallback to localhost for iOS simulator or when adb reverse is active
 */
function getDevHost(): string {
  try {
    const scriptURL: string | undefined = (NativeModules as any)?.SourceCode?.scriptURL;
    if (scriptURL) {
      const match = scriptURL.match(/^https?:\/\/([^:/]+)/);
      if (match && match[1] && match[1] !== '127.0.0.1' && match[1] !== 'localhost') {
        return match[1];
      }
    }
  } catch {}

  // 192.168.1.45 is Mac Wi-Fi LAN IP reachable from physical Android device
  return '192.168.1.45';
}

const PRODUCTION_API_ORIGIN = 'https://api.aicompanion.app';
const DEV_API_ORIGIN = `http://${getDevHost()}:4000`;

const isDev = typeof __DEV__ !== 'undefined' ? Boolean(__DEV__) : process.env.NODE_ENV !== 'production';
export const API_ORIGIN = isDev ? DEV_API_ORIGIN : PRODUCTION_API_ORIGIN;
export const API_BASE_URL = `${API_ORIGIN}/api/v1`;
export const WS_ORIGIN = API_ORIGIN.replace(/^http/, 'ws');
