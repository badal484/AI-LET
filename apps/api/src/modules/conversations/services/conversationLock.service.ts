import { redis } from '../../../infrastructure/redis/redis.js';
import { logger } from '../../../config/logger.js';
import { SYSTEM_CONSTANTS } from '@ai-companion/config';

export class ConversationLockManager {
  private static TTL_SECONDS = SYSTEM_CONSTANTS.CHAT.CONVERSATION_LOCK_TTL_SECONDS || 60;

  /**
   * Attempts to acquire an exclusive lock for a conversation.
   * Returns a lock token if acquired, or null if already locked.
   */
  public static async acquireLock(
    conversationId: string,
    holderId: string,
  ): Promise<string | null> {
    const key = `conv:lock:${conversationId}`;
    const token = `${holderId}:${Date.now()}`;

    try {
      // Atomic SET IF NOT EXISTS with TTL
      const result = await redis.set(key, token, 'EX', this.TTL_SECONDS, 'NX');
      if (result === 'OK') {
        return token;
      }
      return null;
    } catch (err) {
      logger.warn(`Redis lock acquisition error for ${key}: ${(err as Error).message}`);
      // Fail open safely in degraded environment but log warning
      return token;
    }
  }

  /**
   * Releases the conversation lock if the token matches.
   */
  public static async releaseLock(conversationId: string, token: string): Promise<void> {
    const key = `conv:lock:${conversationId}`;

    try {
      const currentToken = await redis.get(key);
      if (currentToken === token) {
        await redis.del(key);
      }
    } catch (err) {
      logger.warn(`Redis lock release error for ${key}: ${(err as Error).message}`);
    }
  }

  /**
   * Checks if a conversation is currently actively generating.
   */
  public static async isLocked(conversationId: string): Promise<boolean> {
    const key = `conv:lock:${conversationId}`;
    try {
      const exists = await redis.exists(key);
      return exists === 1;
    } catch {
      return false;
    }
  }
}
