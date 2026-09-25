import { prisma } from '../../../infrastructure/database/prisma.js';
import { SYSTEM_CONSTANTS } from '@ai-companion/config';
import { MemoryEmbeddingService } from './memoryEmbedding.service.js';
import { logger } from '../../../config/logger.js';
import type { Prisma } from '@prisma/client';
import type {
  MemoryItem,
  ScoredMemory,
  RetrievedMemoryContext,
  MemoryScope,
  MemoryCategory,
  MemorySensitivity,
  MemorySignalType,
  MemoryType,
} from '@ai-companion/types';

export interface RetrieveMemoryParams {
  userId: string;
  characterId?: string | null;
  conversationId?: string | null;
  query: string;
  maxTokens?: number;
  maxMemories?: number;
  minScore?: number;
  allowSensitive?: boolean;
}

export class MemoryRetrieverService {
  /**
   * Retrieves, ranks, deduplicates, and formats relevant memories within the specified token budget.
   * Guaranteed to fail gracefully and return empty context if timeouts or errors occur.
   */
  public static async retrieveContext(params: RetrieveMemoryParams): Promise<RetrievedMemoryContext> {
    const startTime = Date.now();
    const {
      userId,
      characterId,
      query,
      maxTokens = SYSTEM_CONSTANTS.MEMORY.MAX_PROMPT_MEMORY_TOKENS,
      maxMemories = SYSTEM_CONSTANTS.MEMORY.MAX_RETRIEVED_MEMORIES,
      minScore = SYSTEM_CONSTANTS.MEMORY.MIN_SIMILARITY_THRESHOLD,
    } = params;

    try {
      // 1. Check User Memory Settings
      const settings = await prisma.userMemorySettings.findUnique({
        where: { userId },
      });

      if (settings && !settings.memoryEnabled) {
        return this.emptyContext(startTime, 0);
      }

      if (characterId && settings && settings.excludedCharacterIds && Array.isArray(settings.excludedCharacterIds)) {
        const excluded = settings.excludedCharacterIds as string[];
        if (excluded.includes(characterId)) {
          return this.emptyContext(startTime, 0);
        }
      }

      const allowSensitive = params.allowSensitive ?? settings?.allowSensitiveMemory ?? false;

      // 2. Fetch candidate memories from PostgreSQL
      const whereCondition: Prisma.MemoryWhereInput = {
        userId,
        status: 'ACTIVE',
        deletedAt: null,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      };

      if (characterId) {
        whereCondition.AND = [
          {
            OR: [
              { scope: 'GLOBAL_USER' },
              { scope: 'CHARACTER_SPECIFIC', characterId },
            ],
          },
        ];
      }

      if (!allowSensitive) {
        whereCondition.sensitivity = {
          in: ['NORMAL', 'SENSITIVE'],
        };
      }

      const candidateRecords = await prisma.memory.findMany({
        where: whereCondition,
        include: {
          embeddings: true,
        },
      });

      if (candidateRecords.length === 0) {
        return this.emptyContext(startTime, 0);
      }

      // 3. Generate embedding for query text
      const queryEmbedding = await MemoryEmbeddingService.generateEmbedding(query);

      // 4. Score each candidate memory
      const scoredCandidates: ScoredMemory[] = [];
      const now = Date.now();

      for (const record of candidateRecords) {
        let memEmbedding: number[] | null = null;
        const firstEmb = record.embeddings && record.embeddings.length > 0 ? record.embeddings[0] : null;
        if (firstEmb && Array.isArray(firstEmb.embedding)) {
          memEmbedding = firstEmb.embedding as unknown as number[];
        }

        if (!memEmbedding) {
          memEmbedding = MemoryEmbeddingService.generateDeterministicPseudoEmbedding(record.content);
        }

        // Semantic Cosine Similarity: [0, 1]
        const rawSim = MemoryEmbeddingService.computeCosineSimilarity(queryEmbedding, memEmbedding);
        const similarityScore = Math.max(0, (rawSim + 1) / 2); // Normalize from [-1, 1] to [0, 1]

        // Recency exponential decay: e^(-lambda * days)
        const lastActivityTime = record.lastReinforcedAt ? new Date(record.lastReinforcedAt).getTime() : new Date(record.createdAt).getTime();
        const daysSinceActivity = Math.max(0, (now - lastActivityTime) / (86400 * 1000));
        const recencyScore = Math.exp(-SYSTEM_CONSTANTS.MEMORY.RECENCY_DECAY_LAMBDA * daysSinceActivity);

        // Importance: [0, 1]
        const importanceScore = record.importanceScore;

        // Confidence: [0, 1]
        const confidenceScore = record.confidenceScore;

        // Reinforcement score: log scale
        const reinforcementScore = Math.min(1.0, 0.25 * Math.log1p(record.reinforcementCount));

        // Deterministic Multi-Factor Ranking Formula
        const weights = SYSTEM_CONSTANTS.MEMORY.WEIGHTS;
        const finalScore =
          weights.SIMILARITY * similarityScore +
          weights.IMPORTANCE * importanceScore +
          weights.RECENCY * recencyScore +
          weights.CONFIDENCE * confidenceScore +
          weights.REINFORCEMENT * reinforcementScore;

        const memoryItem: MemoryItem = {
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
        };

        scoredCandidates.push({
          memory: memoryItem,
          similarityScore,
          importanceScore,
          recencyScore,
          confidenceScore,
          reinforcementScore,
          finalScore,
        });
      }

      // 5. Rank by finalScore descending
      scoredCandidates.sort((a, b) => b.finalScore - a.finalScore);

      // 6. Retrieval Deduplication & Budget Filtering
      const selectedMemories: MemoryItem[] = [];
      const selectedEmbeddings: number[][] = [];
      let accumulatedTokens = 0;

      for (const item of scoredCandidates) {
        if (selectedMemories.length >= maxMemories) break;
        if (item.finalScore < minScore && selectedMemories.length > 0) continue;

        // Check if item is semantically redundant with an already selected memory
        const currentVector = MemoryEmbeddingService.generateDeterministicPseudoEmbedding(item.memory.content);
        let isRedundant = false;

        for (const existingVector of selectedEmbeddings) {
          const sim = MemoryEmbeddingService.computeCosineSimilarity(currentVector, existingVector);
          if (sim >= SYSTEM_CONSTANTS.MEMORY.DUPLICATE_COSINE_THRESHOLD) {
            isRedundant = true;
            break;
          }
        }

        if (isRedundant) continue;

        // Estimate token cost (~4 chars per token)
        const memoryText = `- ${item.memory.content.trim()}`;
        const itemTokens = Math.ceil(memoryText.length / 4) + 2;

        if (accumulatedTokens + itemTokens > maxTokens) {
          break;
        }

        selectedMemories.push(item.memory);
        selectedEmbeddings.push(currentVector);
        accumulatedTokens += itemTokens;
      }

      // 7. Format clean, untrusted prompt block
      const promptLines = selectedMemories.map(m => `- ${m.content.trim()}`);
      const formattedPromptBlock = promptLines.join('\n');

      const latencyMs = Date.now() - startTime;

      // 8. Update recall counters asynchronously
      if (selectedMemories.length > 0) {
        const memoryIds = selectedMemories.map(m => m.id);
        prisma.memory
          .updateMany({
            where: { id: { in: memoryIds } },
            data: {
              recallCount: { increment: 1 },
              lastRecalledAt: new Date(),
            },
          })
          .catch((err: unknown) => logger.warn(`Failed to update recall counts: ${err instanceof Error ? err.message : 'Unknown'}`));

        // Log audit record
        prisma.memoryAccessLog
          .create({
            data: {
              userId,
              characterId,
              queryContext: query.slice(0, 500),
              retrievedMemoryIds: memoryIds,
              totalCandidates: candidateRecords.length,
              selectedCount: selectedMemories.length,
              latencyMs,
            },
          })
          .catch((err: unknown) => logger.warn(`Failed to write memory access log: ${err instanceof Error ? err.message : 'Unknown'}`));
      }

      return {
        memories: selectedMemories,
        formattedPromptBlock,
        tokenCount: accumulatedTokens,
        totalCandidates: candidateRecords.length,
        retrievalLatencyMs: latencyMs,
      };
    } catch (err) {
      logger.error(`Memory retrieval failed: ${err instanceof Error ? err.message : 'Unknown'}`);
      return this.emptyContext(startTime, 0);
    }
  }

  private static emptyContext(startTime: number, totalCandidates: number): RetrievedMemoryContext {
    return {
      memories: [],
      formattedPromptBlock: '',
      tokenCount: 0,
      totalCandidates,
      retrievalLatencyMs: Date.now() - startTime,
    };
  }
}
