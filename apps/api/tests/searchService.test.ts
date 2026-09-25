import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchService } from '../src/modules/discovery/search/SearchService.js';
import { SearchIndexService } from '../src/modules/discovery/search/SearchIndexService.js';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { redis } from '../src/infrastructure/redis/redis.js';

describe('SearchService — Production Hybrid Search, Typo Tolerance, Vectors & Cursor Pagination', () => {
  const mockSearchDoc1 = {
    id: 'doc-1',
    characterId: 'char-1',
    name: 'Elena Vance',
    slug: 'elena-vance',
    tagline: 'A sharp, witty literary companion',
    shortDescription: 'Literary companion and curious conversationalist',
    longDescription: 'Elena loves reading and deep discussions',
    category: 'companion',
    tags: ['literature', 'witty', 'friendly'],
    language: 'en',
    supportedLanguages: ['en'],
    personalityDescriptors: ['witty', 'curious'],
    communicationStyles: ['casual'],
    creatorId: null,
    creatorUsername: null,
    searchText: 'elena vance a sharp, witty literary companion literature witty friendly',
    embedding: SearchIndexService.generateEmbeddingVector('elena vance literary companion witty'),
    embeddingModel: 'text-embedding-3-small',
    embeddingVersion: 'v1',
    indexVersion: 1,
    popularityScore: 85,
    qualityScore: 90,
    trendingScore: 80,
    publishedAt: new Date(),
    indexedAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSearchDoc2 = {
    id: 'doc-2',
    characterId: 'char-2',
    name: 'CodeSensei Python',
    slug: 'codesensei-python',
    tagline: 'Expert coding mentor for algorithms and software engineering',
    shortDescription: 'Master programming concepts and debug quickly',
    longDescription: 'Patient teacher who explains software design and data structures',
    category: 'education',
    tags: ['coding', 'python', 'programming', 'study'],
    language: 'en',
    supportedLanguages: ['en'],
    personalityDescriptors: ['patient', 'structured'],
    communicationStyles: ['structured'],
    creatorId: 'creator-1',
    creatorUsername: 'devguru',
    searchText: 'codesensei python expert coding mentor algorithms software programming study',
    embedding: SearchIndexService.generateEmbeddingVector('codesensei python coding programming study mentor'),
    embeddingModel: 'text-embedding-3-small',
    embeddingVersion: 'v1',
    indexVersion: 1,
    popularityScore: 92,
    qualityScore: 95,
    trendingScore: 90,
    publishedAt: new Date(),
    indexedAt: new Date(),
    updatedAt: new Date(),
  };

  const mockChar1: any = {
    id: 'char-1',
    name: 'Elena Vance',
    slug: 'elena-vance',
    tagline: 'A sharp, witty literary companion',
    shortDescription: 'Literary companion and curious conversationalist',
    avatarUrl: 'https://img.com/elena.jpg',
    category: 'companion',
    status: 'PUBLISHED',
    accessType: 'free',
    creatorProfileId: null,
    creatorProfile: null,
    categoryRef: { id: 'cat-1', name: 'companion', displayName: 'Companions' },
    discoveryConfig: { isDiscoverable: true, isSearchable: true, highlightBadges: [] },
    currentPublishedVersion: { personalityData: {}, communicationData: {} },
    tagLinks: [{ tag: { name: 'witty' } }],
    _count: { conversations: 25, favoritedBy: 10 },
  };

  const mockChar2: any = {
    id: 'char-2',
    name: 'CodeSensei Python',
    slug: 'codesensei-python',
    tagline: 'Expert coding mentor',
    shortDescription: 'Master programming concepts',
    avatarUrl: 'https://img.com/codesensei.jpg',
    category: 'education',
    status: 'PUBLISHED',
    accessType: 'free',
    creatorProfileId: 'creator-1',
    creatorProfile: { id: 'creator-1', status: 'ACTIVE', username: 'devguru' },
    categoryRef: { id: 'cat-2', name: 'education', displayName: 'Education' },
    discoveryConfig: { isDiscoverable: true, isSearchable: true, highlightBadges: [] },
    currentPublishedVersion: { personalityData: {}, communicationData: {} },
    tagLinks: [{ tag: { name: 'coding' } }],
    _count: { conversations: 50, favoritedBy: 20 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('performs exact name search and places exact matches at the top', async () => {
    vi.spyOn(prisma.searchDocument, 'findMany').mockResolvedValue([mockSearchDoc1, mockSearchDoc2] as any);
    vi.spyOn(prisma.character, 'findMany').mockResolvedValue([
      { ...mockChar1, status: 'PUBLISHED', deletedAt: null },
      { ...mockChar2, status: 'PUBLISHED', deletedAt: null },
    ] as any);
    vi.spyOn(prisma.userBlock, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.userNegativeSignal, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.searchQueryLog, 'create').mockResolvedValue({} as any);


    const result = await SearchService.searchCharacters({ q: 'Elena Vance' });
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0]?.name).toBe('Elena Vance');
  });

  it('tolerates typos and recovers results (e.g. studdy partner -> study/coding mentor)', async () => {
    vi.spyOn(prisma.searchDocument, 'findMany').mockResolvedValue([mockSearchDoc1, mockSearchDoc2] as any);
    vi.spyOn(prisma.character, 'findMany').mockResolvedValue([
      { ...mockChar2, status: 'PUBLISHED', deletedAt: null },
    ] as any);
    vi.spyOn(prisma.userBlock, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.userNegativeSignal, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.searchQueryLog, 'create').mockResolvedValue({} as any);


    const result = await SearchService.searchCharacters({ q: 'studdy' });
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0]?.name).toBe('CodeSensei Python');
  });

  it('filters out characters blocked by the user or from suspended creators', async () => {
    vi.spyOn(prisma.searchDocument, 'findMany').mockResolvedValue([mockSearchDoc1, mockSearchDoc2] as any);
    vi.spyOn(prisma.character, 'findMany').mockImplementation(async (args: any) => {
      // Mock filter check
      if (args.where?.id?.in) {
        return [
          { ...mockChar1, status: 'PUBLISHED', deletedAt: null },
          { ...mockChar2, status: 'PUBLISHED', deletedAt: null, creatorProfile: { id: 'creator-1', status: 'SUSPENDED' } },
        ] as any;
      }
      return [];
    });
    vi.spyOn(prisma.userBlock, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.userNegativeSignal, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.searchQueryLog, 'create').mockResolvedValue({} as any);


    const result = await SearchService.searchCharacters({ q: 'coding' }, 'user-1');
    // Suspended creator's character char-2 should be filtered out by CharacterEligibilityService
    expect(result.items.some(i => i.id === 'char-2')).toBe(false);
  });

  it('provides cursor pagination without deep offset database queries', async () => {
    vi.spyOn(prisma.searchDocument, 'findMany').mockResolvedValue([mockSearchDoc1, mockSearchDoc2] as any);
    vi.spyOn(prisma.character, 'findMany').mockResolvedValue([
      { ...mockChar1, status: 'PUBLISHED', deletedAt: null },
      { ...mockChar2, status: 'PUBLISHED', deletedAt: null },
    ] as any);
    vi.spyOn(prisma.userBlock, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.userNegativeSignal, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.searchQueryLog, 'create').mockResolvedValue({} as any);


    const page1 = await SearchService.searchCharacters({ limit: 1 });
    expect(page1.items.length).toBe(1);
    expect(page1.hasMore).toBe(true);
    expect(page1.nextCursor).toBeDefined();

    const page2 = await SearchService.searchCharacters({ limit: 1, cursor: page1.nextCursor! });
    expect(page2.items.length).toBe(1);
  });

  it('suggests spell corrections and popular fallback categories on zero-result queries', async () => {
    vi.spyOn(prisma.searchDocument, 'findMany').mockResolvedValue([] as any);
    vi.spyOn(prisma.characterCategory, 'findMany').mockResolvedValue([
      {
        id: 'cat-1',
        slug: 'companion',
        name: 'companion',
        displayName: 'Companions',
        description: 'Friendly chat',
        displayOrder: 1,
        isActive: true,
        isFeatured: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as any);
    vi.spyOn(prisma.searchQueryLog, 'create').mockResolvedValue({} as any);

    const result = await SearchService.searchCharacters({ q: 'xyznonexistent123' });
    expect(result.items.length).toBe(0);
    expect(result.suggestedCategories).toBeDefined();
    expect(result.suggestedCategories!.length).toBeGreaterThan(0);
  });

  it('manages user recent searches accurately', async () => {
    vi.spyOn(prisma.userSearchHistory, 'findMany').mockResolvedValue([
      {
        id: 'hist-1',
        userId: 'user-1',
        query: 'python mentor',
        normalizedQuery: 'python mentor',
        categoryFilter: null,
        lastSearchedAt: new Date(),
        createdAt: new Date(),
      },
    ] as any);

    const history = await SearchService.getRecentSearches('user-1');
    expect(history.length).toBe(1);
    expect(history[0]?.query).toBe('python mentor');

    const deleteSpy = vi.spyOn(prisma.userSearchHistory, 'deleteMany').mockResolvedValue({ count: 1 } as any);
    await SearchService.deleteRecentSearch('user-1', 'hist-1');
    expect(deleteSpy).toHaveBeenCalledWith({ where: { id: 'hist-1', userId: 'user-1' } });

    await SearchService.clearRecentSearches('user-1');
    expect(deleteSpy).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
  });
});
