import { getApp } from '@react-native-firebase/app';
import { getCrashlytics, recordError, setCrashlyticsCollectionEnabled, setUserId, log } from '@react-native-firebase/crashlytics';

/**
 * Crash and ANR reports (Firebase Crashlytics, audit H-4). Native crashes, ANRs and uncaught JS errors are
 * reported by Crashlytics itself; this adds the screen errors our ErrorBoundary catches and the account id
 * (an opaque id — never the email, name or chat text). Debug builds never send anything.
 */

const crashlytics = () => {
  try {
    return getCrashlytics(getApp());
  } catch {
    return null; // Firebase not set up in this build
  }
};

export function initCrashReporting(): void {
  const c = crashlytics();
  if (c) void setCrashlyticsCollectionEnabled(c, !__DEV__).catch(() => undefined);
}

export function setCrashUser(userId: string | null): void {
  const c = crashlytics();
  if (c) void setUserId(c, userId ?? '').catch(() => undefined);
}

export function reportScreenError(error: Error, where: string): void {
  const c = crashlytics();
  if (!c) return;
  log(c, `ErrorBoundary: ${where}`);
  recordError(c, error, 'ErrorBoundary');
}
