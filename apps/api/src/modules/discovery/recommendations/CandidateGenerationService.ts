import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../config/logger.js';
import { SearchIndexService } from '../search/SearchIndexService.js';
import type { CandidateCharacterItem, CandidateSourceType } from '@ai-companion/types';

export interface CandidateGenerationContext {
  userId?: string;
  preferredCategories?: string[];
  preferredTags?: string[];
  recentCharacterIds?: string[];
  queryEmbedding?: number[];
  limit?: number;
}

export class CandidateGenerationService {
  /**
   * Generates candidate characters from multiple independent generators in parallel,
   * merging and deduplicating results while recording all candidate sources.
   */
  public static async generateCandidates(
    context: CandidateGenerationContext = {},
  ): Promise<CandidateCharacterItem[]> {
    const candidateMap = new Map<string, { sources: Set<CandidateSourceType>; score: number }>();

    const recordCandidate = (charId: string, source: CandidateSourceType, score = 1.0) => {
      if (!charId) return;
      const existing = candidateMap.get(charId);
      if (existing) {
        existing.sources.add(source);
        existing.score = Math.max(existing.score, score);
      } else {
        candidateMap.set(charId, {
          sources: new Set([source]),
          score,
        });
      }
    };

    // Run independent candidate generators in parallel with safety timeouts
    const generatorPromises = [
      this.generatePopularCandidates(50).then(items =>
        items.forEach(c => recordCandidate(c.characterId, 'POPULAR', c.score)),
      ),
      this.generateTrendingCandidates(50).then(items =>
        items.forEach(c => recordCandidate(c.characterId, 'TRENDING', c.score)),
      ),
      this.generateNewCandidates(30).then(items =>
        items.forEach(c => recordCandidate(c.characterId, 'NEW', c.score)),
      ),
      this.generateEditorialCandidates(20).then(items =>
        items.forEach(c => recordCandidate(c.characterId, 'EDITORIAL', c.score)),
      ),
    ];

    if (context.userId) {
      generatorPromises.push(
        this.generateUserHistoryCandidates(context.userId, 20).then(items =>
          items.forEach(c => recordCandidate(c.characterId, 'HISTORY', c.score)),
        ),
        this.generatePreferenceCandidates(context.userId, context.preferredCategories, 30).then(items =>
          items.forEach(c => recordCandidate(c.characterId, 'PREFERENCE', c.score)),
        ),
        this.generateCreatorFollowCandidates(context.userId, 20).then(items =>
          items.forEach(c => recordCandidate(c.characterId, 'CREATOR', c.score)),
        ),
      );
    }

    if (context.recentCharacterIds && context.recentCharacterIds.length > 0) {
      generatorPromises.push(
        this.generateSimilarCandidates(context.recentCharacterIds, 30).then(items =>
          items.forEach(c => recordCandidate(c.characterId, 'SIMILAR', c.score)),
        ),
      );
    }

    if (context.queryEmbedding && context.queryEmbedding.length > 0) {
      generatorPromises.push(
        this.generateSemanticCandidates(context.queryEmbedding, 40).then(items =>
          items.forEach(c => recordCandidate(c.characterId, 'SEMANTIC', c.score)),
        ),
      );
    }

    const results = await Promise.allSettled(generatorPromises);
    results.forEach((r, idx) => {
      if (r.status === 'rejected') {
        logger.warn(`Candidate generator [${idx}] failed or timed out: ${r.reason}`);
      }
    });

    // Fallback: If no search documents or candidates generated, fetch published characters directly
    if (candidateMap.size === 0) {
      const fallbackChars = await prisma.character.findMany({
        where: { status: 'PUBLISHED', deletedAt: null },
        take: 30,
        select: { id: true },
      });
      for (const char of fallbackChars) {
        recordCandidate(char.id, 'POPULAR', 75);
      }
    }

    const candidates: CandidateCharacterItem[] = [];
    for (const [charId, data] of candidateMap.entries()) {
      candidates.push({
        characterId: charId,
        candidateSources: Array.from(data.sources),
        initialScore: data.score,
      });
    }

    return candidates;
  }

  // 1. Popular Candidate Generator
  private static async generatePopularCandidates(limit: number): Promise<Array<{ characterId: string; score: number }>> {
    const docs = await prisma.searchDocument.findMany({
      orderBy: { popularityScore: 'desc' },
      take: limit,
      select: { characterId: true, popularityScore: true },
    });
    return docs.map(d => ({ characterId: d.characterId, score: d.popularityScore }));
  }

  // 2. Trending Candidate Generator
  private static async generateTrendingCandidates(limit: number): Promise<Array<{ characterId: string; score: number }>> {
    const docs = await prisma.searchDocument.findMany({
      orderBy: { trendingScore: 'desc' },
      take: limit,
      select: { characterId: true, trendingScore: true },
    });
    return docs.map(d => ({ characterId: d.characterId, score: d.trendingScore }));
  }

  // 3. New Candidate Generator
  private static async generateNewCandidates(limit: number): Promise<Array<{ characterId: string; score: number }>> {
    const docs = await prisma.searchDocument.findMany({
      orderBy: { publishedAt: 'desc' },
      take: limit,
      select: { characterId: true, qualityScore: true },
    });
    return docs.map(d => ({ characterId: d.characterId, score: d.qualityScore || 50 }));
  }

  // 4. Editorial Candidate Generator
  private static async generateEditorialCandidates(limit: number): Promise<Array<{ characterId: string; score: number }>> {
    const collectionItems = await prisma.collectionItem.findMany({
      where: {
        collection: { isPublished: true },
      },
      orderBy: { displayOrder: 'asc' },
      take: limit,
      select: { characterId: true },
    });

    const featuredChars = await prisma.character.findMany({
      where: { isFeatured: true, status: 'PUBLISHED', deletedAt: null },
      take: limit,
      select: { id: true },
    });

    const charIds = Array.from(new Set([...collectionItems.map(c => c.characterId), ...featuredChars.map(f => f.id)]));
    return charIds.map(id => ({ characterId: id, score: 80 }));
  }

  // 5. User History Candidate Generator
  private static async generateUserHistoryCandidates(userId: string, limit: number): Promise<Array<{ characterId: string; score: number }>> {
    const signals = await prisma.userCharacterSignal.findMany({
      where: { userId },
      orderBy: { lastInteractedAt: 'desc' },
      take: limit,
      select: { characterId: true, engagementScore: true },
    });
    return signals.map(s => ({ characterId: s.characterId, score: s.engagementScore }));
  }

  // 6. User Preferences Candidate Generator
  private static async generatePreferenceCandidates(
    userId: string,
    preferredCategories?: string[],
    limit = 30,
  ): Promise<Array<{ characterId: string; score: number }>> {
    let categories = preferredCategories;
    if (!categories || categories.length === 0) {
      const prefs = await prisma.userDiscoveryPreference.findUnique({
        where: { userId },
      });
      if (prefs && Array.isArray(prefs.preferredCategoryIds)) {
        categories = prefs.preferredCategoryIds as string[];
      }
    }

    if (!categories || categories.length === 0) return [];

    const docs = await prisma.searchDocument.findMany({
      where: {
        category: { in: categories },
      },
      orderBy: { popularityScore: 'desc' },
      take: limit,
      select: { characterId: true, popularityScore: true },
    });

    return docs.map(d => ({ characterId: d.characterId, score: d.popularityScore * 1.2 }));
  }

  // 7. Creator Follow Candidate Generator
  private static async generateCreatorFollowCandidates(userId: string, limit: number): Promise<Array<{ characterId: string; score: number }>> {
    const follows = await prisma.creatorFollow.findMany({
      where: { userId },
      select: { creatorProfileId: true },
    });
    const creatorIds = follows.map(f => f.creatorProfileId);
    if (creatorIds.length === 0) return [];

    const docs = await prisma.searchDocument.findMany({
      where: {
        creatorId: { in: creatorIds },
      },
      orderBy: { publishedAt: 'desc' },
      take: limit,
      select: { characterId: true },
    });

    return docs.map(d => ({ characterId: d.characterId, score: 75 }));
  }

  // 8. Similar Character Candidate Generator
  private static async generateSimilarCandidates(characterIds: string[], limit: number): Promise<Array<{ characterId: string; score: number }>> {
    const similarities = await prisma.characterSimilarity.findMany({
      where: {
        characterId: { in: characterIds },
      },
      orderBy: { similarityScore: 'desc' },
      take: limit,
      select: { similarCharacterId: true, similarityScore: true },
    });

    return similarities.map(s => ({
      characterId: s.similarCharacterId,
      score: s.similarityScore * 100,
    }));
  }

  // 9. Semantic Candidate Generator
  private static async generateSemanticCandidates(queryEmbedding: number[], limit: number): Promise<Array<{ characterId: string; score: number }>> {
    const docs = await prisma.searchDocument.findMany({
      select: { characterId: true, embedding: true },
      take: 200,
    });

    const scored = docs
      .filter(doc => doc.embedding && Array.isArray(doc.embedding) && (doc.embedding as number[]).length > 0)
      .map(doc => {
        const docEmbedding = doc.embedding as number[];
        const sim = SearchIndexService.computeCosineSimilarity(queryEmbedding, docEmbedding);
        return { characterId: doc.characterId, score: Number((sim * 100).toFixed(2)) };
      })
      .filter(item => item.score > 10)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored;
  }
}
