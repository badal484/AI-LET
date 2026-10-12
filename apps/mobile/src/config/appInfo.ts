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
export const PROD_API_ORIGIN = 'https://lovira-api.onrender.com'; // render.yaml service "lovira-api"

// Development builds talk to the Mac (USB / Wi-Fi); release builds always use the production server.
// To try a release build against the Mac, temporarily set this to DEV_API_ORIGIN (release builds allow
// plain HTTP only to localhost).
export const API_ORIGIN = __DEV__ ? DEV_API_ORIGIN : PROD_API_ORIGIN;
export const API_BASE_URL = `${API_ORIGIN}/api/v1`;
export const WS_ORIGIN = API_ORIGIN.replace(/^http/, 'ws');

/** Public legal pages served by the API (/legal/*): privacy policy, terms, account deletion. */
export const LEGAL_URLS = {
  privacy: `${API_ORIGIN}/legal/privacy`,
  terms: `${API_ORIGIN}/legal/terms`,
} as const;
