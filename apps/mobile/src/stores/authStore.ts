import { create } from 'zustand';
import { api, setApiAuthToken, setSessionExpiredHandler } from '../services/api/client.js';
import { SecureAuthStorage } from '../services/auth/SecureAuthStorage.js';
import { RegisterRequestInput, LoginRequestInput } from '@ai-companion/validation';
import { PushService } from '../services/push/PushService.js';
import { ToastService } from '../components/common/Toast.js';
import { Platform } from 'react-native';
import { APP_VERSION } from '../config/appInfo.js';
import { signOutOfGoogle } from '../services/auth/googleSignIn.js';

export type AuthStateStatus =
  | 'initializing'
  | 'authenticated'
  | 'unauthenticated'
  | 'session-expired'
  | 'account-suspended'
  | 'error';

export interface UserProfileData {
  id: string;
  displayName: string;
  username?: string | null;
  avatarUrl?: string | null;
  locale?: string;
  timezone?: string;
  preferredLanguage?: string;
  conversationStyle?: string;
  onboardingCompleted?: boolean;
  onboardingStatus?: string;
  onboardingCurrentStep?: string;
}

export interface UserData {
  id: string;
  email: string;
  status: string;
  emailVerified: boolean;
  profile?: UserProfileData | null;
}

interface AuthState {
  status: AuthStateStatus;
  user: UserData | null;
  isLoading: boolean;
  errorMessage: string | null;

  bootstrap: () => Promise<void>;
  login: (input: LoginRequestInput) => Promise<void>;
  register: (input: RegisterRequestInput) => Promise<void>;
  /** "Continue with Google" with the ID token from Google's picker. Rejects with code AGE_CONFIRMATION_REQUIRED for a new account without the 18+ confirmation. */
  googleSignIn: (idToken: string, ageConfirmed?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => {
  // Register global session expiration handler
  setSessionExpiredHandler(() => {
    set({
      status: 'session-expired',
      user: null,
      errorMessage: 'Your session has expired. Please sign in again.',
    });
  });

  return {
    status: 'initializing',
    user: null,
    isLoading: false,
    errorMessage: null,

    bootstrap: async () => {
      try {
        const session = await Promise.race([
          SecureAuthStorage.getSession(),
          new Promise<null>((res) => setTimeout(() => res(null), 2000)),
        ]);

        if (!session || !session.accessToken) {
          set({ status: 'unauthenticated', user: null, isLoading: false });
          return;
        }

        setApiAuthToken(session.accessToken);

        try {
          const bootstrapRes = await api.get('/bootstrap', { timeout: 3000 });
          const boot = bootstrapRes.data.data;

          if (boot.user.status === 'SUSPENDED') {
            set({ status: 'account-suspended', user: boot.user, isLoading: false });
            return;
          }

          // The server's real onboarding status. (It used to be forced to "completed" here, so closing the app
          // before finishing setup skipped the language, gender and age questions for good.) Unknown → not blocked.
          const onboardingStatus: string | undefined = boot.onboarding?.status ?? boot.profile?.onboardingStatus;
          const user: UserData = {
            id: boot.user.id,
            email: boot.user.email,
            status: boot.user.status,
            emailVerified: boot.user.emailVerified,
            profile: {
              ...boot.profile,
              onboardingStatus: onboardingStatus ?? 'COMPLETED',
              onboardingCurrentStep: boot.onboarding?.currentStep ?? boot.profile?.onboardingCurrentStep ?? 'COMPLETED',
              onboardingCompleted: onboardingStatus ? onboardingStatus === 'COMPLETED' || onboardingStatus === 'SKIPPED' : true,
            },
          };

          set({ status: 'authenticated', user, isLoading: false });
        } catch {
          try {
            const response = await api.get('/auth/me', { timeout: 3000 });
            const user = response.data.data;

            if (user.status === 'SUSPENDED') {
              set({ status: 'account-suspended', user, isLoading: false });
              return;
            }

            set({ status: 'authenticated', user, isLoading: false });
          } catch {
            await SecureAuthStorage.clearSession();
            setApiAuthToken(null);
            set({ status: 'unauthenticated', user: null, isLoading: false });
          }
        }
      } catch {
        await SecureAuthStorage.clearSession();
        setApiAuthToken(null);
        set({ status: 'unauthenticated', user: null, isLoading: false });
      }
    },

    login: async (input: LoginRequestInput) => {
      set({ isLoading: true, errorMessage: null });
      try {
        const response = await api.post('/auth/login', input);
        const { user, tokens, deletionCancelled } = response.data.data;

        await SecureAuthStorage.saveSession({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: Date.now() + tokens.expiresIn * 1000,
          userId: user.id,
          email: user.email,
        });

        setApiAuthToken(tokens.accessToken);
        set({ status: 'authenticated', user, isLoading: false, errorMessage: null });
        // Signing in during the 14-day grace period cancels "Delete account".
        if (deletionCancelled) ToastService.show({ message: 'Welcome back! Your account will not be deleted.', type: 'success', duration: 4000 });
      } catch (err: unknown) {
        const message =
          (err as { message?: string })?.message || 'Login failed. Please check your credentials.';
        set({ isLoading: false, errorMessage: message });
        throw err;
      }
    },

    googleSignIn: async (idToken: string, ageConfirmed?: boolean) => {
      set({ isLoading: true, errorMessage: null });
      try {
        const response = await api.post('/auth/google', {
          idToken,
          ...(ageConfirmed ? { ageConfirmed: true } : {}),
          device: {
            platform: Platform.OS === 'ios' ? 'ios' : 'android',
            deviceName: `${Platform.OS.toUpperCase()} Mobile Client`,
            appVersion: APP_VERSION,
            osVersion: String(Platform.Version),
          },
        });
        const { user, tokens, deletionCancelled } = response.data.data;
        await SecureAuthStorage.saveSession({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: Date.now() + tokens.expiresIn * 1000,
          userId: user.id,
          email: user.email,
        });
        setApiAuthToken(tokens.accessToken);
        set({ status: 'authenticated', user, isLoading: false, errorMessage: null });
        if (deletionCancelled) ToastService.show({ message: 'Welcome back! Your account will not be deleted.', type: 'success', duration: 4000 });
      } catch (err: unknown) {
        // A new account needs the 18+ confirmation: the button asks, so no error banner for that.
        const code = (err as { code?: string })?.code;
        set({ isLoading: false, errorMessage: code === 'AGE_CONFIRMATION_REQUIRED' ? null : (err as { message?: string })?.message || 'Google sign-in failed. Please try again.' });
        throw err;
      }
    },

    register: async (input: RegisterRequestInput) => {
      set({ isLoading: true, errorMessage: null });
      try {
        const response = await api.post('/auth/register', input);
        const { user, tokens } = response.data.data;

        await SecureAuthStorage.saveSession({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: Date.now() + tokens.expiresIn * 1000,
          userId: user.id,
          email: user.email,
        });

        setApiAuthToken(tokens.accessToken);
        set({ status: 'authenticated', user, isLoading: false, errorMessage: null });
      } catch (err: unknown) {
        const message =
          (err as { message?: string })?.message || 'Registration failed. Please try again.';
        set({ isLoading: false, errorMessage: message });
        throw err;
      }
    },

    logout: async () => {
      set({ isLoading: true });
      try {
        // While still signed in: this account stops getting pushes on this phone.
        await PushService.unregister();
        await api.post('/auth/logout', {});
      } catch {
        // Continue clearing client state even if server logout fails
      } finally {
        await SecureAuthStorage.clearSession();
        setApiAuthToken(null);
        void signOutOfGoogle(); // the Google account picker shows again next time
        set({ status: 'unauthenticated', user: null, isLoading: false, errorMessage: null });
      }
    },

    clearError: () => set({ errorMessage: null }),
  };
});
