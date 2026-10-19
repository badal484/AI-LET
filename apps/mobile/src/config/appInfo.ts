import { NativeModules } from 'react-native';

/** The installed build's version (e.g. 0.1.9), read from Android; '0.1.0' when the native piece is missing (tests). */
const nativeVersion: unknown = NativeModules.AppVersion?.versionName;
export const APP_VERSION: string = typeof nativeVersion === 'string' && nativeVersion ? nativeVersion : '0.1.0';

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
export const PROD_API_ORIGIN = 'https://ai-let-fgx6.onrender.com'; // Render service "AI-LET"

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

/**
 * "Continue with Google": the Web client ID of the Firebase project (lovira-67146, Authentication → Google), which Google calls the server
 * client ID — the ID token is issued for it and our API checks it (GOOGLE_WEB_CLIENT_ID on the server). Public.
 * Android sign-in also needs an Android client per signing key (package + SHA-1) in the same project.
 */
export const GOOGLE_WEB_CLIENT_ID = '472698948443-v1cfrbgcpehb8k52uree0hla0im2fqd0.apps.googleusercontent.com';
