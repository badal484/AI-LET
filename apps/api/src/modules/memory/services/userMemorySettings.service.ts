import { prisma } from '../../../infrastructure/database/prisma.js';
import { redis } from '../../../infrastructure/redis/redis.js';
import { SYSTEM_CONSTANTS } from '@ai-companion/config';
import { logger } from '../../../config/logger.js';
import type { UserMemorySettingsData, UpdateUserMemorySettingsInput } from '@ai-companion/types';

export class UserMemorySettingsService {
  private static readonly CACHE_PREFIX = 'user:memory:settings:';

  /**
   * Retrieves or initializes default memory settings for a user.
   */
  public static async getSettings(userId: string): Promise<UserMemorySettingsData> {
    const cacheKey = `${this.CACHE_PREFIX}${userId}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as UserMemorySettingsData;
      }
    } catch (err) {
      logger.debug(`Redis cache read failed for memory settings: ${err instanceof Error ? err.message : 'Unknown'}`);
    }

    let record = await prisma.userMemorySettings.findUnique({
      where: { userId },
    });

    if (!record) {
      record = await prisma.userMemorySettings.create({
        data: {
          userId,
          memoryEnabled: true,
          personalizationEnabled: true,
          allowSensitiveMemory: false,
          allowGlobalMemory: true,
          retentionDays: 365,
          excludedCharacterIds: [],
        },
      });
    }

    const data: UserMemorySettingsData = {
      id: record.id,
      userId: record.userId,
      memoryEnabled: record.memoryEnabled,
      personalizationEnabled: record.personalizationEnabled,
      allowSensitiveMemory: record.allowSensitiveMemory,
      allowGlobalMemory: record.allowGlobalMemory,
      retentionDays: record.retentionDays,
      excludedCharacterIds: (record.excludedCharacterIds as string[]) || [],
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };

    try {
      await redis.set(cacheKey, JSON.stringify(data), 'EX', SYSTEM_CONSTANTS.CACHE.USER_MEMORY_SETTINGS_TTL_SECONDS);
    } catch (err) {
      logger.debug(`Redis cache write failed for memory settings: ${err instanceof Error ? err.message : 'Unknown'}`);
    }

    return data;
  }

  /**
   * Updates user memory settings and invalidates cache.
   */
  public static async updateSettings(
    userId: string,
    input: UpdateUserMemorySettingsInput,
  ): Promise<UserMemorySettingsData> {
    await this.getSettings(userId); // ensure created

    const updated = await prisma.userMemorySettings.update({
      where: { userId },
      data: {
        ...(input.memoryEnabled !== undefined && { memoryEnabled: input.memoryEnabled }),
        ...(input.personalizationEnabled !== undefined && { personalizationEnabled: input.personalizationEnabled }),
        ...(input.allowSensitiveMemory !== undefined && { allowSensitiveMemory: input.allowSensitiveMemory }),
        ...(input.allowGlobalMemory !== undefined && { allowGlobalMemory: input.allowGlobalMemory }),
        ...(input.retentionDays !== undefined && { retentionDays: input.retentionDays }),
        ...(input.excludedCharacterIds !== undefined && { excludedCharacterIds: input.excludedCharacterIds }),
      },
    });

    const data: UserMemorySettingsData = {
      id: updated.id,
      userId: updated.userId,
      memoryEnabled: updated.memoryEnabled,
      personalizationEnabled: updated.personalizationEnabled,
      allowSensitiveMemory: updated.allowSensitiveMemory,
      allowGlobalMemory: updated.allowGlobalMemory,
      retentionDays: updated.retentionDays,
      excludedCharacterIds: (updated.excludedCharacterIds as string[]) || [],
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };

    const cacheKey = `${this.CACHE_PREFIX}${userId}`;
    try {
      await redis.del(cacheKey);
    } catch (err) {
      logger.debug(`Redis cache delete failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    }

    return data;
  }

  /**
   * Implements "Forget Everything": Soft-deletes all memories for the user,
   * purges their embeddings, and invalidates retrieval caches with privacy compliance.
   */
  public static async forgetAllMemories(userId: string): Promise<{ deletedCount: number }> {
    const memoryRecords = await prisma.memory.findMany({
      where: { userId, deletedAt: null },
      select: { id: true },
    });

    const memoryIds = memoryRecords.map((m: { id: string }) => m.id);

    // 1. Soft-delete memory records
    const updateResult = await prisma.memory.updateMany({
      where: { userId, deletedAt: null },
      data: {
        status: 'DELETED',
        deletedAt: new Date(),
      },
    });

    // 2. Remove embeddings to prevent vector leakage
    if (memoryIds.length > 0) {
      await prisma.memoryEmbedding.deleteMany({
        where: {
          memoryId: { in: memoryIds },
        },
      });
    }

    // 3. Clear cache
    const cacheKey = `${this.CACHE_PREFIX}${userId}`;
    try {
      await redis.del(cacheKey);
    } catch (err) {
      logger.debug(`Redis cache delete failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    }

    // 4. Record security audit log (without logging private content)
    await prisma.auditLog.create({
      data: {
        actorType: 'USER',
        actorId: userId,
        action: 'MEMORY_FORGET_ALL',
        resourceType: 'MEMORY',
        resourceId: userId,
        metadata: { deletedCount: updateResult.count },
      },
    });

    logger.info(`User ${userId} requested 'Forget All Memories' - ${updateResult.count} memories cleared.`);

    return { deletedCount: updateResult.count };
  }
}
