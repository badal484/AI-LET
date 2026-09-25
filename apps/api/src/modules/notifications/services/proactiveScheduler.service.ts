import { prisma } from '../../../infrastructure/database/prisma.js';
import { redis } from '../../../infrastructure/redis/redis.js';
import { logger } from '../../../config/logger.js';
import { SYSTEM_CONSTANTS } from '@ai-companion/config';
import { ProactiveGeneratorService } from './proactiveGenerator.service.js';

export class ProactiveSchedulerService {
  private static readonly LOCK_TTL_MS = SYSTEM_CONSTANTS.PROACTIVITY.DISTRIBUTED_LOCK_TTL_MS; // 30s

  /**
   * Acquires a distributed lock in Redis for a specific user-character proactive execution
   */
  private static async acquireLock(userId: string, characterId: string): Promise<boolean> {
    const lockKey = `lock:proactive:${userId}:${characterId}`;
    try {
      const result = await redis.set(lockKey, 'locked', 'PX', this.LOCK_TTL_MS, 'NX');
      return result === 'OK';
    } catch (err: any) {
      logger.warn(`Redis lock acquisition failed for ${lockKey}: ${err.message}`);
      return false;
    }
  }

  /**
   * Releases the distributed lock
   */
  private static async releaseLock(userId: string, characterId: string): Promise<void> {
    const lockKey = `lock:proactive:${userId}:${characterId}`;
    try {
      await redis.del(lockKey);
    } catch {
      // Ignore del errors
    }
  }

  /**
   * Scans eligible user-character pairs across the platform in batches.
   */
  public static async scanEligibleCandidates(batchLimit = SYSTEM_CONSTANTS.PROACTIVITY.SCANNER_BATCH_SIZE): Promise<{
    candidatesEvaluated: number;
    actionsTriggered: number;
    skippedCount: number;
  }> {
    // 1. Query active conversations with published characters
    const conversations = await prisma.conversation.findMany({
      where: {
        user: { status: 'ACTIVE' },
        character: {
          status: 'PUBLISHED',
          currentPublishedVersionId: { not: null },
        },
      },
      take: batchLimit,
      orderBy: { lastMessageAt: 'asc' },
      select: {
        userId: true,
        characterId: true,
      },
    });

    let actionsTriggered = 0;
    let skippedCount = 0;

    for (const conv of conversations) {
      const { userId, characterId } = conv;

      // Acquire distributed lock to prevent duplicate worker execution
      const acquired = await this.acquireLock(userId, characterId);
      if (!acquired) {
        continue;
      }

      try {
        const result = await ProactiveGeneratorService.processProactiveOutreach({
          userId,
          characterId,
        });

        if (result.isExecuted && result.decision === 'SEND') {
          actionsTriggered++;
        } else {
          skippedCount++;
        }
      } catch (err: any) {
        logger.error(`Error processing candidate ${userId}/${characterId}: ${err.message}`);
        skippedCount++;
      } finally {
        await this.releaseLock(userId, characterId);
      }
    }

    return {
      candidatesEvaluated: conversations.length,
      actionsTriggered,
      skippedCount,
    };
  }

  /**
   * Evaluates and triggers user-scheduled reminders that are due.
   */
  public static async processDueReminders(): Promise<number> {
    const now = new Date();
    const dueReminders = await prisma.userReminder.findMany({
      where: {
        status: 'PENDING',
        targetTime: { lte: now },
      },
      take: 50,
    });

    let triggeredCount = 0;

    for (const reminder of dueReminders) {
      const acquired = await this.acquireLock(reminder.userId, reminder.characterId);
      if (!acquired) continue;

      try {
        const result = await ProactiveGeneratorService.processProactiveOutreach({
          userId: reminder.userId,
          characterId: reminder.characterId,
          forcedIntent: 'USER_REQUESTED_REMINDER',
        });

        if (result.isExecuted) {
          await prisma.userReminder.update({
            where: { id: reminder.id },
            data: {
              status: 'TRIGGERED',
              proactiveActionId: result.actionId || null,
            },
          });
          triggeredCount++;
        }
      } catch (err: any) {
        logger.error(`Failed to trigger due reminder ${reminder.id}: ${err.message}`);
      } finally {
        await this.releaseLock(reminder.userId, reminder.characterId);
      }
    }

    return triggeredCount;
  }

  /**
   * Cancels / expires stale proactive actions
   */
  public static async expireStaleActions(): Promise<number> {
    const now = new Date();
    const result = await prisma.proactiveAction.updateMany({
      where: {
        status: { in: ['CANDIDATE', 'SCHEDULED', 'GENERATING'] },
        expiresAt: { lte: now },
      },
      data: {
        status: 'EXPIRED',
        skipReason: 'LOW_RELEVANCE_CONFIDENCE',
      },
    });

    if (result.count > 0) {
      logger.info(`Expired ${result.count} stale proactive action jobs`);
    }

    return result.count;
  }
}
