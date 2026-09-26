import { prisma } from '../../../infrastructure/database/prisma.js';
import { redis } from '../../../infrastructure/redis/redis.js';
import { logger } from '../../../config/logger.js';
import { CatalogService } from '../catalogs/CatalogService.js';
import { CandidateGenerationService } from '../recommendations/CandidateGenerationService.js';
import { CharacterEligibilityService } from './CharacterEligibilityService.js';
import { CharacterRankingService } from '../ranking/CharacterRankingService.js';
import { DiversificationService } from '../ranking/DiversificationService.js';
import type {
  HomeFeedResponse,
  HomeFeedSection,
  ContinueConversationItem,
  CharacterCatalogItem,
} from '@ai-companion/types';

export class HomeFeedService {
  private static CACHE_TTL_SECONDS = 120; // 2 minutes

  /**
   * Assembles the complete personalized Home feed using the multi-stage discovery pipeline:
   * Candidates -> Eligibility -> Ranking -> Diversification -> Section Allocation -> Delivery.
   */
  public static async getHomeFeed(
    userId?: string,
    options: {
      refresh?: boolean;
      limit?: number;
      userEntitlements?: string[];
      rankingVersion?: string;
      userLocale?: string;
    } = {},
  ): Promise<HomeFeedResponse> {
    const limit = options.limit || 10;
    const cacheKey = userId ? `home:user:${userId}:v26` : 'home:guest:v26';

    if (!options.refresh) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (err) {
        logger.debug('Redis home cache read missed/failed', { err });
      }
    }

    try {
      // 1. Resolve User Context & Active Conversations
      let userDisplayName: string | undefined;
      let isReturningUser = false;
      let continueItems: ContinueConversationItem[] = [];
      let recentCharacterIds: string[] = [];
      let preferredCategories: string[] = [];

      if (userId) {
        const [profile, activeConversations, prefs] = await Promise.all([
          prisma.userProfile.findUnique({
            where: { userId },
            select: { displayName: true },
          }),
          prisma.conversation.findMany({
            where: {
              userId,
              status: 'ACTIVE',
              character: { status: 'PUBLISHED', deletedAt: null },
            },
            take: 6,
            orderBy: { updatedAt: 'desc' },
            include: {
              character: true,
              messages: { take: 1, orderBy: { createdAt: 'desc' } },
            },
          }),
          prisma.userDiscoveryPreference.findUnique({
            where: { userId },
            select: { preferredCategoryIds: true },
          }),
        ]);

        userDisplayName = profile?.displayName;
        isReturningUser = activeConversations.length > 0;
        recentCharacterIds = activeConversations.map(c => c.characterId);
        if (prefs && Array.isArray(prefs.preferredCategoryIds)) {
          preferredCategories = prefs.preferredCategoryIds as string[];
        }

        continueItems = activeConversations.map(conv => {
          const lastMsg = conv.messages[0];
          return {
            conversationId: conv.id,
            characterId: conv.characterId,
            characterSlug: conv.character.slug,
            characterName: conv.character.name,
            characterAvatarUrl: conv.character.avatarUrl,
            category: conv.character.category,
            lastMessageSnippet: conv.lastMessageSnippet || lastMsg?.content || 'Start chatting...',
            lastInteractedAt: conv.updatedAt.toISOString(),
            unreadCount: conv.unreadCount || 0,
            hasProactiveMessage: false,
          };
        });
      }

      const greeting = this.generateGreeting(userDisplayName, isReturningUser);

      // 2. Candidate Generation (Parallel)
      const rawCandidates = await CandidateGenerationService.generateCandidates({
        userId,
        preferredCategories,
        recentCharacterIds,
      });

      // 3. Batch Eligibility Filter
      const candidateIds = rawCandidates.map(c => c.characterId);
      const eligibleIds = await CharacterEligibilityService.filterEligible(candidateIds, { userId });
      const eligibleSet = new Set(eligibleIds);
      const eligibleCandidates = rawCandidates.filter(c => eligibleSet.has(c.characterId));

      // 4. Ranking
      const { ranked, rankingVersion, diversityRules } = await CharacterRankingService.rankCandidates(
        eligibleCandidates,
        {
          userId,
          preferredCategories,
          rankingVersion: options.rankingVersion,
        },
      );

      // 5. Cross-Section Allocation & Diversification
      const dedupeAcrossSections = ranked.length >= 20;
      const globalShownIds = new Set<string>();

      // A. "For You" / Recommended Section
      const forYouRanked = DiversificationService.diversify(ranked, {
        rules: diversityRules,
        alreadyShownIds: new Set<string>(),
        limit,
      });
      if (dedupeAcrossSections) forYouRanked.forEach(i => globalShownIds.add(i.characterId));

      // B. "Trending" Section
      const trendingPool = ranked.filter(
        r => r.candidateSources.includes('TRENDING') || (r.featureScores?.['trendingVelocity'] ?? 0) > 0.2 || !dedupeAcrossSections,
      );
      const trendingRanked = DiversificationService.diversify(trendingPool, {
        rules: diversityRules,
        alreadyShownIds: dedupeAcrossSections ? globalShownIds : new Set<string>(),
        limit,
      });
      if (dedupeAcrossSections) trendingRanked.forEach(i => globalShownIds.add(i.characterId));

      // C. "New & Fresh" Section
      const newPool = ranked.filter(
        r => r.candidateSources.includes('NEW') || (r.featureScores?.['freshness'] ?? 0) > 0.3 || !dedupeAcrossSections,
      );
      const newRanked = DiversificationService.diversify(newPool, {
        rules: diversityRules,
        alreadyShownIds: dedupeAcrossSections ? globalShownIds : new Set<string>(),
        limit,
      });
      if (dedupeAcrossSections) newRanked.forEach(i => globalShownIds.add(i.characterId));

      // D. "Popular" Section
      const popularPool = ranked.filter(
        r => r.candidateSources.includes('POPULAR') || (r.featureScores?.['popularity'] ?? 0) > 0.3 || !dedupeAcrossSections,
      );
      const popularRanked = DiversificationService.diversify(popularPool, {
        rules: diversityRules,
        alreadyShownIds: dedupeAcrossSections ? globalShownIds : new Set<string>(),
        limit,
      });
      if (dedupeAcrossSections) popularRanked.forEach(i => globalShownIds.add(i.characterId));

      // 6. Hydrate All Published Characters with DB records
      const characters = await prisma.character.findMany({
        where: { status: 'PUBLISHED', deletedAt: null },
        orderBy: [{ isFeatured: 'desc' }, { updatedAt: 'desc' }],
        include: {
          categoryRef: true,
          discoveryConfig: true,
          currentPublishedVersion: true,
          tagLinks: { include: { tag: true } },
        },
      });

      // User favorites
      let userFavorites = new Set<string>();
      if (userId && characters.length > 0) {
        const favs = await prisma.userFavorite.findMany({
          where: { userId, characterId: { in: characters.map(c => c.id) } },
          select: { characterId: true },
        });
        userFavorites = new Set(favs.map(f => f.characterId));
      }

      const charMap = new Map(
        characters.map(c => [
          c.id,
          CatalogService.mapToCatalogItem(c, {
            isFavorite: userFavorites.has(c.id),
            userEntitlements: options.userEntitlements,
          }),
        ]),
      );

      const categories = await CatalogService.getCategories();

      // 7. Assemble Feed Sections
      const sections: HomeFeedSection[] = [];

      if (continueItems.length > 0) {
        sections.push({
          id: 'section_continue',
          sectionKey: 'CONTINUE',
          title: 'Continue Conversation',
          subtitle: 'Jump back into your recent chats',
          layoutStyle: 'CAROUSEL',
          items: continueItems,
        });
      }

      if (categories.length > 0) {
        sections.push({
          id: 'section_categories',
          sectionKey: 'CATEGORIES',
          title: 'Categories',
          subtitle: 'Browse companions by interest and specialty',
          layoutStyle: 'CHIPS',
          items: categories,
        });
      }

      const CANONICAL_SLUG_ORDER = [
        'dr-ananya',
        'joel',
        'anjali',
        'tanu',
        'sakshi',
        'sangeeta',
        'aman',
        'raj',
        'neha',
        'nancy',
        'renu',
        'kavya',
        'gita-gpt',
        'krishna',
        'indira',
        'keerthana',
      ];

      // Track which characters have been placed in category sections
      const assignedCharIds = new Set<string>();

      // Add Category-wise Sections for 2-column grid view
      for (const cat of categories) {
        const catSlug = (cat.slug || '').toLowerCase().trim();
        const catName = (cat.name || '').toLowerCase().trim();
        const catDisplay = (cat.displayName || '').toLowerCase().trim();

        const catChars = characters.filter((c) => {
          if (c.categoryId && c.categoryId === cat.id) return true;
          const charCat = (c.category || '').toLowerCase().trim();
          return (
            charCat === catSlug ||
            charCat === catName ||
            charCat === catDisplay ||
            charCat.includes(catSlug) ||
            catSlug.includes(charCat) ||
            catName.includes(charCat)
          );
        });

        if (catChars.length > 0) {
          catChars.forEach((c) => assignedCharIds.add(c.id));
          const catItems = catChars
            .map((c) => charMap.get(c.id))
            .filter(Boolean) as CharacterCatalogItem[];

          catItems.sort((a, b) => {
            const idxA = CANONICAL_SLUG_ORDER.indexOf(a.slug);
            const idxB = CANONICAL_SLUG_ORDER.indexOf(b.slug);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return 0;
          });

          sections.push({
            id: `section_cat_${cat.slug}`,
            sectionKey: `CATEGORY_${cat.slug.toUpperCase()}`,
            title: `${cat.iconUrl ? cat.iconUrl + ' ' : ''}${cat.displayName}`,
            subtitle: cat.description || '',
            layoutStyle: 'GRID',
            items: catItems,
          });
        }
      }

      // Catch-all: Any published characters that didn't match a predefined category
      const unassignedChars = characters.filter((c) => !assignedCharIds.has(c.id));
      if (unassignedChars.length > 0) {
        const unassignedItems = unassignedChars
          .map((c) => charMap.get(c.id))
          .filter(Boolean) as CharacterCatalogItem[];

        sections.push({
          id: 'section_cat_custom',
          sectionKey: 'CATEGORY_ALL',
          title: '✨ Featured Companions',
          subtitle: 'Discover new and popular AI companions',
          layoutStyle: 'GRID',
          items: unassignedItems,
        });
      }

      const response: HomeFeedResponse = {
        greeting,
        sections,
        recommendationVersion: rankingVersion,
      };

      // Cache result in Redis asynchronously
      try {
        await redis.set(cacheKey, JSON.stringify(response), 'EX', this.CACHE_TTL_SECONDS);
      } catch {
        // ignore
      }

      return response;
    } catch (err) {
      logger.error('Error generating Home feed, fallback to safe generic feed', { err });
      return this.getFallbackHomeFeed(userId, options.userEntitlements);
    }
  }

  /**
   * Safe generic fallback Home feed in case ranking or candidate generation fails.
   */
  private static async getFallbackHomeFeed(userId?: string, userEntitlements: string[] = []): Promise<HomeFeedResponse> {
    const chars = await prisma.character.findMany({
      where: { status: 'PUBLISHED', deletedAt: null },
      take: 40,
      orderBy: [{ isFeatured: 'desc' }, { updatedAt: 'desc' }],
      include: {
        categoryRef: true,
        discoveryConfig: true,
        currentPublishedVersion: true,
        tagLinks: { include: { tag: true } },
      },
    });

    const eligibleIds = await CharacterEligibilityService.filterEligible(chars.map(c => c.id), { userId });
    const eligibleSet = new Set(eligibleIds);
    const items = chars.filter(c => eligibleSet.has(c.id)).slice(0, 20).map(c => CatalogService.mapToCatalogItem(c, { userEntitlements }));
    const categories = await CatalogService.getCategories();

    return {
      greeting: {
        title: 'Welcome to AI Lovira',
        subtitle: 'Discover intelligent companion characters',
        isReturningUser: false,
      },
      sections: [
        {
          id: 'section_featured',
          sectionKey: 'FEATURED',
          title: 'Featured Companions',
          subtitle: 'Popular characters ready to chat',
          layoutStyle: 'HERO',
          items: items.slice(0, 8),
        },
        {
          id: 'section_categories',
          sectionKey: 'CATEGORIES',
          title: 'Categories',
          subtitle: 'Explore genres',
          layoutStyle: 'CHIPS',
          items: categories,
        },
      ],
      recommendationVersion: 'fallback_v1',
    };
  }

  private static generateGreeting(displayName?: string, isReturningUser = false): {
    title: string;
    subtitle: string;
    userDisplayName?: string;
    isReturningUser: boolean;
  } {
    const hour = new Date().getHours();
    let timeGreeting = 'Good day';
    if (hour >= 5 && hour < 12) timeGreeting = 'Good morning';
    else if (hour >= 12 && hour < 17) timeGreeting = 'Good afternoon';
    else if (hour >= 17 && hour < 22) timeGreeting = 'Good evening';
    else timeGreeting = 'Good night';

    const title = displayName ? `${timeGreeting}, ${displayName}` : timeGreeting;
    const subtitle = isReturningUser
      ? 'Your companions are ready to talk with you.'
      : 'Find the companion that matches your mood and goals.';

    return {
      title,
      subtitle,
      userDisplayName: displayName,
      isReturningUser,
    };
  }
}
