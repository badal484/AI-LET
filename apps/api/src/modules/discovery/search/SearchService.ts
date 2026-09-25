import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../config/logger.js';
import { CatalogService } from '../catalogs/CatalogService.js';
import { SearchIndexService } from './SearchIndexService.js';
import { SearchQueryAnalyzer } from './SearchQueryAnalyzer.js';
import { CharacterEligibilityService } from '../services/CharacterEligibilityService.js';
import type {
  SearchCharacterQueryParams,
  SearchCharacterResult,
  CharacterCatalogItem,
  SearchSuggestionItem,
  UserSearchHistoryItem,
} from '@ai-companion/types';

export class SearchService {
  /**
   * Performs hybrid lexical + semantic search with typo tolerance, multilingual understanding,
   * eligibility enforcement, and cursor pagination.
   */
  public static async searchCharacters(
    params: SearchCharacterQueryParams,
    userId?: string,
    userEntitlements: string[] = [],
  ): Promise<SearchCharacterResult> {
    const rawQuery = (params.q || '').trim();
    const limit = Math.min(Math.max(params.limit || 20, 1), 50);

    // 1. Query Analysis
    const analysis = await SearchQueryAnalyzer.analyze(rawQuery);
    const normalizedQuery = analysis.normalizedQuery;
    const tokens = analysis.tokens;
    const queryEmbedding = normalizedQuery.length > 0 ? SearchIndexService.generateEmbeddingVector(normalizedQuery) : null;

    // 2. Decode cursor
    let offset = 0;
    if (params.cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(params.cursor, 'base64').toString('utf8'));
        if (typeof decoded.offset === 'number') {
          offset = decoded.offset;
        }
      } catch {
        offset = 0;
      }
    }

    // 3. Search document candidate query from PostgreSQL
    let docQuery: any = {};
    if (params.category) {
      docQuery.category = { equals: params.category, mode: 'insensitive' };
    }
    if (params.language) {
      docQuery.language = params.language;
    }

    // Candidate fetch limit
    const fetchLimit = 200;
    let allDocs = await prisma.searchDocument.findMany({
      where: docQuery,
      take: fetchLimit,
      select: {
        characterId: true,
        name: true,
        slug: true,
        category: true,
        tags: true,
        searchText: true,
        embedding: true,
        popularityScore: true,
        qualityScore: true,
        trendingScore: true,
        publishedAt: true,
      },
    });

    // Graceful fallback to character table if searchDocument index is unpopulated
    if (allDocs.length === 0) {
      const fallbackChars = await prisma.character.findMany({
        where: {
          status: 'PUBLISHED',
          deletedAt: null,
          ...(params.category ? { category: { equals: params.category, mode: 'insensitive' } } : {}),
        },
        take: fetchLimit,
        include: {
          categoryRef: true,
          discoveryConfig: true,
          currentPublishedVersion: true,
          tagLinks: { include: { tag: true } },
        },
      });

      allDocs = fallbackChars.map(c => ({
        characterId: c.id,
        name: c.name,
        slug: c.slug,
        category: c.category,
        tags: c.tagLinks ? c.tagLinks.map((tl: any) => tl.tag?.name || '') : [],
        searchText: `${c.name} ${c.tagline || ''} ${c.shortDescription || ''} ${c.category}`.toLowerCase(),
        embedding: null,
        popularityScore: 50,
        qualityScore: 50,
        trendingScore: 50,
        publishedAt: c.updatedAt,
      })) as any[];
    }


    // 4. Hybrid Scoring for each document
    const scoredDocs: Array<{ characterId: string; totalScore: number }> = [];

    for (const doc of allDocs) {
      let score = 0;

      if (normalizedQuery.length === 0) {
        // Browse mode: score based on sort order
        if (params.sort === 'popular') {
          score = doc.popularityScore;
        } else if (params.sort === 'trending') {
          score = doc.trendingScore;
        } else if (params.sort === 'new') {
          score = doc.publishedAt ? new Date(doc.publishedAt).getTime() / 1000000000 : 0;
        } else {
          score = doc.popularityScore * 0.6 + doc.trendingScore * 0.4;
        }
      } else {
        // Search mode: hybrid matching
        const docNameLower = doc.name.toLowerCase();
        const docTextLower = doc.searchText.toLowerCase();
        const docTags = ((doc.tags as string[]) || []).map(t => t.toLowerCase());

        // A. Exact Name Match Bonus
        if (docNameLower === normalizedQuery) {
          score += 100;
        } else if (docNameLower.includes(normalizedQuery)) {
          score += 60;
        }

        // B. Token Match / Lexical match
        let tokenMatches = 0;
        for (const token of tokens) {
          if (docNameLower.includes(token)) {
            tokenMatches += 25;
          } else if (docTags.includes(token)) {
            tokenMatches += 15;
          } else if (docTextLower.includes(token)) {
            tokenMatches += 15;
          }
        }
        score += tokenMatches;

        // C. Category Match Bonus
        if (analysis.extractedCategories.includes(doc.category.toLowerCase())) {
          score += 20;
        }

        // D. Tag Overlap Bonus
        const tagOverlap = docTags.filter(t => analysis.extractedTags.includes(t)).length;
        score += tagOverlap * 10;

        // E. Semantic Cosine Similarity (apply semantic threshold floor)
        if (queryEmbedding && doc.embedding) {
          const cosine = SearchIndexService.computeCosineSimilarity(queryEmbedding, doc.embedding as number[]);
          if (cosine >= 0.55) {
            score += (cosine - 0.5) * 50;
          }
        }

        // F. Popularity / Quality tie-breaker (only if there is lexical or semantic relevance)
        if (score >= 5) {
          score += (doc.popularityScore * 0.1 + doc.qualityScore * 0.05);
        }
      }

      if (normalizedQuery.length === 0 || score >= 5) {
        scoredDocs.push({ characterId: doc.characterId, totalScore: Number(score.toFixed(3)) });
      }
    }



    // Sort by total score descending
    scoredDocs.sort((a, b) => b.totalScore - a.totalScore);

    const candidateIds = scoredDocs.map(s => s.characterId);

    // 5. Enforce safety, moderation, user block & negative signal eligibility
    const eligibleIds = await CharacterEligibilityService.filterEligible(candidateIds, { userId });

    const totalEstimated = eligibleIds.length;
    const pagedIds = eligibleIds.slice(offset, offset + limit);
    const hasMore = offset + limit < eligibleIds.length;

    const characters = await prisma.character.findMany({
      where: { id: { in: pagedIds } },
      include: {
        categoryRef: true,
        discoveryConfig: true,
        currentPublishedVersion: true,
        tagLinks: { include: { tag: true } },
      },
    });

    const charMap = new Map(characters.map(c => [c.id, c]));
    const orderedChars = pagedIds.map(id => charMap.get(id)).filter(Boolean) as any[];

    // Fetch user favorites
    let userFavorites = new Set<string>();
    if (userId && orderedChars.length > 0) {
      try {
        const favs = await prisma.userFavorite.findMany({
          where: { userId, characterId: { in: orderedChars.map(c => c.id) } },
          select: { characterId: true },
        });
        userFavorites = new Set(favs.map(f => f.characterId));
      } catch {
        // Safe fallback if UUID format or DB lookup errors
        userFavorites = new Set<string>();
      }
    }


    const items: CharacterCatalogItem[] = orderedChars.map(char =>
      CatalogService.mapToCatalogItem(char, {
        isFavorite: userFavorites.has(char.id),
        userEntitlements,
      }),
    );

    // Next cursor construction
    const nextCursor = hasMore
      ? Buffer.from(JSON.stringify({ offset: offset + limit, count: totalEstimated })).toString('base64')
      : null;

    // 6. Zero-Result Recovery & Suggestions
    let suggestedCategories: any[] | undefined;
    let suggestedQueries: string[] | undefined;

    if (totalEstimated === 0 && rawQuery.length > 0) {
      if (analysis.spellCorrection && analysis.spellCorrection !== rawQuery) {
        suggestedQueries = [analysis.spellCorrection];
      }

      // Recommend top categories as fallback
      const categories = await prisma.characterCategory.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: 'asc' },
        take: 4,
      });
      suggestedCategories = categories.map(c => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        displayName: c.displayName,
        description: c.description,
        displayOrder: c.displayOrder,
        isActive: c.isActive,
        isFeatured: c.isFeatured,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      }));
    }

    // 7. Log Search Query & Update User Search History asynchronously
    if (normalizedQuery.length > 0) {
      this.recordSearchHistoryAndAnalytics(userId, rawQuery, normalizedQuery, totalEstimated, params.category).catch(err => {
        logger.debug('Error recording search history', { err });
      });
    }

    return {
      items,
      nextCursor,
      hasMore,
      totalEstimated,
      suggestedCategories,
      suggestedQueries,
    };
  }

  /**
   * Retrieves instant autocomplete suggestions for search input.
   */
  public static async getSuggestions(query: string, userId?: string, limit = 8): Promise<SearchSuggestionItem[]> {
    const raw = (query || '').trim();
    if (!raw) return [];

    const normalized = raw.toLowerCase();
    const suggestions: SearchSuggestionItem[] = [];

    // 1. User recent searches matching query
    if (userId) {
      const recent = await prisma.userSearchHistory.findMany({
        where: {
          userId,
          normalizedQuery: { contains: normalized },
        },
        orderBy: { lastSearchedAt: 'desc' },
        take: 3,
      });
      recent.forEach(r => {
        suggestions.push({
          type: 'RECENT',
          id: r.id,
          text: r.query,
          subtext: 'Recent search',
        });
      });
    }

    // 2. Character names matching query
    const chars = await prisma.character.findMany({
      where: {
        status: 'PUBLISHED',
        deletedAt: null,
        name: { contains: raw, mode: 'insensitive' },
      },
      select: { id: true, name: true, category: true, avatarUrl: true },
      take: 4,
    });
    chars.forEach(c => {
      suggestions.push({
        type: 'CHARACTER',
        id: c.id,
        text: c.name,
        subtext: c.category,
        category: c.category,
        avatarUrl: c.avatarUrl,
      });
    });

    // 3. Category matching
    const categories = await prisma.characterCategory.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: raw, mode: 'insensitive' } },
          { displayName: { contains: raw, mode: 'insensitive' } },
        ],
      },
      take: 2,
    });
    categories.forEach(cat => {
      suggestions.push({
        type: 'CATEGORY',
        id: cat.slug,
        text: cat.displayName,
        subtext: 'Category',
      });
    });

    // 4. Tag matching
    const tags = await prisma.characterTag.findMany({
      where: {
        isCurated: true,
        name: { contains: raw, mode: 'insensitive' },
      },
      take: 2,
    });
    tags.forEach(t => {
      suggestions.push({
        type: 'TAG',
        id: t.slug,
        text: `#${t.name}`,
        subtext: 'Tag',
      });
    });

    return suggestions.slice(0, limit);
  }

  /**
   * Retrieves recent search history for a user.
   */
  public static async getRecentSearches(userId: string, limit = 10): Promise<UserSearchHistoryItem[]> {
    const list = await prisma.userSearchHistory.findMany({
      where: { userId },
      orderBy: { lastSearchedAt: 'desc' },
      take: limit,
    });

    return list.map(item => ({
      id: item.id,
      userId: item.userId,
      query: item.query,
      normalizedQuery: item.normalizedQuery,
      categoryFilter: item.categoryFilter,
      lastSearchedAt: item.lastSearchedAt.toISOString(),
      createdAt: item.createdAt.toISOString(),
    }));
  }

  /**
   * Deletes a single recent search history item.
   */
  public static async deleteRecentSearch(userId: string, historyId: string): Promise<void> {
    await prisma.userSearchHistory.deleteMany({
      where: { id: historyId, userId },
    });
  }

  /**
   * Clears all recent searches for a user.
   */
  public static async clearRecentSearches(userId: string): Promise<void> {
    await prisma.userSearchHistory.deleteMany({
      where: { userId },
    });
  }

  /**
   * Records user search history and query logs asynchronously.
   */
  private static async recordSearchHistoryAndAnalytics(
    userId: string | undefined,
    rawQuery: string,
    normalizedQuery: string,
    resultCount: number,
    categoryFilter?: string,
  ): Promise<void> {
    await prisma.searchQueryLog.create({
      data: {
        query: rawQuery,
        normalizedQuery,
        userId: userId || null,
        resultCount,
      },
    });

    if (userId) {
      await prisma.userSearchHistory.upsert({
        where: {
          userId_normalizedQuery: {
            userId,
            normalizedQuery,
          },
        },
        create: {
          userId,
          query: rawQuery,
          normalizedQuery,
          categoryFilter: categoryFilter || null,
          lastSearchedAt: new Date(),
        },
        update: {
          lastSearchedAt: new Date(),
          categoryFilter: categoryFilter || null,
        },
      });
    }
  }
}
