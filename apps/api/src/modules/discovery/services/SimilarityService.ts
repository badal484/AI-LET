import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../config/logger.js';
import { SearchIndexService } from '../search/SearchIndexService.js';
import { CatalogService } from '../catalogs/CatalogService.js';
import { CharacterEligibilityService } from './CharacterEligibilityService.js';
import type { CharacterCatalogItem } from '@ai-companion/types';

export class SimilarityService {
  /**
   * Precomputes and updates top similar characters for a specific character.
   */
  public static async computeSimilaritiesForCharacter(characterId: string, topK = 10): Promise<void> {
    const targetDoc = await prisma.searchDocument.findUnique({
      where: { characterId },
    });

    if (!targetDoc) return;

    const allDocs = await prisma.searchDocument.findMany({
      where: {
        characterId: { not: characterId },
      },
      select: {
        characterId: true,
        category: true,
        tags: true,
        embedding: true,
        popularityScore: true,
      },
    });

    const targetTags = new Set(((targetDoc.tags as string[]) || []).map(t => t.toLowerCase()));
    const targetEmbedding = (targetDoc.embedding as number[]) || [];

    const similarityList: Array<{
      similarCharacterId: string;
      similarityScore: number;
      matchReason: string;
    }> = [];

    for (const doc of allDocs) {
      // 1. Category similarity (0 or 0.3)
      const catScore = doc.category.toLowerCase() === targetDoc.category.toLowerCase() ? 0.3 : 0.0;

      // 2. Tag overlap (0.0 to 0.3)
      const docTags = ((doc.tags as string[]) || []).map(t => t.toLowerCase());
      const overlap = docTags.filter(t => targetTags.has(t)).length;
      const tagScore = targetTags.size > 0 ? (overlap / Math.max(targetTags.size, 1)) * 0.3 : 0.0;

      // 3. Embedding cosine similarity (0.0 to 0.4)
      const docEmbedding = (doc.embedding as number[]) || [];
      const cosineSim = SearchIndexService.computeCosineSimilarity(targetEmbedding, docEmbedding);
      const embeddingScore = cosineSim * 0.4;

      const totalSim = Number((catScore + tagScore + embeddingScore).toFixed(4));

      let matchReason = 'Similar companion';
      if (catScore > 0 && tagScore > 0.1) {
        matchReason = 'Shares genre and key traits';
      } else if (catScore > 0) {
        matchReason = `Also in ${targetDoc.category}`;
      } else if (cosineSim > 0.7) {
        matchReason = 'Similar personality & communication style';
      }

      if (totalSim > 0.15) {
        similarityList.push({
          similarCharacterId: doc.characterId,
          similarityScore: totalSim,
          matchReason,
        });
      }
    }

    similarityList.sort((a, b) => b.similarityScore - a.similarityScore);
    const topMatches = similarityList.slice(0, topK);

    // Persist top similarities
    for (const match of topMatches) {
      try {
        await prisma.characterSimilarity.upsert({
          where: {
            characterId_similarCharacterId: {
              characterId,
              similarCharacterId: match.similarCharacterId,
            },
          },
          create: {
            characterId,
            similarCharacterId: match.similarCharacterId,
            similarityScore: match.similarityScore,
            matchReason: match.matchReason,
          },
          update: {
            similarityScore: match.similarityScore,
            matchReason: match.matchReason,
            updatedAt: new Date(),
          },
        });
      } catch (err) {
        logger.debug('Similarity insert skipped', { err });
      }
    }
  }

  /**
   * Retrieves top similar characters for a given character with safety & eligibility filtering.
   */
  public static async getSimilarCharacters(
    characterId: string,
    userId?: string,
    limit = 6,
  ): Promise<CharacterCatalogItem[]> {
    const similarities = await prisma.characterSimilarity.findMany({
      where: { characterId },
      orderBy: { similarityScore: 'desc' },
      take: limit * 2,
    });

    const candidateIds = similarities.map(s => s.similarCharacterId);
    if (candidateIds.length === 0) {
      // Fallback: get same category characters
      const targetChar = await prisma.character.findUnique({
        where: { id: characterId },
        select: { category: true },
      });
      if (targetChar) {
        const sameCategory = await prisma.character.findMany({
          where: {
            category: targetChar.category,
            id: { not: characterId },
            status: 'PUBLISHED',
            deletedAt: null,
          },
          take: limit,
          include: {
            categoryRef: true,
            discoveryConfig: true,
            currentPublishedVersion: true,
            tagLinks: { include: { tag: true } },
          },
        });
        return sameCategory.map(c => CatalogService.mapToCatalogItem(c));
      }
      return [];
    }

    const eligibleIds = await CharacterEligibilityService.filterEligible(candidateIds, { userId });
    const targetIds = eligibleIds.slice(0, limit);

    const characters = await prisma.character.findMany({
      where: { id: { in: targetIds } },
      include: {
        categoryRef: true,
        discoveryConfig: true,
        currentPublishedVersion: true,
        tagLinks: { include: { tag: true } },
      },
    });

    const reasonMap = new Map(similarities.map(s => [s.similarCharacterId, s.matchReason]));

    return characters.map(char => {
      const item = CatalogService.mapToCatalogItem(char);
      item.recommendationReason = reasonMap.get(char.id) || 'Similar companion';
      item.recommendationReasonCode = 'SIMILAR_CHARACTER';
      return item;
    });
  }
}
