import { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin';
import { GOOGLE_WEB_CLIENT_ID } from '../../config/appInfo.js';

let configured = false;
const configure = () => {
  if (configured) return;
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, scopes: ['email', 'profile'] });
  configured = true;
};

/**
 * Opens Google's account picker and returns the ID token for our server, or null when they closed it.
 * Throws a readable message for real problems (no Google Play services, network).
 */
export async function getGoogleIdToken(): Promise<string | null> {
  configure();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    if (!isSuccessResponse(res)) return null; // closed the picker
    if (!res.data.idToken) throw new Error('Google did not return a sign-in token. Please try again.');
    return res.data.idToken;
  } catch (err) {
    if (isErrorWithCode(err)) {
      if (err.code === statusCodes.SIGN_IN_CANCELLED || err.code === statusCodes.IN_PROGRESS) return null;
      if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) throw new Error('Google Play services are needed to sign in with Google.');
    }
    // Google's code says why (10 = this app's package/SHA-1 isn't registered in Google Cloud, 12500 = consent
    // screen / test users, 7 = network): shown so it can be fixed instead of guessed.
    const code = isErrorWithCode(err) ? String(err.code) : 'unknown';
    console.warn(`[GoogleSignIn] failed: code=${code} ${(err as Error)?.message ?? ''}`);
    throw new Error(`Could not sign in with Google (code ${code}). Please try again.`);
  }
}

/** On sign-out: forget the Google account here too, so the picker shows next time. */
export async function signOutOfGoogle(): Promise<void> {
  configure();
  await GoogleSignin.signOut().catch(() => undefined);
}
