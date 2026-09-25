import { prisma } from '../../../infrastructure/database/prisma.js';
import { redis } from '../../../infrastructure/redis/redis.js';
import { logger } from '../../../config/logger.js';
import { CharacterDiscoveryEligibilityService } from '../services/CharacterDiscoveryEligibilityService.js';
import { CatalogService } from '../catalogs/CatalogService.js';
import type { CharacterCatalogItem } from '@ai-companion/types';

export class TrendingEngine {
  private static CACHE_KEY = 'discovery:trending:characters:v1';
  private static CACHE_TTL_SECONDS = 900; // 15 minutes

  /**
   * Computes or returns cached trending characters based on time-windowed activity.
   */
  public static async getTrendingCharacters(
    limit: number = 10,
    userId?: string,
    userEntitlements: string[] = [],
  ): Promise<CharacterCatalogItem[]> {
    try {
      const cached = await redis.get(this.CACHE_KEY);
      if (cached) {
        const parsed: CharacterCatalogItem[] = JSON.parse(cached);
        return parsed.slice(0, limit);
      }
    } catch (err) {
      logger.warn(`[TrendingEngine] Redis read failure: ${(err as Error).message}`);
    }

    const where = CharacterDiscoveryEligibilityService.getPublicEligibilityWhereClause();

    // Fetch published characters eligible for trending
    const characters = await prisma.character.findMany({
      where: {
        ...where,
        OR: [
          { discoveryConfig: null },
          {
            discoveryConfig: {
              isTrendingEnabled: true,
              isDiscoverable: true,
            },
          },
        ],
      },
      take: 50,
      include: {
        categoryRef: true,
        discoveryConfig: true,
        currentPublishedVersion: true,
        tagLinks: {
          include: { tag: true },
        },
        _count: {
          select: {
            conversations: true,
            favoritedBy: true,
          },
        },
      },
    });

    // Score characters based on recent activity, favorites, and editorial boost
    const now = Date.now();
    const scoredCharacters = characters.map(char => {
      const ageHours = Math.max(1, (now - char.createdAt.getTime()) / (1000 * 60 * 60));
      const freshnessDecay = 1 / (1 + ageHours / 168); // Decay over 1 week

      const convCount = char._count.conversations || 0;
      const favCount = char._count.favoritedBy || 0;
      const editorialBoost = char.discoveryConfig?.editorialBoost || 1.0;
      const editorialPriority = char.discoveryConfig?.editorialPriority || 0;

      // Weighted score
      const score =
        (convCount * 3.0 + favCount * 2.5 + editorialPriority * 10) *
        freshnessDecay *
        editorialBoost;

      return {
        character: char,
        score,
      };
    });

    scoredCharacters.sort((a, b) => b.score - a.score);

    const topTrending = scoredCharacters.slice(0, limit).map(({ character }) =>
      CatalogService.mapToCatalogItem(character, {
        userEntitlements,
        reason: 'Trending this week',
        reasonCode: 'TRENDING_THIS_WEEK',
      }),
    );

    try {
      await redis.set(this.CACHE_KEY, JSON.stringify(topTrending), 'EX', this.CACHE_TTL_SECONDS);
    } catch (err) {
      logger.warn(`[TrendingEngine] Redis write failure: ${(err as Error).message}`);
    }

    let userFavorites = new Set<string>();
    if (userId && topTrending.length > 0) {
      const favs = await prisma.userFavorite.findMany({
        where: { userId, characterId: { in: topTrending.map(t => t.id) } },
        select: { characterId: true },
      });
      userFavorites = new Set(favs.map(f => f.characterId));
      return topTrending.map(t => ({
        ...t,
        isFavorite: userFavorites.has(t.id),
      }));
    }

    return topTrending;
  }
}
