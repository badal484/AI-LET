import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { MemoryRetrieverService } from '../services/memoryRetriever.service.js';
import { memoryDebugRetrievalSchema } from '@ai-companion/validation';

export class AdminMemoryController {
  /**
   * Aggregates anonymized, privacy-safe analytics for admin inspection.
   */
  public static async getAnalytics(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const [
        totalMemories,
        activeMemories,
        supersededMemories,
        categoryGroups,
        scopeGroups,
        avgMetrics,
        totalRetrievals,
        accessLogs,
      ] = await Promise.all([
        prisma.memory.count(),
        prisma.memory.count({ where: { status: 'ACTIVE', deletedAt: null } }),
        prisma.memory.count({ where: { status: 'SUPERSEDED' } }),
        prisma.memory.groupBy({
          by: ['category'],
          _count: { id: true },
        }),
        prisma.memory.groupBy({
          by: ['scope'],
          _count: { id: true },
        }),
        prisma.memory.aggregate({
          where: { status: 'ACTIVE', deletedAt: null },
          _avg: {
            confidenceScore: true,
            importanceScore: true,
          },
        }),
        prisma.memoryAccessLog.count(),
        prisma.memoryAccessLog.aggregate({
          _avg: { latencyMs: true },
        }),
      ]);

      const categoryCounts: Record<string, number> = {};
      for (const group of categoryGroups) {
        categoryCounts[group.category] = group._count.id;
      }

      const scopeCounts: Record<string, number> = {};
      for (const group of scopeGroups) {
        scopeCounts[group.scope] = group._count.id;
      }

      res.status(200).json({
        success: true,
        data: {
          totalMemories,
          activeMemories,
          supersededMemories,
          categoryCounts,
          scopeCounts,
          averageConfidence: avgMetrics._avg.confidenceScore || 0,
          averageImportance: avgMetrics._avg.importanceScore || 0,
          totalRetrievals,
          avgRetrievalLatencyMs: Math.round(accessLogs._avg.latencyMs || 0),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Dry-run memory retrieval for internal system debugging.
   */
  public static async debugRetrieval(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = memoryDebugRetrievalSchema.parse(req.body);

      const result = await MemoryRetrieverService.retrieveContext({
        userId: input.userId,
        characterId: input.characterId,
        query: input.query,
        maxTokens: input.maxTokens,
        maxMemories: input.maxMemories,
        minScore: input.minScore,
      });

      res.status(200).json({
        success: true,
        data: {
          query: input.query,
          userId: input.userId,
          characterId: input.characterId,
          totalCandidates: result.totalCandidates,
          selectedCount: result.memories.length,
          selectedMemories: result.memories,
          promptBlock: result.formattedPromptBlock,
          tokenCount: result.tokenCount,
          latencyMs: result.retrievalLatencyMs,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
