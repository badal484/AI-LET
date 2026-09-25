import { create } from 'zustand';
import { api, setApiAuthToken, setSessionExpiredHandler } from '../services/api/client.js';
import { SecureAuthStorage } from '../services/auth/SecureAuthStorage.js';
import { RegisterRequestInput, LoginRequestInput } from '@ai-companion/validation';

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
        const session = await SecureAuthStorage.getSession();
        if (!session || !session.accessToken) {
          set({ status: 'unauthenticated', user: null, isLoading: false });
          return;
        }

        setApiAuthToken(session.accessToken);

        // Fetch bootstrap payload with profile and onboarding status
        try {
          const bootstrapRes = await api.get('/bootstrap');
          const boot = bootstrapRes.data.data;

          if (boot.user.status === 'SUSPENDED') {
            set({ status: 'account-suspended', user: boot.user, isLoading: false });
            return;
          }

          const user: UserData = {
            id: boot.user.id,
            email: boot.user.email,
            status: boot.user.status,
            emailVerified: boot.user.emailVerified,
            profile: {
              ...boot.profile,
              onboardingStatus: boot.onboarding.status,
              onboardingCurrentStep: boot.onboarding.currentStep,
              onboardingCompleted:
                boot.onboarding.status === 'COMPLETED' || boot.onboarding.status === 'SKIPPED',
            },
          };

          set({ status: 'authenticated', user, isLoading: false });
        } catch {
          // Fallback to /auth/me
          const response = await api.get('/auth/me');
          const user = response.data.data;

          if (user.status === 'SUSPENDED') {
            set({ status: 'account-suspended', user, isLoading: false });
            return;
          }

          set({ status: 'authenticated', user, isLoading: false });
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
          (err as { message?: string })?.message || 'Login failed. Please check your credentials.';
        set({ isLoading: false, errorMessage: message });
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
        await api.post('/auth/logout', {});
      } catch {
        // Continue clearing client state even if server logout fails
      } finally {
        await SecureAuthStorage.clearSession();
        setApiAuthToken(null);
        set({ status: 'unauthenticated', user: null, isLoading: false, errorMessage: null });
      }
    },

    clearError: () => set({ errorMessage: null }),
  };
});
