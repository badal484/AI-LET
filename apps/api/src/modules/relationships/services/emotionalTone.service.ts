import type { CurrentInteractionState, EmotionalTone, TopicSensitivity } from '@ai-companion/types';
import { redis } from '../../../infrastructure/redis/redis.js';
import { logger } from '../../../config/logger.js';
import { SYSTEM_CONSTANTS } from '@ai-companion/config';

export class EmotionalToneService {
  private static readonly TTL_SECONDS = SYSTEM_CONSTANTS.RELATIONSHIP.EMOTIONAL_STATE_TTL_SECONDS;

  public static getDefaultState(): CurrentInteractionState {
    return {
      tone: 'calm',
      energy: 50,
      warmth: 60,
      seriousness: 40,
      engagement: 60,
      topicSensitivity: 'normal',
      lastUpdated: new Date().toISOString(),
    };
  }

  private static getCacheKey(userId: string, characterId: string): string {
    return `tone:user:${userId}:char:${characterId}`;
  }

  /**
   * Retrieves current conversational affect state from Redis cache.
   * Returns default baseline state if key is expired or missing.
   */
  public static async getCurrentTone(
    userId: string,
    characterId: string,
  ): Promise<CurrentInteractionState> {
    try {
      const cached = await redis.get(this.getCacheKey(userId, characterId));
      if (cached) {
        return JSON.parse(cached) as CurrentInteractionState;
      }
    } catch (err: any) {
      logger.warn(`Redis failed to read emotional tone state: ${err.message}`);
    }

    return this.getDefaultState();
  }

  /**
   * Updates conversational affect state in Redis cache with an ephemeral TTL.
   */
  public static async updateTone(
    userId: string,
    characterId: string,
    update: {
      tone?: EmotionalTone;
      energy?: number;
      warmth?: number;
      seriousness?: number;
      engagement?: number;
      topicSensitivity?: TopicSensitivity;
    },
  ): Promise<CurrentInteractionState> {
    const currentState = await this.getCurrentTone(userId, characterId);

    const newState: CurrentInteractionState = {
      tone: update.tone || currentState.tone,
      energy: this.clamp(update.energy !== undefined ? update.energy : currentState.energy),
      warmth: this.clamp(update.warmth !== undefined ? update.warmth : currentState.warmth),
      seriousness: this.clamp(update.seriousness !== undefined ? update.seriousness : currentState.seriousness),
      engagement: this.clamp(update.engagement !== undefined ? update.engagement : currentState.engagement),
      topicSensitivity: update.topicSensitivity || currentState.topicSensitivity,
      lastUpdated: new Date().toISOString(),
    };

    try {
      await redis.set(
        this.getCacheKey(userId, characterId),
        JSON.stringify(newState),
        'EX',
        this.TTL_SECONDS,
      );
    } catch (err: any) {
      logger.warn(`Redis failed to cache emotional tone state: ${err.message}`);
    }

    return newState;
  }

  /**
   * Resets conversational affect state back to baseline.
   */
  public static async resetTone(userId: string, characterId: string): Promise<void> {
    try {
      await redis.del(this.getCacheKey(userId, characterId));
    } catch (err: any) {
      logger.warn(`Redis failed to delete emotional tone state: ${err.message}`);
    }
  }

  private static clamp(value: number): number {
    return Math.max(0, Math.min(100, Math.round(value)));
  }
}
