import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../config/logger.js';
import { SearchIndexService } from '../search/SearchIndexService.js';
import type {
  CandidateCharacterItem,
  RankingWeights,
  DiversityRules,
  RankingSimulationResult,
} from '@ai-companion/types';

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  semanticRelevance: 0.25,
  categoryMatch: 0.15,
  tagMatch: 0.10,
  popularity: 0.15,
  trendingVelocity: 0.15,
  quality: 0.10,
  userPreference: 0.10,
  languageMatch: 0.05,
  freshness: 0.05,
  novelty: 0.05,
  fatiguePenalty: 0.10,
  negativeSignalPenalty: 0.50,
  repetitionPenalty: 0.20,
};

export const DEFAULT_DIVERSITY_RULES: DiversityRules = {
  maxPerCreator: 2,
  maxPerCategory: 4,
  mmrLambda: 0.7,
  explorationRatio: 0.1,
};

export interface RankingUserContext {
  userId?: string;
  preferredCategories?: string[];
  preferredTags?: string[];
  preferredLanguages?: string[];
  recentShownIds?: string[];
  queryEmbedding?: number[];
  rankingVersion?: string;
}

export interface RankedCharacterItem {
  characterId: string;
  score: number;
  rankingVersion: string;
  featureScores: Record<string, number>;
  candidateSources: string[];
  document?: any;
}

export class CharacterRankingService {
  /**
   * Resolves the active ranking configuration from database or default.
   */
  public static async getActiveRankingConfig(requestedVersion?: string): Promise<{
    version: string;
    weights: RankingWeights;
    diversityRules: DiversityRules;
  }> {
    try {
      let config = null;
      if (requestedVersion) {
        config = await prisma.rankingConfig.findUnique({
          where: { version: requestedVersion },
        });
      }

      if (!config) {
        config = await prisma.rankingConfig.findFirst({
          where: { isDefault: true, status: 'PUBLISHED' },
        });
      }

      if (config) {
        return {
          version: config.version,
          weights: { ...DEFAULT_RANKING_WEIGHTS, ...((config.weights as any) || {}) },
          diversityRules: { ...DEFAULT_DIVERSITY_RULES, ...((config.diversityRules as any) || {}) },
        };
      }
    } catch (err) {
      logger.debug('Fallback to default ranking config', { err });
    }

    return {
      version: 'ranking_v1_default',
      weights: DEFAULT_RANKING_WEIGHTS,
      diversityRules: DEFAULT_DIVERSITY_RULES,
    };
  }

  /**
   * Scores and ranks eligible candidates using the versioned ranking feature matrix.
   */
  public static async rankCandidates(
    candidates: CandidateCharacterItem[],
    context: RankingUserContext = {},
  ): Promise<{ ranked: RankedCharacterItem[]; rankingVersion: string; diversityRules: DiversityRules }> {
    if (!candidates || candidates.length === 0) {
      return { ranked: [], rankingVersion: 'ranking_v1_default', diversityRules: DEFAULT_DIVERSITY_RULES };
    }

    const { version: rankingVersion, weights, diversityRules } = await this.getActiveRankingConfig(
      context.rankingVersion,
    );

    const characterIds = candidates.map(c => c.characterId);

    // Fetch search documents in batch for feature calculation
    const documents = await prisma.searchDocument.findMany({
      where: { characterId: { in: characterIds } },
    });
    const docMap = new Map(documents.map(d => [d.characterId, d]));

    // Fetch user signals for fatigue & personalization
    let userSignalsMap = new Map<string, any>();
    if (context.userId) {
      const signals = await prisma.userCharacterSignal.findMany({
        where: { userId: context.userId, characterId: { in: characterIds } },
      });
      userSignalsMap = new Map(signals.map(s => [s.characterId, s]));
    }

    const preferredCatSet = new Set((context.preferredCategories || []).map(c => c.toLowerCase()));
    const preferredTagSet = new Set((context.preferredTags || []).map(t => t.toLowerCase()));
    const preferredLangSet = new Set((context.preferredLanguages || ['en']).map(l => l.toLowerCase()));
    const recentShownSet = new Set(context.recentShownIds || []);

    const now = Date.now();

    const ranked: RankedCharacterItem[] = [];

    for (const candidate of candidates) {
      const doc = docMap.get(candidate.characterId);
      if (!doc) continue;

      const featureScores: Record<string, number> = {};

      // 1. Semantic Relevance
      let semanticSim = 0.5;
      if (context.queryEmbedding && doc.embedding) {
        semanticSim = SearchIndexService.computeCosineSimilarity(
          context.queryEmbedding,
          doc.embedding as number[],
        );
      }
      featureScores['semanticRelevance'] = Number(semanticSim.toFixed(3));

      // 2. Category Match
      const categoryMatch = preferredCatSet.has(doc.category.toLowerCase()) ? 1.0 : 0.0;
      featureScores['categoryMatch'] = categoryMatch;

      // 3. Tag Match
      const docTags = (doc.tags as string[]) || [];
      const matchingTags = docTags.filter(t => preferredTagSet.has(t.toLowerCase())).length;
      const tagMatch = docTags.length > 0 ? Math.min(1.0, matchingTags / docTags.length) : 0.0;
      featureScores['tagMatch'] = Number(tagMatch.toFixed(3));

      // 4. Popularity
      featureScores['popularity'] = Number(Math.min(1.0, doc.popularityScore / 100).toFixed(3));

      // 5. Trending Velocity
      featureScores['trendingVelocity'] = Number(Math.min(1.0, doc.trendingScore / 100).toFixed(3));

      // 6. Quality
      featureScores['quality'] = Number(Math.min(1.0, doc.qualityScore / 100).toFixed(3));

      // 7. User Historical Preference
      const signal = userSignalsMap.get(candidate.characterId);
      const userPreference = signal ? Math.min(1.0, (signal.engagementScore || 50) / 100) : 0.5;
      featureScores['userPreference'] = Number(userPreference.toFixed(3));

      // 8. Language Match
      const langMatch = preferredLangSet.has((doc.language || 'en').toLowerCase()) ? 1.0 : 0.7;
      featureScores['languageMatch'] = langMatch;


      // 9. Freshness (Exponential decay over 30 days)
      const daysSincePublish = doc.publishedAt ? Math.max(0, (now - new Date(doc.publishedAt).getTime()) / (24 * 3600 * 1000)) : 30;
      const freshness = Number(Math.exp(-daysSincePublish / 30).toFixed(3));
      featureScores['freshness'] = freshness;

      // 10. Novelty
      const novelty = signal && signal.startsCount > 0 ? 0.0 : 1.0;
      featureScores['novelty'] = novelty;

      // 11. Penalties
      // Fatigue: high views without starts
      const fatigue = signal && signal.viewsCount > 5 && signal.startsCount === 0 ? 1.0 : 0.0;
      featureScores['fatiguePenalty'] = fatigue;

      // Repetition: recently shown in another section
      const repetition = recentShownSet.has(candidate.characterId) ? 1.0 : 0.0;
      featureScores['repetitionPenalty'] = repetition;

      featureScores['negativeSignalPenalty'] = 0.0;

      // Calculate final composite score
      let totalScore =
        featureScores['semanticRelevance']! * weights.semanticRelevance +
        featureScores['categoryMatch']! * weights.categoryMatch +
        featureScores['tagMatch']! * weights.tagMatch +
        featureScores['popularity']! * weights.popularity +
        featureScores['trendingVelocity']! * weights.trendingVelocity +
        featureScores['quality']! * weights.quality +
        featureScores['userPreference']! * weights.userPreference +
        featureScores['languageMatch']! * weights.languageMatch +
        featureScores['freshness']! * weights.freshness +
        featureScores['novelty']! * weights.novelty -
        featureScores['fatiguePenalty']! * weights.fatiguePenalty -
        featureScores['repetitionPenalty']! * weights.repetitionPenalty;

      totalScore = Number(Math.max(0, totalScore).toFixed(4));

      ranked.push({
        characterId: candidate.characterId,
        score: totalScore,
        rankingVersion,
        featureScores,
        candidateSources: candidate.candidateSources,
        document: doc,
      });
    }

    // Sort by composite score descending
    ranked.sort((a, b) => b.score - a.score);

    return { ranked, rankingVersion, diversityRules };
  }

  /**
   * Simulates ranking for the Admin Discovery Studio sandbox.
   */
  public static async simulateRanking(
    userContext: {
      userId?: string;
      preferredCategories?: string[];
      preferredLanguages?: string[];
    },
    rankingVersion?: string,
    limit = 30,
  ): Promise<RankingSimulationResult> {
    const docs = await prisma.searchDocument.findMany({
      take: limit * 2,
      orderBy: { popularityScore: 'desc' },
    });

    const candidateItems: CandidateCharacterItem[] = docs.map(d => ({
      characterId: d.characterId,
      candidateSources: ['POPULAR', 'TRENDING'],
      initialScore: d.popularityScore,
    }));

    const { ranked, rankingVersion: resolvedVersion, diversityRules } = await this.rankCandidates(
      candidateItems,
      {
        ...userContext,
        rankingVersion,
      },
    );

    // Track diversity cap stats
    const creatorCounts = new Map<string, number>();
    const categoryCounts = new Map<string, number>();
    let creatorsCapped = 0;
    let categoriesCapped = 0;

    const diversified: any[] = [];
    for (const item of ranked) {
      const creator = item.document?.creatorUsername || 'official';
      const category = item.document?.category || 'general';

      const curCreator = creatorCounts.get(creator) || 0;
      const curCat = categoryCounts.get(category) || 0;

      if (curCreator >= diversityRules.maxPerCreator) {
        creatorsCapped++;
        continue;
      }
      if (curCat >= diversityRules.maxPerCategory) {
        categoriesCapped++;
        continue;
      }

      creatorCounts.set(creator, curCreator + 1);
      categoryCounts.set(category, curCat + 1);

      diversified.push({
        rank: diversified.length + 1,
        characterId: item.characterId,
        name: item.document?.name || 'Unknown',
        category,
        creatorUsername: creator,
        score: item.score,
        featureScores: item.featureScores,
        candidateSources: item.candidateSources as any,
        isExploration: false,
        explanationReason: item.candidateSources.includes('PREFERENCE')
          ? 'Matched your interest in ' + category
          : item.candidateSources.includes('TRENDING')
            ? 'Trending now'
            : 'Popular companion',
      });

      if (diversified.length >= limit) break;
    }

    return {
      rankingVersion: resolvedVersion,
      userContext: {
        userId: userContext.userId,
        preferredCategories: userContext.preferredCategories || [],
        preferredLanguages: userContext.preferredLanguages || ['en'],
        isReturningUser: Boolean(userContext.userId),
      },
      totalCandidates: candidateItems.length,
      eligibleCandidates: ranked.length,
      diversifiedCount: diversified.length,
      results: diversified,
      rankedItems: diversified,
      appliedDiversityCapStats: {
        creatorsCapped,
        categoriesCapped,
      },
    };
  }

}
