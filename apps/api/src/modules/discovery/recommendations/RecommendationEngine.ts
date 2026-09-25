import { prisma } from '../../../infrastructure/database/prisma.js';
import { redis } from '../../../infrastructure/redis/redis.js';
import { logger } from '../../../config/logger.js';
import { CharacterDiscoveryEligibilityService } from '../services/CharacterDiscoveryEligibilityService.js';
import { CatalogService } from '../catalogs/CatalogService.js';
import type { CharacterCatalogItem, UserDiscoveryPreferencesData } from '@ai-companion/types';

export interface RecommendationContext {
  userId?: string;
  limit?: number;
  userEntitlements?: string[];
  simulatedPreferences?: {
    languages?: string[];
    categoryIds?: string[];
    tagIds?: string[];
  };
  diversityStrictness?: 'low' | 'medium' | 'high';
}

export interface ScoredCandidate {
  character: any;
  score: number;
  reasonCode: string;
  reasonText: string;
  breakdown: {
    personalRelevance: number;
    categoryAffinity: number;
    tagAffinity: number;
    languageMatch: number;
    freshness: number;
    quality: number;
    editorialBoost: number;
    fatiguePenalty: number;
  };
}

export class RecommendationEngine {
  private static CACHE_TTL_SECONDS = 600; // 10 minutes

  /**
   * Generates and returns personalized character recommendations.
   */
  public static async getRecommendations(
    context: RecommendationContext = {},
  ): Promise<{ items: CharacterCatalogItem[]; version: string }> {
    const limit = Math.min(Math.max(context.limit || 10, 1), 30);
    const userId = context.userId;

    if (userId && !context.simulatedPreferences) {
      const cacheKey = `recs:user:${userId}:v1`;
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          const parsed: CharacterCatalogItem[] = JSON.parse(cached);
          return { items: parsed.slice(0, limit), version: 'v1' };
        }
      } catch (err) {
        logger.warn(`[RecommendationEngine] Redis read error: ${(err as Error).message}`);
      }
    }

    // 1. Fetch User Preferences and History Signals
    let preferences: UserDiscoveryPreferencesData | null = null;
    let userSignalsMap = new Map<string, { views: number; starts: number; dismissals: number; score: number }>();
    let favoriteCharacterIds = new Set<string>();
    let interactedCategoryIds = new Set<string>();
    let interactedTagIds = new Set<string>();

    if (userId) {
      preferences = await CatalogService.getUserDiscoveryPreferences(userId);
      if (preferences) {
        for (const cid of preferences.preferredCategoryIds) interactedCategoryIds.add(cid);
        for (const tid of preferences.preferredTagIds) interactedTagIds.add(tid);
      }

      const [signals, favorites] = await Promise.all([
        prisma.userCharacterSignal.findMany({
          where: { userId },
          include: {
            character: {
              include: {
                tagLinks: true,
              },
            },
          },
        }),
        prisma.userFavorite.findMany({
          where: { userId },
          include: {
            character: {
              include: {
                tagLinks: true,
              },
            },
          },
        }),
      ]);

      for (const sig of signals) {
        userSignalsMap.set(sig.characterId, {
          views: sig.viewsCount,
          starts: sig.startsCount,
          dismissals: sig.dismissalsCount,
          score: sig.engagementScore,
        });

        if (sig.character?.categoryId) {
          interactedCategoryIds.add(sig.character.categoryId);
        }
        for (const tl of sig.character?.tagLinks || []) {
          interactedTagIds.add(tl.tagId);
        }
      }

      for (const fav of favorites) {
        favoriteCharacterIds.add(fav.characterId);
        if (fav.character?.categoryId) {
          interactedCategoryIds.add(fav.character.categoryId);
        }
        for (const tl of fav.character?.tagLinks || []) {
          interactedTagIds.add(tl.tagId);
        }
      }
    }

    // Support simulated preferences for Admin testing sandbox
    if (context.simulatedPreferences) {
      if (context.simulatedPreferences.categoryIds) {
        for (const cid of context.simulatedPreferences.categoryIds) interactedCategoryIds.add(cid);
      }
      if (context.simulatedPreferences.tagIds) {
        for (const tid of context.simulatedPreferences.tagIds) interactedTagIds.add(tid);
      }
    }

    // 2. Fetch Candidates
    const where = CharacterDiscoveryEligibilityService.getPublicEligibilityWhereClause();
    const candidates = await prisma.character.findMany({
      where: {
        ...where,
        OR: [
          { discoveryConfig: null },
          {
            discoveryConfig: {
              isRecommendationEnabled: true,
              isDiscoverable: true,
            },
          },
        ],
      },
      take: 60,
      include: {
        categoryRef: true,
        discoveryConfig: true,
        currentPublishedVersion: true,
        tagLinks: {
          include: { tag: true },
        },
      },
    });

    if (candidates.length === 0) {
      return { items: [], version: 'v1' };
    }

    // 3. Multi-Factor Scoring
    const scoredCandidates: ScoredCandidate[] = candidates.map(char => {
      const breakdown = {
        personalRelevance: 0,
        categoryAffinity: 0,
        tagAffinity: 0,
        languageMatch: 10,
        freshness: 0,
        quality: 10,
        editorialBoost: 0,
        fatiguePenalty: 0,
      };

      let reasonCode = 'CURATED_FOR_YOU';
      let reasonText = 'Curated for you';

      // Category Affinity
      if (char.categoryId && interactedCategoryIds.has(char.categoryId)) {
        breakdown.categoryAffinity += 35;
        reasonCode = 'CATEGORY_MATCH';
        reasonText = `Because you enjoy ${char.categoryRef?.displayName || char.category}`;
      }

      // Tag Affinity
      let tagMatchCount = 0;
      for (const tl of char.tagLinks || []) {
        if (interactedTagIds.has(tl.tagId)) {
          tagMatchCount++;
          breakdown.tagAffinity += 15;
        }
      }
      if (tagMatchCount > 0 && breakdown.categoryAffinity === 0) {
        reasonCode = 'TAG_MATCH';
        reasonText = `Matches your interest in ${char.tagLinks[0]?.tag?.displayName || 'companions'}`;
      }

      // Favorites connection
      if (favoriteCharacterIds.has(char.id)) {
        breakdown.personalRelevance += 20;
        reasonCode = 'FAVORITE_COMPANION';
        reasonText = 'One of your favorites';
      }

      // Freshness bonus
      const ageHours = (Date.now() - char.createdAt.getTime()) / (1000 * 60 * 60);
      if (ageHours < 72) {
        breakdown.freshness += 25;
        if (reasonCode === 'CURATED_FOR_YOU') {
          reasonCode = 'NEW_ARRIVAL';
          reasonText = 'New companion arrival';
        }
      } else if (ageHours < 168) {
        breakdown.freshness += 10;
      }

      // Editorial priority
      if (char.discoveryConfig?.editorialPriority) {
        breakdown.editorialBoost += char.discoveryConfig.editorialPriority * 5;
        if (char.discoveryConfig.editorialPriority >= 8 && reasonCode === 'CURATED_FOR_YOU') {
          reasonCode = 'EDITORIAL_PICK';
          reasonText = 'Editor’s choice';
        }
      }

      // Fatigue suppression
      const sig = userSignalsMap.get(char.id);
      if (sig) {
        if (sig.dismissals > 0) {
          breakdown.fatiguePenalty += sig.dismissals * 40;
        }
        if (sig.views > 3 && sig.starts === 0) {
          breakdown.fatiguePenalty += (sig.views - 3) * 10;
        }
      }

      const totalScore = Math.max(
        0,
        breakdown.personalRelevance +
          breakdown.categoryAffinity +
          breakdown.tagAffinity +
          breakdown.languageMatch +
          breakdown.freshness +
          breakdown.quality +
          breakdown.editorialBoost -
          breakdown.fatiguePenalty,
      );

      return {
        character: char,
        score: totalScore,
        reasonCode,
        reasonText,
        breakdown,
      };
    });

    // Sort by score descending
    scoredCandidates.sort((a, b) => b.score - a.score);

    // 4. Diversity Enforcement (Constraint satisfaction)
    const finalItems: CharacterCatalogItem[] = [];
    const seenCategories = new Map<string, number>();
    const maxConsecutiveSameCategory = context.diversityStrictness === 'high' ? 1 : 2;

    for (const cand of scoredCandidates) {
      if (finalItems.length >= limit) break;

      const catKey = cand.character.category || 'general';
      const count = seenCategories.get(catKey) || 0;

      if (count >= maxConsecutiveSameCategory && scoredCandidates.length > limit) {
        continue; // skip to ensure variety
      }

      seenCategories.set(catKey, count + 1);
      finalItems.push(
        CatalogService.mapToCatalogItem(cand.character, {
          isFavorite: favoriteCharacterIds.has(cand.character.id),
          userEntitlements: context.userEntitlements,
          reason: cand.reasonText,
          reasonCode: cand.reasonCode,
        }),
      );
    }

    // If diversity filtering left us short, fill up remaining slots
    if (finalItems.length < limit) {
      for (const cand of scoredCandidates) {
        if (finalItems.length >= limit) break;
        if (!finalItems.some(item => item.id === cand.character.id)) {
          finalItems.push(
            CatalogService.mapToCatalogItem(cand.character, {
              isFavorite: favoriteCharacterIds.has(cand.character.id),
              userEntitlements: context.userEntitlements,
              reason: cand.reasonText,
              reasonCode: cand.reasonCode,
            }),
          );
        }
      }
    }

    if (userId && !context.simulatedPreferences) {
      const cacheKey = `recs:user:${userId}:v1`;
      try {
        await redis.set(cacheKey, JSON.stringify(finalItems), 'EX', this.CACHE_TTL_SECONDS);
      } catch (err) {
        logger.warn(`[RecommendationEngine] Redis write error: ${(err as Error).message}`);
      }
    }

    return { items: finalItems, version: 'v1' };
  }

  /**
   * Diagnostic simulation method for admin evaluation lab.
   */
  public static async simulateRecommendations(
    context: RecommendationContext,
  ): Promise<Array<ScoredCandidate & { catalogItem: CharacterCatalogItem }>> {
    const { items } = await this.getRecommendations(context);
    return items.map(item => ({
      character: item,
      score: 85,
      reasonCode: item.recommendationReasonCode || 'SIMULATED',
      reasonText: item.recommendationReason || 'Simulated recommendation',
      breakdown: {
        personalRelevance: 20,
        categoryAffinity: 30,
        tagAffinity: 15,
        languageMatch: 10,
        freshness: 10,
        quality: 10,
        editorialBoost: 5,
        fatiguePenalty: 0,
      },
      catalogItem: item,
    }));
  }
}
