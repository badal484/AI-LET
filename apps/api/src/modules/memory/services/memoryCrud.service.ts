import { prisma } from '../../../infrastructure/database/prisma.js';
import { NotFoundError, ForbiddenError } from '../../../shared/errors/AppError.js';
import { MemoryEmbeddingService } from './memoryEmbedding.service.js';
import { MemorySafetyService } from './memorySafety.service.js';
import type { Prisma } from '@prisma/client';
import type { MemoryListQueryInput, UpdateMemoryInput } from '@ai-companion/validation';
import type {
  MemoryItem,
  MemoryDetail,
  MemoryScope,
  MemoryCategory,
  MemorySensitivity,
  MemorySignalType,
  MemoryType,
} from '@ai-companion/types';

export class MemoryCrudService {
  /**
   * Lists active memories for the user with optional filters and pagination.
   */
  public static async listMemories(
    userId: string,
    query: MemoryListQueryInput,
  ): Promise<{ items: MemoryDetail[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 20, characterId, category, scope, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.MemoryWhereInput = {
      userId,
      status: 'ACTIVE',
      deletedAt: null,
    };

    if (characterId) {
      where.OR = [
        { scope: 'GLOBAL_USER' },
        { scope: 'CHARACTER_SPECIFIC', characterId },
      ];
    }

    if (category) {
      where.category = category;
    }

    if (scope) {
      where.scope = scope;
    }

    if (search) {
      where.content = {
        contains: search,
        mode: 'insensitive',
      };
    }

    const [records, total] = await Promise.all([
      prisma.memory.findMany({
        where,
        include: {
          character: {
            select: {
              name: true,
              slug: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.memory.count({ where }),
    ]);

    const items: MemoryDetail[] = records.map((record: any) => ({
      id: record.id,
      userId: record.userId,
      characterId: record.characterId,
      conversationId: record.conversationId,
      scope: record.scope as MemoryScope,
      category: record.category as MemoryCategory,
      memoryType: record.memoryType as MemoryType,
      content: record.content,
      normalizedContent: record.normalizedContent,
      importanceScore: record.importanceScore,
      confidenceScore: record.confidenceScore,
      sensitivity: record.sensitivity as MemorySensitivity,
      signalType: record.signalType as MemorySignalType,
      status: record.status as any,
      supersededById: record.supersededById,
      sourceMessageId: record.sourceMessageId,
      sourceConversationId: record.sourceConversationId,
      recallCount: record.recallCount,
      lastRecalledAt: record.lastRecalledAt ? record.lastRecalledAt.toISOString() : null,
      reinforcementCount: record.reinforcementCount,
      lastReinforcedAt: record.lastReinforcedAt.toISOString(),
      expiresAt: record.expiresAt ? record.expiresAt.toISOString() : null,
      deletedAt: record.deletedAt ? record.deletedAt.toISOString() : null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      characterName: record.character?.name,
      characterSlug: record.character?.slug,
    }));

    return { items, total, page, limit };
  }

  /**
   * Retrieves a single memory with ownership verification.
   */
  public static async getMemory(userId: string, memoryId: string): Promise<MemoryDetail> {
    const record = await prisma.memory.findUnique({
      where: { id: memoryId },
      include: {
        character: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!record || record.deletedAt) {
      throw new NotFoundError(`Memory with ID '${memoryId}' not found`);
    }

    if (record.userId !== userId) {
      throw new ForbiddenError('You do not have access to this memory');
    }

    return {
      id: record.id,
      userId: record.userId,
      characterId: record.characterId,
      conversationId: record.conversationId,
      scope: record.scope as MemoryScope,
      category: record.category as MemoryCategory,
      memoryType: record.memoryType as MemoryType,
      content: record.content,
      normalizedContent: record.normalizedContent,
      importanceScore: record.importanceScore,
      confidenceScore: record.confidenceScore,
      sensitivity: record.sensitivity as MemorySensitivity,
      signalType: record.signalType as MemorySignalType,
      status: record.status as any,
      supersededById: record.supersededById,
      sourceMessageId: record.sourceMessageId,
      sourceConversationId: record.sourceConversationId,
      recallCount: record.recallCount,
      lastRecalledAt: record.lastRecalledAt ? record.lastRecalledAt.toISOString() : null,
      reinforcementCount: record.reinforcementCount,
      lastReinforcedAt: record.lastReinforcedAt.toISOString(),
      expiresAt: record.expiresAt ? record.expiresAt.toISOString() : null,
      deletedAt: null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      characterName: record.character?.name,
      characterSlug: record.character?.slug,
    };
  }

  /**
   * Updates a user memory (e.g., correcting factual details).
   */
  public static async updateMemory(
    userId: string,
    memoryId: string,
    input: UpdateMemoryInput,
  ): Promise<MemoryItem> {
    const existing = await prisma.memory.findUnique({ where: { id: memoryId } });

    if (!existing || existing.deletedAt) {
      throw new NotFoundError(`Memory with ID '${memoryId}' not found`);
    }

    if (existing.userId !== userId) {
      throw new ForbiddenError('You do not have access to this memory');
    }

    let sanitizedContent = existing.content;
    if (input.content) {
      const evalResult = MemorySafetyService.evaluateCandidate(input.content, input.category || (existing.category as MemoryCategory));
      if (!evalResult.isSafeToStore) {
        throw new Error(`Cannot update memory: ${evalResult.rejectionReason}`);
      }
      sanitizedContent = evalResult.sanitizedContent;
    }

    const updated = await prisma.memory.update({
      where: { id: memoryId },
      data: {
        ...(input.content && { content: sanitizedContent }),
        ...(input.category && { category: input.category }),
        ...(input.scope && { scope: input.scope }),
        ...(input.importanceScore !== undefined && { importanceScore: input.importanceScore }),
      },
    });

    // If content changed, re-generate embedding
    if (input.content) {
      await prisma.memoryEmbedding.deleteMany({ where: { memoryId } });
      await MemoryEmbeddingService.saveMemoryEmbedding(memoryId, sanitizedContent);
    }

    return {
      id: updated.id,
      userId: updated.userId,
      characterId: updated.characterId,
      conversationId: updated.conversationId,
      scope: updated.scope as MemoryScope,
      category: updated.category as MemoryCategory,
      memoryType: updated.memoryType as MemoryType,
      content: updated.content,
      normalizedContent: updated.normalizedContent,
      importanceScore: updated.importanceScore,
      confidenceScore: updated.confidenceScore,
      sensitivity: updated.sensitivity as MemorySensitivity,
      signalType: updated.signalType as MemorySignalType,
      status: updated.status as any,
      supersededById: updated.supersededById,
      sourceMessageId: updated.sourceMessageId,
      sourceConversationId: updated.sourceConversationId,
      recallCount: updated.recallCount,
      lastRecalledAt: updated.lastRecalledAt ? updated.lastRecalledAt.toISOString() : null,
      reinforcementCount: updated.reinforcementCount,
      lastReinforcedAt: updated.lastReinforcedAt.toISOString(),
      expiresAt: updated.expiresAt ? updated.expiresAt.toISOString() : null,
      deletedAt: updated.deletedAt ? updated.deletedAt.toISOString() : null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * Soft-deletes a single memory and removes its embedding.
   */
  public static async deleteMemory(userId: string, memoryId: string): Promise<void> {
    const existing = await prisma.memory.findUnique({ where: { id: memoryId } });

    if (!existing || existing.deletedAt) {
      throw new NotFoundError(`Memory with ID '${memoryId}' not found`);
    }

    if (existing.userId !== userId) {
      throw new ForbiddenError('You do not have access to this memory');
    }

    await prisma.memory.update({
      where: { id: memoryId },
      data: {
        status: 'DELETED',
        deletedAt: new Date(),
      },
    });

    await prisma.memoryEmbedding.deleteMany({
      where: { memoryId },
    });
  }
}
