import { prisma } from '../../../infrastructure/database/prisma.js';
import { SYSTEM_CONSTANTS } from '@ai-companion/config';
import { MemoryEmbeddingService } from './memoryEmbedding.service.js';
import { logger } from '../../../config/logger.js';
import type { Prisma } from '@prisma/client';
import type { MemoryScope, MemoryCategory } from '@ai-companion/types';

export interface DeduplicationDecision {
  action: 'CREATE' | 'REINFORCE' | 'SUPERSEDE';
  matchedMemoryId?: string;
  supersededMemoryIds?: string[];
  confidenceBoost?: number;
}

export class MemoryDeduplicationService {
  /**
   * Evaluates a candidate memory against active memories for semantic equivalence or conflicts.
   */
  public static async evaluateDeduplication(
    userId: string,
    characterId: string | null | undefined,
    candidateContent: string,
    candidateCategory: MemoryCategory,
    candidateScope: MemoryScope,
    candidateEmbedding?: number[],
  ): Promise<DeduplicationDecision> {
    const normalizedCandidate = candidateContent.trim().toLowerCase();

    // 1. Fetch active memories for this user and scope
    const whereClause: Prisma.MemoryWhereInput = {
      userId,
      status: 'ACTIVE',
      deletedAt: null,
    };

    if (candidateScope === 'CHARACTER_SPECIFIC' && characterId) {
      whereClause.OR = [
        { scope: 'GLOBAL_USER' },
        { scope: 'CHARACTER_SPECIFIC', characterId },
      ];
    }

    const activeMemories = await prisma.memory.findMany({
      where: whereClause,
      include: {
        embeddings: true,
      },
    });

    if (activeMemories.length === 0) {
      return { action: 'CREATE' };
    }

    // Generate candidate embedding if not supplied
    const candVector = candidateEmbedding || await MemoryEmbeddingService.generateEmbedding(candidateContent);

    let highestSimilarity = -1;
    let closestMemory: (typeof activeMemories)[0] | null = null;
    const conflictingMemoryIds: string[] = [];

    for (const mem of activeMemories) {
      const normalizedExisting = mem.content.trim().toLowerCase();

      // Direct exact string or normalized string match
      if (normalizedCandidate === normalizedExisting) {
        return {
          action: 'REINFORCE',
          matchedMemoryId: mem.id,
          confidenceBoost: 0.1,
        };
      }

      // Check vector similarity
      let memVector: number[] | null = null;
      const firstEmb = mem.embeddings && mem.embeddings.length > 0 ? mem.embeddings[0] : null;
      if (firstEmb && Array.isArray(firstEmb.embedding)) {
        memVector = firstEmb.embedding as unknown as number[];
      }

      if (!memVector) {
        memVector = MemoryEmbeddingService.generateDeterministicPseudoEmbedding(mem.content);
      }

      const similarity = MemoryEmbeddingService.computeCosineSimilarity(candVector, memVector);

      if (similarity > highestSimilarity) {
        highestSimilarity = similarity;
        closestMemory = mem;
      }

      // Conflict detection: If memory shares category and has high similarity with opposing sentiment/values
      if (
        mem.category === candidateCategory &&
        similarity >= SYSTEM_CONSTANTS.MEMORY.CONFLICT_COSINE_THRESHOLD &&
        similarity < SYSTEM_CONSTANTS.MEMORY.DUPLICATE_COSINE_THRESHOLD &&
        this.detectPredicateConflict(normalizedCandidate, normalizedExisting)
      ) {
        conflictingMemoryIds.push(mem.id);
      }
    }

    // High semantic similarity -> Reinforce existing memory
    if (closestMemory && highestSimilarity >= SYSTEM_CONSTANTS.MEMORY.DUPLICATE_COSINE_THRESHOLD) {
      logger.info(`Deduplication: Candidate reinforces existing memory ${closestMemory.id} (sim: ${highestSimilarity.toFixed(3)})`);
      return {
        action: 'REINFORCE',
        matchedMemoryId: closestMemory.id,
        confidenceBoost: Math.min(0.15, (1.0 - closestMemory.confidenceScore) * 0.5),
      };
    }

    // Detected conflicting memories -> Supersede them
    if (conflictingMemoryIds.length > 0) {
      logger.info(`Deduplication: Candidate supersedes ${conflictingMemoryIds.length} conflicting memories`);
      return {
        action: 'SUPERSEDE',
        supersededMemoryIds: conflictingMemoryIds,
      };
    }

    return { action: 'CREATE' };
  }

  /**
   * Applies the reinforcement action in the database.
   */
  public static async applyReinforcement(memoryId: string, confidenceBoost: number = 0.05): Promise<void> {
    const memory = await prisma.memory.findUnique({ where: { id: memoryId } });
    if (!memory) return;

    const newConfidence = Math.min(1.0, memory.confidenceScore + confidenceBoost);
    const newImportance = Math.min(1.0, memory.importanceScore + 0.05);

    await prisma.memory.update({
      where: { id: memoryId },
      data: {
        reinforcementCount: { increment: 1 },
        lastReinforcedAt: new Date(),
        confidenceScore: newConfidence,
        importanceScore: newImportance,
      },
    });
  }

  /**
   * Marks older contradictory memories as SUPERSEDED by the newly created memory.
   */
  public static async applySuperseding(newMemoryId: string, supersededMemoryIds: string[]): Promise<void> {
    if (supersededMemoryIds.length === 0) return;

    await prisma.memory.updateMany({
      where: {
        id: { in: supersededMemoryIds },
      },
      data: {
        status: 'SUPERSEDED',
        supersededById: newMemoryId,
      },
    });
  }

  /**
   * Simple heuristic conflict detector for key slots (e.g., "live in", "moved to", "favorite", "prefer").
   */
  private static detectPredicateConflict(textA: string, textB: string): boolean {
    const conflictPredicates = [
      /\b(lives?\s+in|moved\s+to|located\s+in)\b/,
      /\b(favorite|prefers?|likes?|loves?|hates?|dislikes?)\b/,
      /\b(works?\s+as|job\s+is|employed\s+at)\b/,
      /\b(single|married|dating|in\s+a\s+relationship)\b/,
    ];

    for (const pred of conflictPredicates) {
      if (pred.test(textA) && pred.test(textB)) {
        return true;
      }
    }

    return false;
  }
}
