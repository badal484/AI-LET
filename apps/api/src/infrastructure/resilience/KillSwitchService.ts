import { redis } from '../redis/redis.js';
import { logger } from '../../config/logger.js';

export type KillSwitchKey =
  | 'DISABLE_MEDIA_GENERATION'
  | 'DISABLE_VOICE_CALLS'
  | 'DISABLE_PROACTIVE_MESSAGES'
  | 'DISABLE_EXPENSIVE_MODELS'
  | 'DISABLE_DISCOVERY_PERSONALIZATION'
  | 'DISABLE_USER_REGISTRATIONS'
  | 'FORCE_MAINTENANCE_MODE';

export interface KillSwitchItem {
  key: KillSwitchKey;
  isEnabled: boolean;
  reason?: string;
  updatedByAdminId?: string;
  updatedAt: string;
}

export class KillSwitchService {
  private static readonly REDIS_PREFIX = 'killswitch:';

  private static defaultFlags: Record<KillSwitchKey, boolean> = {
    DISABLE_MEDIA_GENERATION: false,
    DISABLE_VOICE_CALLS: false,
    DISABLE_PROACTIVE_MESSAGES: false,
    DISABLE_EXPENSIVE_MODELS: false,
    DISABLE_DISCOVERY_PERSONALIZATION: false,
    DISABLE_USER_REGISTRATIONS: false,
    FORCE_MAINTENANCE_MODE: false,
  };

  /**
   * Checks whether an emergency kill switch is currently active.
   */
  public static async isKillSwitchActive(key: KillSwitchKey): Promise<boolean> {
    try {
      const val = await redis.get(`${this.REDIS_PREFIX}${key}`);
      if (val !== null) {
        return val === 'true';
      }
      return this.defaultFlags[key] || false;
    } catch (err) {
      logger.warn(`[KillSwitch] Redis read failed for ${key}, falling back to default`, { error: err });
      return this.defaultFlags[key] || false;
    }
  }

  /**
   * Lists all kill switches with current statuses.
   */
  public static async getAllKillSwitches(): Promise<KillSwitchItem[]> {
    const keys: KillSwitchKey[] = [
      'DISABLE_MEDIA_GENERATION',
      'DISABLE_VOICE_CALLS',
      'DISABLE_PROACTIVE_MESSAGES',
      'DISABLE_EXPENSIVE_MODELS',
      'DISABLE_DISCOVERY_PERSONALIZATION',
      'DISABLE_USER_REGISTRATIONS',
      'FORCE_MAINTENANCE_MODE',
    ];

    const results: KillSwitchItem[] = [];

    for (const key of keys) {
      try {
        const val = await redis.get(`${this.REDIS_PREFIX}${key}`);
        results.push({
          key,
          isEnabled: val === 'true',
          updatedAt: new Date().toISOString(),
        });
      } catch {
        results.push({
          key,
          isEnabled: this.defaultFlags[key],
          updatedAt: new Date().toISOString(),
        });
      }
    }

    return results;
  }

  /**
   * Sets the status of a kill switch with administrative audit log.
   */
  public static async setKillSwitch(
    key: KillSwitchKey,
    enabled: boolean,
    adminId?: string,
    reason?: string,
  ): Promise<KillSwitchItem> {
    await redis.set(`${this.REDIS_PREFIX}${key}`, enabled ? 'true' : 'false');

    logger.warn(`🚨 [KillSwitch] Status changed for '${key}': ${enabled ? 'ACTIVATED' : 'DEACTIVATED'}`, {
      adminId,
      reason,
      key,
      enabled,
    });

    return {
      key,
      isEnabled: enabled,
      reason,
      updatedByAdminId: adminId,
      updatedAt: new Date().toISOString(),
    };
  }
}
