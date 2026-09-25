import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CandidateGenerationService } from '../src/modules/discovery/recommendations/CandidateGenerationService.js';
import { CharacterRankingService } from '../src/modules/discovery/ranking/CharacterRankingService.js';
import { DiversificationService } from '../src/modules/discovery/ranking/DiversificationService.js';
import { prisma } from '../src/infrastructure/database/prisma.js';

describe('Ranking Engine — Multi-Stage Candidate Generation, Deterministic Ranking & Diversification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs parallel candidate generators and merges them with candidate source tracking', async () => {
    vi.spyOn(prisma.searchDocument, 'findMany').mockResolvedValue([
      { characterId: 'char-1', category: 'companion', tags: ['witty'], popularityScore: 80, qualityScore: 85, trendingScore: 90, publishedAt: new Date(), creatorId: 'cr-1' },
      { characterId: 'char-2', category: 'education', tags: ['coding'], popularityScore: 90, qualityScore: 95, trendingScore: 70, publishedAt: new Date(), creatorId: 'cr-2' },
    ] as any);

    vi.spyOn(prisma.curatedCollection, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.characterSimilarity, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.userCharacterSignal, 'findMany').mockResolvedValue([]);

    const candidates = await CandidateGenerationService.generateCandidates({
      userId: 'user-1',
      preferredCategories: ['companion'],
      recentCharacterIds: ['char-1'],
    });

    expect(candidates.length).toBeGreaterThan(0);
    const char1 = candidates.find(c => c.characterId === 'char-1');
    expect(char1).toBeDefined();
    expect(char1?.candidateSources.length).toBeGreaterThan(0);
  });

  it('ranks candidates using deterministic weighted scoring with version tracking', async () => {
    vi.spyOn(prisma.rankingConfig, 'findFirst').mockResolvedValue({
      id: 'cfg-1',
      version: 'ranking_v1',
      name: 'Default Balanced Ranking',
      description: '',
      status: 'PUBLISHED',
      isDefault: true,
      isShadow: false,
      weights: {
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
      },
      diversityRules: {
        maxPerCreator: 2,
        maxPerCategory: 4,
        mmrLambda: 0.7,
      },
      createdByAdminId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    vi.spyOn(prisma.userNegativeSignal, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.userCharacterSignal, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.searchDocument, 'findMany').mockResolvedValue([
      { characterId: 'char-1', name: 'Elena', category: 'companion', tags: ['witty'], language: 'en', popularityScore: 50, qualityScore: 60, trendingScore: 40, publishedAt: new Date(), creatorId: 'cr-1' },
      { characterId: 'char-2', name: 'Marcus', category: 'companion', tags: ['witty'], language: 'en', popularityScore: 90, qualityScore: 95, trendingScore: 90, publishedAt: new Date(), creatorId: 'cr-2' },
    ] as any);

    const mockCandidates = [
      {
        characterId: 'char-1',
        category: 'companion',
        tags: ['witty'],
        language: 'en',
        creatorId: 'cr-1',
        popularityScore: 50,
        qualityScore: 60,
        trendingScore: 40,
        publishedAt: new Date(),
        candidateSources: ['POPULAR' as const],
      },
      {
        characterId: 'char-2',
        category: 'companion',
        tags: ['witty'],
        language: 'en',
        creatorId: 'cr-2',
        popularityScore: 90,
        qualityScore: 95,
        trendingScore: 90,
        publishedAt: new Date(),
        candidateSources: ['POPULAR' as const, 'TRENDING' as const, 'PREFERENCE' as const],
      },
    ];

    const { ranked, rankingVersion } = await CharacterRankingService.rankCandidates(mockCandidates, {
      userId: 'user-1',
      preferredCategories: ['companion'],
    });

    expect(rankingVersion).toBe('ranking_v1');
    expect(ranked.length).toBe(2);
    // Char 2 has higher popularity, trending, quality and multiple sources -> should be ranked first
    expect(ranked[0]?.characterId).toBe('char-2');
    expect(ranked[0]?.score).toBeGreaterThan(ranked[1]?.score!);
  });


  it('enforces creator caps, category caps and MMR diversity', () => {
    const scoredList = [
      { characterId: 'char-1', finalScore: 0.95, category: 'anime', creatorId: 'creator-monopoly', candidateSources: ['POPULAR'] },
      { characterId: 'char-2', finalScore: 0.90, category: 'anime', creatorId: 'creator-monopoly', candidateSources: ['POPULAR'] },
      { characterId: 'char-3', finalScore: 0.85, category: 'anime', creatorId: 'creator-monopoly', candidateSources: ['POPULAR'] },
      { characterId: 'char-4', finalScore: 0.80, category: 'mentor', creatorId: 'creator-niche', candidateSources: ['NEW'] },
    ];

    const diversified = DiversificationService.diversify(scoredList, {
      rules: { maxPerCreator: 2, maxPerCategory: 3, mmrLambda: 0.7 },
      limit: 4,
    });

    // Creator-monopoly should have at most 2 items
    const monopolyCount = diversified.filter(d => d.creatorId === 'creator-monopoly').length;
    expect(monopolyCount).toBeLessThanOrEqual(2);
    expect(diversified.some(d => d.characterId === 'char-4')).toBe(true);
  });

  it('prevents cross-section duplication across Home feed', () => {
    const globalShown = new Set<string>(['char-1', 'char-2']);
    const forYouList = [
      { characterId: 'char-1', finalScore: 0.95, category: 'anime', creatorId: 'cr-1', candidateSources: ['POPULAR'] },
      { characterId: 'char-3', finalScore: 0.85, category: 'mentor', creatorId: 'cr-2', candidateSources: ['TRENDING'] },
    ];

    const allocated = DiversificationService.diversify(forYouList, {
      alreadyShownIds: globalShown,
      limit: 2,
    });

    expect(allocated.length).toBe(1);
    expect(allocated[0]?.characterId).toBe('char-3');
  });

  it('simulates ranking configuration changes for admin inspection without touching production', async () => {
    vi.spyOn(prisma.rankingConfig, 'findFirst').mockResolvedValue({
      id: 'cfg-draft',
      version: 'ranking_draft_v3',
      name: 'Draft Experimental Ranking',
      weights: {
        semanticRelevance: 0.50,
        categoryMatch: 0.10,
        tagMatch: 0.05,
        popularity: 0.05,
        trendingVelocity: 0.10,
        quality: 0.10,
        userPreference: 0.10,
        languageMatch: 0.05,
        freshness: 0.05,
        novelty: 0.05,
        fatiguePenalty: 0.10,
        negativeSignalPenalty: 0.50,
        repetitionPenalty: 0.20,
      },
      diversityRules: { maxPerCreator: 2, maxPerCategory: 4, mmrLambda: 0.7 },
    } as any);

    vi.spyOn(prisma.searchDocument, 'findMany').mockResolvedValue([
      { characterId: 'char-1', name: 'Elena', category: 'companion', tags: ['witty'], popularityScore: 80, qualityScore: 85, trendingScore: 90, publishedAt: new Date(), creatorId: 'cr-1' },
    ] as any);

    vi.spyOn(prisma.userNegativeSignal, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.userCharacterSignal, 'findMany').mockResolvedValue([]);

    const simulation = await CharacterRankingService.simulateRanking(
      { preferredCategories: ['companion'] },
      'ranking_draft_v3',
      5,
    );

    expect(simulation.rankingVersion).toBe('ranking_draft_v3');
    expect(simulation.rankedItems.length).toBeGreaterThan(0);
    expect(simulation.rankedItems[0]?.featureScores).toBeDefined();
  });
});
