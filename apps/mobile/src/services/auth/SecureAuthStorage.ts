export interface PersistedAuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in milliseconds
  userId: string;
  email: string;
}

/**
 * Platform-independent Secure Authentication Storage.
 * Wraps secure hardware storage (Keychain/Keystore) in production React Native environments,
 * with memory cache fallback for fast synchronous access.
 */
class SecureAuthStorageService {
  private static cachedSession: PersistedAuthSession | null = null;
  private static storageEngine: {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
    removeItem: (key: string) => Promise<void>;
  } | null = null;

  private static STORAGE_KEY = 'ai_companion_secure_auth_session';

  public static setStorageEngine(engine: {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
    removeItem: (key: string) => Promise<void>;
  }): void {
    SecureAuthStorageService.storageEngine = engine;
  }

  public static async saveSession(session: PersistedAuthSession): Promise<void> {
    SecureAuthStorageService.cachedSession = session;
    try {
      if (SecureAuthStorageService.storageEngine) {
        await SecureAuthStorageService.storageEngine.setItem(
          SecureAuthStorageService.STORAGE_KEY,
          JSON.stringify(session),
        );
      }
    } catch (e) {
      console.warn('SecureAuthStorage: Failed to persist session to disk', e);
    }
  }

  public static async getSession(): Promise<PersistedAuthSession | null> {
    if (SecureAuthStorageService.cachedSession) {
      return SecureAuthStorageService.cachedSession;
    }

    try {
      if (SecureAuthStorageService.storageEngine) {
        const data = await SecureAuthStorageService.storageEngine.getItem(
          SecureAuthStorageService.STORAGE_KEY,
        );
        if (data) {
          SecureAuthStorageService.cachedSession = JSON.parse(data) as PersistedAuthSession;
          return SecureAuthStorageService.cachedSession;
        }
      }
    } catch (e) {
      console.warn('SecureAuthStorage: Failed to retrieve session from disk', e);
    }

    return null;
  }

  public static async updateTokens(accessToken: string, refreshToken: string, expiresInSeconds: number): Promise<void> {
    const current = await SecureAuthStorageService.getSession();
    if (!current) return;

    const updated: PersistedAuthSession = {
      ...current,
      accessToken,
      refreshToken,
      expiresAt: Date.now() + expiresInSeconds * 1000,
    };

    await SecureAuthStorageService.saveSession(updated);
  }

  public static async clearSession(): Promise<void> {
    SecureAuthStorageService.cachedSession = null;
    try {
      if (SecureAuthStorageService.storageEngine) {
        await SecureAuthStorageService.storageEngine.removeItem(
          SecureAuthStorageService.STORAGE_KEY,
        );
      }
    } catch (e) {
      console.warn('SecureAuthStorage: Failed to clear session from disk', e);
    }
  }
}

export const SecureAuthStorage = SecureAuthStorageService;
