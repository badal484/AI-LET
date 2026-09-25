import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiscoveryAdminService } from '../src/modules/discovery/services/DiscoveryAdminService.js';
import { SearchIndexService } from '../src/modules/discovery/search/SearchIndexService.js';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { redis } from '../src/infrastructure/redis/redis.js';

describe('DiscoveryAdminService — Synonyms, Ranking Studio, Index Health & Quality Metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates, lists, updates, and deletes search synonyms with cache invalidation', async () => {
    const mockCreated = {
      id: 'syn-1',
      term: 'study',
      synonyms: ['studying', 'academic', 'homework'],
      language: 'en',
      category: null,
      priority: 1,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.spyOn(prisma.searchSynonym, 'create').mockResolvedValue(mockCreated as any);
    vi.spyOn(prisma.searchSynonym, 'findMany').mockResolvedValue([mockCreated] as any);
    vi.spyOn(prisma.searchSynonym, 'findUnique').mockResolvedValue(mockCreated as any);
    vi.spyOn(prisma.searchSynonym, 'update').mockResolvedValue({ ...mockCreated, priority: 2 } as any);
    vi.spyOn(prisma.searchSynonym, 'delete').mockResolvedValue(mockCreated as any);
    const redisDelSpy = vi.spyOn(redis, 'del').mockResolvedValue(1 as any);

    // 1. Create
    const created = await DiscoveryAdminService.createSynonym({
      term: 'study',
      synonyms: ['studying', 'academic', 'homework'],
      language: 'en',
      priority: 1,
    });
    expect(created.term).toBe('study');
    expect(redisDelSpy).toHaveBeenCalledWith('search:synonyms:study');

    // 2. List
    const list = await DiscoveryAdminService.listSynonyms();
    expect(list.length).toBe(1);

    // 3. Update
    const updated = await DiscoveryAdminService.updateSynonym('syn-1', { priority: 2 });
    expect(updated.priority).toBe(2);

    // 4. Delete
    await DiscoveryAdminService.deleteSynonym('syn-1');
    expect(redisDelSpy).toHaveBeenCalledWith('search:synonyms:study');
  });

  it('manages ranking versions and promotes/rolls back configs safely in database', async () => {
    const mockV1 = {
      id: 'cfg-1',
      version: 'ranking_v1',
      name: 'V1',
      description: '',
      status: 'PUBLISHED',
      isDefault: true,
      isShadow: false,
      weights: {},
      diversityRules: {},
      createdByAdminId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockV2 = {
      id: 'cfg-2',
      version: 'ranking_v2',
      name: 'V2',
      description: '',
      status: 'DRAFT',
      isDefault: false,
      isShadow: true,
      weights: {},
      diversityRules: {},
      createdByAdminId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.spyOn(prisma.rankingConfig, 'findMany').mockResolvedValue([mockV1, mockV2] as any);
    vi.spyOn(prisma.rankingConfig, 'create').mockResolvedValue(mockV2 as any);
    vi.spyOn(prisma, '$transaction').mockResolvedValue([{}, {}] as any);
    vi.spyOn(prisma.rankingConfig, 'findUnique').mockResolvedValue({ ...mockV2, isDefault: true, status: 'PUBLISHED' } as any);

    const configs = await DiscoveryAdminService.listRankingConfigs();
    expect(configs.length).toBe(2);

    const published = await DiscoveryAdminService.publishRankingConfig('ranking_v2');
    expect(published.version).toBe('ranking_v2');
    expect(published.isDefault).toBe(true);
  });

  it('reports accurate search index health and identifies missing or stale documents', async () => {
    vi.spyOn(prisma.character, 'count').mockResolvedValueOnce(50).mockResolvedValueOnce(2); // totalPublished: 50, missing: 2
    vi.spyOn(prisma.searchDocument, 'count').mockResolvedValueOnce(48).mockResolvedValueOnce(0); // totalIndexed: 48, stale: 0
    vi.spyOn(prisma.searchDocument, 'findFirst').mockResolvedValue({ indexedAt: new Date() } as any);

    const health = await DiscoveryAdminService.getIndexHealth();
    expect(health.totalPublishedCharacters).toBe(50);
    expect(health.totalIndexedDocuments).toBe(48);
    expect(health.missingFromIndex).toBe(2);
    expect(health.staleDocuments).toBe(0);
    expect(health.indexVersion).toBe(SearchIndexService.CURRENT_INDEX_VERSION);
  });

  it('aggregates search quality analytics (zero results, click rate, top queries)', async () => {
    const now = new Date();
    const mockLogs = [
      { id: 'log-1', query: 'elena', normalizedQuery: 'elena', resultCount: 5, clickedCharacterId: 'char-1', createdAt: now },
      { id: 'log-2', query: 'elena', normalizedQuery: 'elena', resultCount: 5, clickedCharacterId: 'char-1', createdAt: now },
      { id: 'log-3', query: 'alien super wizard', normalizedQuery: 'alien super wizard', resultCount: 0, clickedCharacterId: null, createdAt: now },
      { id: 'log-4', query: 'alien super wizard', normalizedQuery: 'alien super wizard', resultCount: 0, clickedCharacterId: null, createdAt: now },
    ];

    vi.spyOn(prisma.searchQueryLog, 'findMany').mockResolvedValue(mockLogs as any);

    const metrics = await DiscoveryAdminService.getSearchQualityMetrics(30);
    expect(metrics.totalSearches).toBe(4);
    expect(metrics.zeroResultSearches).toBe(2);
    expect(metrics.zeroResultRatePercent).toBe(50);
    expect(metrics.searchToClickRatePercent).toBe(50);
    expect(metrics.topZeroResultQueries.length).toBe(1);
    expect(metrics.topZeroResultQueries[0]?.query).toBe('alien super wizard');
    expect(metrics.topHighConversionQueries.length).toBe(1);
    expect(metrics.topHighConversionQueries[0]?.query).toBe('elena');
  });
});
