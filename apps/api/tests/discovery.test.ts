import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CharacterDiscoveryEligibilityService } from '../src/modules/discovery/services/CharacterDiscoveryEligibilityService.js';
import { SearchService } from '../src/modules/discovery/search/SearchService.js';
import { RecommendationEngine } from '../src/modules/discovery/recommendations/RecommendationEngine.js';
import { TrendingEngine } from '../src/modules/discovery/ranking/TrendingEngine.js';
import { CatalogService } from '../src/modules/discovery/catalogs/CatalogService.js';
import { HomeFeedService } from '../src/modules/discovery/services/HomeFeedService.js';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { redis } from '../src/infrastructure/redis/redis.js';

describe('Phase 12: Discovery, Catalog, Search, Recommendations & Home API', () => {
  const mockChar1: any = {
    id: 'char-1111-1111',
    internalKey: 'elena_v1',
    slug: 'elena-vance',
    name: 'Elena Vance',
    tagline: 'A sharp, witty companion with a love for literature',
    shortDescription: 'Literary companion and curious conversationalist',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
    coverImageUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9',
    category: 'companion',
    categoryId: 'cat-1111',
    archetype: 'literary_companion',
    backstory: 'A warm conversationalist who reads late at night',
    age: 26,
    gender: 'female',
    occupation: 'Archivist',
    status: 'PUBLISHED',
    visibility: 'PUBLIC',
    isFeatured: true,
    accessType: 'free',
    requiredEntitlement: null,
    currentVersionNumber: 1,
    currentPublishedVersionId: 'ver-1111',
    currentPublishedVersion: {
      id: 'ver-1111',
      versionNumber: 1,
      status: 'PUBLISHED',
      personalityData: { traits: { warmth: 85, playfulness: 75, curiosity: 90 }, humorStyle: 'dry_wit' },
      communicationData: { pacing: 'thoughtful', formality: 'casual' },
      languageData: { primaryLanguage: 'en' },
    },
    categoryRef: { id: 'cat-1111', slug: 'companion', displayName: 'Companions' },
    discoveryConfig: {
      isDiscoverable: true,
      isSearchable: true,
      isTrendingEnabled: true,
      isRecommendationEnabled: true,
      editorialPriority: 10,
      editorialBoost: 1.5,
      conversationStarters: ['What are you reading?'],
      highlightBadges: ['Editor Choice'],
      ageGate: 0,
    },
    tagLinks: [
      {
        tag: { id: 'tag-1', slug: 'witty', name: 'Witty', displayName: 'Witty' },
      },
    ],
    createdAt: new Date(Date.now() - 3600000),
    updatedAt: new Date(),
    _count: { conversations: 42, favoritedBy: 15 },
  };

  const mockChar2: any = {
    id: 'char-2222-2222',
    internalKey: 'marcus_v1',
    slug: 'marcus-aurelius-ai',
    name: 'Marcus the Stoic',
    tagline: 'Timeless wisdom for navigating modern challenges',
    shortDescription: 'Philosopher guide and mentor',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d',
    coverImageUrl: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4',
    category: 'mentor',
    categoryId: 'cat-2222',
    archetype: 'stoic_mentor',
    backstory: 'Practitioner of resilience and mindfulness',
    age: 45,
    gender: 'male',
    occupation: 'Philosopher',
    status: 'PUBLISHED',
    visibility: 'PUBLIC',
    isFeatured: false,
    accessType: 'entitlement',
    requiredEntitlement: 'pro_access',
    currentVersionNumber: 1,
    currentPublishedVersionId: 'ver-2222',
    currentPublishedVersion: {
      id: 'ver-2222',
      versionNumber: 1,
      status: 'PUBLISHED',
      personalityData: { traits: { warmth: 70, playfulness: 30, curiosity: 85 }, humorStyle: 'subtle' },
      communicationData: { pacing: 'deliberate', formality: 'formal' },
      languageData: { primaryLanguage: 'en' },
    },
    categoryRef: { id: 'cat-2222', slug: 'mentor', displayName: 'Mentors' },
    discoveryConfig: {
      isDiscoverable: true,
      isSearchable: true,
      isTrendingEnabled: true,
      isRecommendationEnabled: true,
      editorialPriority: 5,
      editorialBoost: 1.0,
      conversationStarters: ['Help me reflect.'],
      highlightBadges: ['Wisdom'],
      ageGate: 0,
    },
    tagLinks: [
      {
        tag: { id: 'tag-2', slug: 'philosophical', name: 'Philosophical', displayName: 'Philosophical' },
      },
    ],
    createdAt: new Date(Date.now() - 7200000),
    updatedAt: new Date(),
    _count: { conversations: 12, favoritedBy: 8 },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(redis, 'get').mockResolvedValue(null);
    vi.spyOn(redis, 'set').mockResolvedValue('OK' as any);
    vi.spyOn(redis, 'del').mockResolvedValue(1);
  });

  describe('CharacterDiscoveryEligibilityService', () => {
    it('approves published, public characters with a published version', async () => {
      vi.spyOn(prisma.character, 'findUnique').mockResolvedValue(mockChar1);

      const check = await CharacterDiscoveryEligibilityService.isCharacterEligible(mockChar1.id);
      expect(check.eligible).toBe(true);
    });

    it('rejects draft or unpublished characters', async () => {
      vi.spyOn(prisma.character, 'findUnique').mockResolvedValue({
        ...mockChar1,
        status: 'DRAFT',
      });

      const check = await CharacterDiscoveryEligibilityService.isCharacterEligible('draft-id');
      expect(check.eligible).toBe(false);
      expect(check.reason).toBe('NOT_PUBLISHED');
    });

    it('correctly evaluates entitlement locking', () => {
      const freeChar = { accessType: 'free', requiredEntitlement: null };
      const proChar = { accessType: 'entitlement', requiredEntitlement: 'pro_access' };

      expect(CharacterDiscoveryEligibilityService.isCharacterLocked(freeChar, [])).toBe(false);
      expect(CharacterDiscoveryEligibilityService.isCharacterLocked(proChar, [])).toBe(true);
      expect(CharacterDiscoveryEligibilityService.isCharacterLocked(proChar, ['pro_access'])).toBe(false);
    });
  });

  describe('SearchService', () => {
    it('finds published character and performs weighted relevance sorting', async () => {
      vi.spyOn(prisma.character, 'findMany').mockResolvedValue([mockChar1, mockChar2]);
      vi.spyOn(prisma.character, 'count').mockResolvedValue(2);
      vi.spyOn(prisma.searchQueryLog, 'create').mockResolvedValue({} as any);

      const results = await SearchService.searchCharacters({ q: 'Elena Vance' });
      expect(results.items.length).toBeGreaterThanOrEqual(1);
      expect(results.items[0]?.slug).toBe('elena-vance');
    });


    it('supports category and tag filtering', async () => {
      vi.spyOn(prisma.character, 'findMany').mockResolvedValue([mockChar2]);
      vi.spyOn(prisma.character, 'count').mockResolvedValue(1);

      const results = await SearchService.searchCharacters({ category: 'mentor' });
      expect(results.items.length).toBe(1);
      expect(results.items[0]?.category).toBe('mentor');
    });
  });

  describe('RecommendationEngine', () => {
    it('generates multi-factor candidate recommendations', async () => {
      vi.spyOn(prisma.character, 'findMany').mockResolvedValue([mockChar1, mockChar2]);
      vi.spyOn(prisma.userCharacterSignal, 'findMany').mockResolvedValue([]);
      vi.spyOn(prisma.userFavorite, 'findMany').mockResolvedValue([]);
      vi.spyOn(prisma.userDiscoveryPreference, 'findUnique').mockResolvedValue(null);

      const recs = await RecommendationEngine.getRecommendations({ limit: 5 });
      expect(recs.items.length).toBe(2);
      expect(recs.items[0]?.recommendationReason).toBeDefined();
    });

    it('applies category affinity boost for test preferences', async () => {
      vi.spyOn(prisma.character, 'findMany').mockResolvedValue([mockChar1, mockChar2]);

      const recs = await RecommendationEngine.getRecommendations({
        simulatedPreferences: {
          categoryIds: ['cat-2222'],
        },
      });

      expect(recs.items.length).toBe(2);
      expect(recs.items[0]?.category).toBe('mentor');
    });
  });

  describe('TrendingEngine', () => {
    it('ranks and caches trending characters with activity weights', async () => {
      vi.spyOn(prisma.character, 'findMany').mockResolvedValue([mockChar1, mockChar2]);

      const trending = await TrendingEngine.getTrendingCharacters(5);
      expect(trending.length).toBe(2);
      expect(trending[0]?.slug).toBe('elena-vance');
      expect(trending[0]?.recommendationReasonCode).toBe('TRENDING_THIS_WEEK');
    });
  });

  describe('CatalogService & Public Profile Sanitization', () => {
    it('retrieves sanitized public profile without leaking private system data', async () => {
      vi.spyOn(prisma.character, 'findFirst').mockResolvedValue(mockChar1);
      vi.spyOn(prisma.character, 'findMany').mockResolvedValue([mockChar2]);

      const profile = await CatalogService.getPublicCharacterProfile('elena-vance');
      expect(profile.name).toBe('Elena Vance');
      expect(profile.traits.warmth).toBe(85);
      expect(profile.conversationStarters).toContain('What are you reading?');
      expect((profile as any).compiledPromptSnapshot).toBeUndefined();
      expect((profile as any).behaviorRulesData).toBeUndefined();
    });

    it('allows users to bookmark and retrieve favorites', async () => {
      vi.spyOn(prisma.userFavorite, 'upsert').mockResolvedValue({} as any);
      vi.spyOn(prisma.userFavorite, 'deleteMany').mockResolvedValue({ count: 1 } as any);

      const addResult = await CatalogService.toggleFavorite('usr-1', mockChar1.id, true);
      expect(addResult.isFavorite).toBe(true);

      const removeResult = await CatalogService.toggleFavorite('usr-1', mockChar1.id, false);
      expect(removeResult.isFavorite).toBe(false);
    });
  });

  describe('HomeFeedService', () => {
    it('assembles complete tiered home feed structure', async () => {
      vi.spyOn(prisma.homeSectionConfig, 'findMany').mockResolvedValue([]);
      vi.spyOn(prisma.character, 'findMany').mockResolvedValue([mockChar1, mockChar2]);
      vi.spyOn(prisma.curatedCollection, 'findMany').mockResolvedValue([]);
      vi.spyOn(prisma.characterCategory, 'findMany').mockResolvedValue([]);

      const feed = await HomeFeedService.getHomeFeed(undefined, { limit: 10 });
      expect(feed.greeting).toBeDefined();
      expect(feed.sections).toBeInstanceOf(Array);
      expect(feed.sections.length).toBeGreaterThan(0);
    });
  });
});
