import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../config/logger.js';
import type { CharacterDiscoveryDocument, IndexHealthSummary } from '@ai-companion/types';

export class SearchIndexService {
  public static readonly CURRENT_INDEX_VERSION = 1;
  public static readonly EMBEDDING_MODEL = 'text-embedding-3-small';
  public static readonly EMBEDDING_VERSION = 'v1';

  /**
   * Generates a deterministic mock embedding vector of dimension 16 for testing & local development
   * if no external embedding API call is made.
   */
  public static generateEmbeddingVector(text: string): number[] {
    const vector = new Array(16).fill(0);
    const normalized = text.toLowerCase();
    for (let i = 0; i < normalized.length; i++) {
      const code = normalized.charCodeAt(i);
      vector[i % 16] = Number(((vector[i % 16] + code / 255) % 1.0).toFixed(4));
    }
    // Normalize vector length to unit norm
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1.0;
    return vector.map(v => Number((v / magnitude).toFixed(4)));
  }

  /**
   * Computes cosine similarity between two float vectors.
   */
  public static computeCosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
    const len = Math.min(vecA.length, vecB.length);
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < len; i++) {
      const a = vecA[i] || 0;
      const b = vecB[i] || 0;
      dot += a * b;
      normA += a * a;
      normB += b * b;
    }
    if (normA === 0 || normB === 0) return 0;
    return Math.max(0, Math.min(1, dot / (Math.sqrt(normA) * Math.sqrt(normB))));
  }

  /**
   * Indexes or updates a single character in the searchable SearchDocument store.
   */
  public static async indexCharacter(characterId: string): Promise<CharacterDiscoveryDocument | null> {
    const character = await prisma.character.findUnique({
      where: { id: characterId },
      include: {
        creatorProfile: true,
        categoryRef: true,
        discoveryConfig: true,
        tagLinks: {
          include: { tag: true },
        },
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
    });

    if (!character || character.status !== 'PUBLISHED' || character.deletedAt) {
      // If character exists in search index but is no longer published, remove it
      await this.removeCharacter(characterId);
      return null;
    }

    const tags = character.tagLinks.map(tl => tl.tag.name.toLowerCase());
    const category = character.categoryRef?.name || character.category;
    const latestVersion = character.versions[0];

    // Extract personality descriptors & communication styles safely
    const personalityData = (latestVersion?.personalityData as any) || {};
    const communicationData = (latestVersion?.communicationData as any) || {};

    const personalityDescriptors: string[] = Array.isArray(personalityData.traits)
      ? personalityData.traits
      : [character.archetype, personalityData.archetype].filter(Boolean);

    const communicationStyles: string[] = [
      communicationData.formality,
      communicationData.pacing,
      communicationData.humorStyle,
    ].filter(Boolean);

    // Build searchable unified text block
    const searchTextParts = [
      character.name,
      character.tagline,
      character.shortDescription,
      character.longDescription,
      character.archetype,
      character.occupation,
      category,
      ...tags,
      ...personalityDescriptors,
      character.creatorProfile?.username,
      character.creatorProfile?.displayName,
    ].filter(Boolean);

    const searchText = searchTextParts.join(' ').toLowerCase();
    const embedding = this.generateEmbeddingVector(searchText);

    // Compute quality & popularity signals
    const signals = await prisma.userCharacterSignal.aggregate({
      where: { characterId },
      _sum: { startsCount: true, messagesCount: true, favoritesCount: true, viewsCount: true },
      _avg: { engagementScore: true },
    });

    const starts = signals._sum.startsCount || 0;
    const messages = signals._sum.messagesCount || 0;
    const favorites = signals._sum.favoritesCount || 0;
    const views = signals._sum.viewsCount || 1;

    // Normalizing popularity score in [0.0, 100.0]
    const popularityScore = Number(
      Math.min(100, (starts * 2.0 + messages * 0.1 + favorites * 5.0) / 10).toFixed(2),
    );

    // Quality score: ratio of starts to views + average engagement
    const startRate = Math.min(1.0, starts / views);
    const avgEngagement = (signals._avg.engagementScore || 50) / 100;
    const qualityScore = Number(((startRate * 0.5 + avgEngagement * 0.5) * 100).toFixed(2));

    // Trending score from recent activity in last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const recentActivity = await prisma.userCharacterSignal.aggregate({
      where: { characterId, lastInteractedAt: { gte: sevenDaysAgo } },
      _sum: { startsCount: true, messagesCount: true },
    });
    const trendingScore = Number(
      Math.min(100, ((recentActivity._sum.startsCount || 0) * 3 + (recentActivity._sum.messagesCount || 0) * 0.2)).toFixed(2),
    );

    const doc = await prisma.searchDocument.upsert({
      where: { characterId },
      create: {
        characterId,
        name: character.name,
        slug: character.slug,
        tagline: character.tagline,
        shortDescription: character.shortDescription,
        longDescription: character.longDescription,
        category,
        tags,
        language: character.discoveryConfig?.localizedProfiles ? 'en' : 'en',
        supportedLanguages: ['en', 'hi'],
        personalityDescriptors,
        communicationStyles,
        creatorId: character.creatorProfileId || null,
        creatorUsername: character.creatorProfile?.username || null,
        searchText,
        embedding: embedding as any,
        embeddingModel: this.EMBEDDING_MODEL,
        embeddingVersion: this.EMBEDDING_VERSION,
        indexVersion: this.CURRENT_INDEX_VERSION,
        popularityScore,
        qualityScore,
        trendingScore,
        publishedAt: character.updatedAt,
      },
      update: {
        name: character.name,
        slug: character.slug,
        tagline: character.tagline,
        shortDescription: character.shortDescription,
        longDescription: character.longDescription,
        category,
        tags,
        personalityDescriptors,
        communicationStyles,
        creatorId: character.creatorProfileId || null,
        creatorUsername: character.creatorProfile?.username || null,
        searchText,
        embedding: embedding as any,
        embeddingModel: this.EMBEDDING_MODEL,
        embeddingVersion: this.EMBEDDING_VERSION,
        indexVersion: this.CURRENT_INDEX_VERSION,
        popularityScore,
        qualityScore,
        trendingScore,
        updatedAt: new Date(),
      },
    });

    return this.mapToDocumentItem(doc);
  }

  /**
   * Removes a character from the search document index.
   */
  public static async removeCharacter(characterId: string): Promise<void> {
    try {
      await prisma.searchDocument.deleteMany({
        where: { characterId },
      });
    } catch (err) {
      logger.error('Failed to remove search document', { err, characterId });
    }
  }

  /**
   * Bulk re-indexes all published characters.
   */
  public static async bulkIndex(characterIds?: string[]): Promise<{ indexed: number; removed: number }> {
    const where = characterIds ? { id: { in: characterIds } } : { status: 'PUBLISHED' as const, deletedAt: null };
    const characters = await prisma.character.findMany({
      where,
      select: { id: true, status: true },
    });

    let indexed = 0;
    let removed = 0;

    for (const char of characters) {
      if (char.status === 'PUBLISHED') {
        await this.indexCharacter(char.id);
        indexed++;
      } else {
        await this.removeCharacter(char.id);
        removed++;
      }
    }

    return { indexed, removed };
  }

  /**
   * Returns index health diagnostics.
   */
  public static async getHealth(): Promise<IndexHealthSummary> {
    const totalPublishedCharacters = await prisma.character.count({
      where: { status: 'PUBLISHED', deletedAt: null },
    });

    const totalIndexedDocuments = await prisma.searchDocument.count();

    // Check published characters that do not have a search document
    const missingDocs = await prisma.character.count({
      where: {
        status: 'PUBLISHED',
        deletedAt: null,
        searchDocument: null,
      },
    });

    // Check stale index documents whose indexVersion is older than current
    const staleDocuments = await prisma.searchDocument.count({
      where: {
        indexVersion: { lt: this.CURRENT_INDEX_VERSION },
      },
    });

    const latestDoc = await prisma.searchDocument.findFirst({
      orderBy: { indexedAt: 'desc' },
      select: { indexedAt: true },
    });

    return {
      totalPublishedCharacters,
      totalIndexedDocuments,
      missingFromIndex: missingDocs,
      staleDocuments,
      indexVersion: this.CURRENT_INDEX_VERSION,
      embeddingModel: this.EMBEDDING_MODEL,
      embeddingVersion: this.EMBEDDING_VERSION,
      lastReindexedAt: latestDoc?.indexedAt.toISOString() || null,
    };
  }

  private static mapToDocumentItem(doc: any): CharacterDiscoveryDocument {
    return {
      id: doc.id,
      characterId: doc.characterId,
      name: doc.name,
      slug: doc.slug,
      tagline: doc.tagline,
      shortDescription: doc.shortDescription,
      longDescription: doc.longDescription,
      category: doc.category,
      tags: (doc.tags as string[]) || [],
      language: doc.language,
      supportedLanguages: (doc.supportedLanguages as string[]) || ['en'],
      personalityDescriptors: (doc.personalityDescriptors as string[]) || [],
      communicationStyles: (doc.communicationStyles as string[]) || [],
      creatorId: doc.creatorId,
      creatorUsername: doc.creatorUsername,
      searchText: doc.searchText,
      embedding: (doc.embedding as number[]) || null,
      embeddingModel: doc.embeddingModel,
      embeddingVersion: doc.embeddingVersion,
      indexVersion: doc.indexVersion,
      popularityScore: doc.popularityScore,
      qualityScore: doc.qualityScore,
      trendingScore: doc.trendingScore,
      publishedAt: doc.publishedAt?.toISOString() || null,
      indexedAt: doc.indexedAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }
}
