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
        // Over USB (adb reverse) the bundle comes from localhost, and so does the API.
        return match[1];
      }
    }
  } catch {}

  // Bridgeless mode has no scriptURL, so this is the usual path: over USB, adb reverse makes the Mac's
  // API reachable at localhost. (For Wi-Fi without the cable, put the Mac's current IP here — it changes.)
  return 'localhost';
}

export const DEV_API_ORIGIN = `http://${getDevHost()}:4000`;
export const PROD_API_ORIGIN = 'https://ai-let.onrender.com';

// Set to DEV_API_ORIGIN for local development & phone USB testing
export const API_ORIGIN = DEV_API_ORIGIN;
export const API_BASE_URL = `${API_ORIGIN}/api/v1`;
export const WS_ORIGIN = API_ORIGIN.replace(/^http/, 'ws');
