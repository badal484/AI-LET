import { prisma } from '../../../infrastructure/database/prisma.js';
import { redis } from '../../../infrastructure/redis/redis.js';
import { logger } from '../../../config/logger.js';
import { SYSTEM_CONSTANTS, ErrorCode } from '@ai-companion/config';
import { NotFoundError } from '../../../shared/errors/AppError.js';
import type {
  CharacterSummary,
  CharacterPublicDetail,
  CharacterRuntimeObject,
  CharacterVersionSnapshot,
} from '@ai-companion/types';
import type { PublicCharacterQueryInput } from '@ai-companion/validation';
import { CharacterRuntimeBuilder } from '../engine/runtime.js';
import type { CompilationContext } from '../engine/compiler.js';

export class CharacterService {
  private static CACHE_TTL_SECONDS = SYSTEM_CONSTANTS.CACHE?.CHARACTER_TTL_SECONDS || 3600;

  /**
   * Lists public characters with status = PUBLISHED and visibility = PUBLIC.
   */
  public static async listPublicCharacters(
    params: PublicCharacterQueryInput,
  ): Promise<{ characters: CharacterSummary[]; total: number; page: number; limit: number }> {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      deletedAt: null,
    };

    if (params.category) {
      where.category = params.category;
    }

    if (params.featuredOnly) {
      where.isFeatured = true;
    }

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { tagline: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [characters, total] = await Promise.all([
      prisma.character.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ isFeatured: 'desc' }, { updatedAt: 'desc' }],
        select: {
          id: true,
          slug: true,
          name: true,
          tagline: true,
          avatarUrl: true,
          coverImageUrl: true,
          category: true,
          status: true,
          visibility: true,
          isFeatured: true,
          currentPublishedVersionId: true,
          currentVersionNumber: true,
          updatedAt: true,
        },
      }),
      prisma.character.count({ where }),
    ]);

    const summaries: CharacterSummary[] = characters.map(c => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      tagline: c.tagline,
      avatarUrl: c.avatarUrl,
      coverImageUrl: c.coverImageUrl,
      category: c.category,
      status: c.status as any,
      visibility: c.visibility as any,
      isFeatured: c.isFeatured,
      currentPublishedVersionId: c.currentPublishedVersionId,
      currentVersionNumber: c.currentVersionNumber,
      updatedAt: c.updatedAt.toISOString(),
    }));

    return {
      characters: summaries,
      total,
      page,
      limit,
    };
  }

  /**
   * Retrieves sanitized public details of a published character by ID or slug.
   * Uses Redis caching. Strictly filters internal system prompts, hidden rules, and provider credentials.
   */
  public static async getPublicCharacterBySlugOrId(identifier: string): Promise<CharacterPublicDetail> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    const cacheKey = `char:pub:${isUuid ? `id:${identifier}` : `slug:${identifier}`}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as CharacterPublicDetail;
      }
    } catch (err) {
      logger.warn(`Redis cache get error for ${cacheKey}: ${(err as Error).message}`);
    }

    const character = await prisma.character.findFirst({
      where: {
        ...(isUuid ? { id: identifier } : { slug: identifier }),
        status: 'PUBLISHED',
        deletedAt: null,
      },
      include: {
        currentPublishedVersion: true,
      },
    });

    if (!character) {
      throw new NotFoundError('Character not found or not published', ErrorCode.CHARACTER_NOT_FOUND);
    }

    let version = character.currentPublishedVersion;
    if (!version) {
      version = await prisma.characterVersion.findFirst({
        where: { characterId: character.id },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!version) {
      throw new NotFoundError('Character has no published version', ErrorCode.CHARACTER_NOT_FOUND);
    }
    const personalityData = version.personalityData as any;
    const communicationData = version.communicationData as any;
    const languageData = version.languageData as any;

    const publicDetail: CharacterPublicDetail = {
      id: character.id,
      slug: character.slug,
      name: character.name,
      tagline: character.tagline,
      shortDescription: character.shortDescription,
      longDescription: character.longDescription,
      avatarUrl: character.avatarUrl,
      coverImageUrl: character.coverImageUrl,
      category: character.category,
      archetype: character.archetype,
      age: character.age,
      gender: character.gender,
      occupation: character.occupation,
      isFeatured: character.isFeatured,
      versionNumber: version.versionNumber,
      traits: {
        warmth: personalityData?.traits?.warmth ?? 75,
        playfulness: personalityData?.traits?.playfulness ?? 70,
        curiosity: personalityData?.traits?.curiosity ?? 80,
        humorStyle: personalityData?.humorStyle ?? 'playful',
        quirks: personalityData?.customQuirks ?? [],
      },
      communication: {
        pacing: communicationData?.pacing ?? 'thoughtful',
        formality: communicationData?.formality ?? 'casual',
        primaryLanguage: languageData?.primaryLanguage ?? 'en',
      },
      voiceSampleUrl: null,
      createdAt: character.createdAt.toISOString(),
    };

    try {
      await redis.set(cacheKey, JSON.stringify(publicDetail), 'EX', this.CACHE_TTL_SECONDS);
      // Also cache the alternate key (ID vs slug)
      const altKey = isUuid ? `char:pub:slug:${character.slug}` : `char:pub:id:${character.id}`;
      await redis.set(altKey, JSON.stringify(publicDetail), 'EX', this.CACHE_TTL_SECONDS);
    } catch (err) {
      logger.warn(`Redis cache set error for ${cacheKey}: ${(err as Error).message}`);
    }

    return publicDetail;
  }

  /**
   * Resolves the immutable CharacterRuntimeObject for conversation execution.
   * Can resolve by Character ID/Slug (using published version) or by specific Version ID (for testing/reproducibility).
   */
  public static async resolveRuntime(
    characterIdOrSlug: string,
    versionId?: string,
    context?: CompilationContext,
  ): Promise<CharacterRuntimeObject> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(characterIdOrSlug);

    const character = await prisma.character.findFirst({
      where: {
        OR: isUuid ? [{ id: characterIdOrSlug }] : [{ slug: characterIdOrSlug }],
        deletedAt: null,
      },
      include: {
        currentPublishedVersion: true,
      },
    });

    if (!character) {
      throw new NotFoundError('Character not found', ErrorCode.CHARACTER_NOT_FOUND);
    }

    let version: any = null;
    if (versionId) {
      version = await prisma.characterVersion.findUnique({
        where: { id: versionId },
      });
      if (!version || version.characterId !== character.id) {
        throw new NotFoundError('Character version not found', ErrorCode.CHARACTER_VERSION_NOT_FOUND);
      }
    } else {
      version = character.currentPublishedVersion;
      if (!version) {
        throw new NotFoundError('Character has no published version', ErrorCode.CHARACTER_NOT_FOUND);
      }
    }

    const versionSnapshot: CharacterVersionSnapshot = {
      id: version.id,
      characterId: version.characterId,
      versionNumber: version.versionNumber,
      status: version.status,
      identityData: version.identityData as any,
      personalityData: version.personalityData as any,
      communicationData: version.communicationData as any,
      languageData: version.languageData as any,
      behaviorRulesData: version.behaviorRulesData as any,
      knowledgeData: version.knowledgeData as any,
      relationshipConfigData: version.relationshipConfigData as any,
      memoryConfigData: version.memoryConfigData as any,
      proactivityConfigData: version.proactivityConfigData as any,
      safetyConfigData: version.safetyConfigData as any,
      aiConfigData: version.aiConfigData as any,
      voiceConfigData: version.voiceConfigData as any,
      compiledPromptSnapshot: version.compiledPromptSnapshot || undefined,
      changeSummary: version.changeSummary,
      createdById: version.createdById,
      publishedAt: version.publishedAt?.toISOString(),
      createdAt: version.createdAt.toISOString(),
      updatedAt: version.updatedAt.toISOString(),
    };

    return CharacterRuntimeBuilder.buildRuntime(
      {
        id: character.id,
        slug: character.slug,
        name: character.name,
        status: character.status as any,
      },
      versionSnapshot,
      context,
    );
  }

  /**
   * Invalidates Redis cache for a character.
   */
  public static async invalidateCharacterCache(characterId: string, slug?: string): Promise<void> {
    try {
      const keysToDelete = [`char:pub:id:${characterId}`];
      if (slug) {
        keysToDelete.push(`char:pub:slug:${slug}`);
      }
      await redis.del(...keysToDelete);
      logger.info(`Invalidated public character cache for character ${characterId} (${slug || ''})`);
    } catch (err) {
      logger.warn(`Failed to invalidate character cache: ${(err as Error).message}`);
    }
  }
}
