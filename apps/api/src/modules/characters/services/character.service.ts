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
import { CharacterCompiler, type CompilationContext } from '../engine/compiler.js';

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
   * Creates a personalized AI companion for an authenticated user with full compiler setup & active conversation.
   */
  public static async createCustomUserCompanion(
    userId: string,
    input: {
      name: string;
      tagline?: string;
      category?: string;
      archetype?: string;
      avatarUrl?: string;
      coverImageUrl?: string;
      domainFocus?: string;
      personalityPrompt?: string;
      traits?: {
        warmth?: number;
        playfulness?: number;
        sarcasm?: number;
        empathy?: number;
        confidence?: number;
      };
      language?: 'hinglish' | 'en' | 'hi';
      rules?: string[];
      greeting?: string;
    },
  ): Promise<{ character: any; conversationId: string }> {
    const name = input.name.trim();
    let baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'companion';
    let slug = baseSlug;
    let counter = 1;
    while (await prisma.character.findFirst({ where: { slug, deletedAt: null } })) {
      slug = `${baseSlug}-${counter++}`;
    }

    const internalKey = `user_char_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const avatarUrl =
      input.avatarUrl ||
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80';
    const coverImageUrl = input.coverImageUrl || avatarUrl;
    const category = input.category || 'friendship';
    const tagline = input.tagline || `${input.archetype || 'Custom Companion'} tailored for you`;
    const greeting = input.greeting || `Hey! I'm ${name}. What's on your mind today?`;

    const identityData = {
      name,
      role: input.archetype || 'Companion',
      occupation: input.archetype || 'Companion',
      greetingMessage: greeting,
      backstory: `${name} is a personalized companion. ${input.domainFocus || input.personalityPrompt || tagline}`,
      personalitySummary: input.personalityPrompt || tagline,
    };

    const personalityData = {
      traits: {
        warmth: input.traits?.warmth ?? 85,
        confidence: input.traits?.confidence ?? 80,
        playfulness: input.traits?.playfulness ?? 75,
        empathy: input.traits?.empathy ?? 90,
        sarcasm: input.traits?.sarcasm ?? 25,
      },
    };

    const communicationData = {
      pacing: 'natural',
      formality: 'casual',
      emojiPolicy: 'moderate',
    };

    const languageData = {
      primaryLanguage: input.language || 'hinglish',
      fallbackLanguages: ['en', 'hi'],
      codeSwitchingEnabled: true,
    };

    const behaviorRulesData = (input.rules || []).map((r, i) => ({
      id: `rule-${i + 1}`,
      type: 'DO',
      ruleText: r,
    }));
    behaviorRulesData.push({
      id: 'default-rule',
      type: 'DO',
      ruleText: `Stay in character as ${name}. Always be authentic, empathetic, and speak with natural conversational warmth.`,
    });

    const knowledgeData = input.domainFocus
      ? [
          {
            id: 'kn-domain',
            title: 'Domain Focus & Specialization',
            content: input.domainFocus,
          },
        ]
      : [];

    const versionDraft = {
      versionNumber: 1,
      status: 'PUBLISHED' as const,
      publishedAt: new Date(),
      createdById: userId,
      changeSummary: 'Initial custom companion build',
      identityData,
      personalityData,
      communicationData,
      languageData,
      behaviorRulesData,
      knowledgeData,
      relationshipConfigData: {
        familiaritySensitivity: 60,
        affectionExpression: 'expressive',
      },
      memoryConfigData: {
        memoryEnabled: true,
      },
      proactivityConfigData: {
        enabled: true,
      },
      safetyConfigData: {
        ageSuitability: 'TEEN_13_PLUS',
      },
      aiConfigData: {
        preferredModelClass: 'creative',
        temperature: 0.85,
        maxOutputTokens: 400,
      },
    };

    const compiled = CharacterCompiler.compile(versionDraft as any);

    const result = await prisma.$transaction(async (tx) => {
      const createdChar = await tx.character.create({
        data: {
          name,
          slug,
          internalKey,
          tagline,
          shortDescription: tagline,
          longDescription: input.domainFocus || tagline,
          backstory: identityData.backstory,
          avatarUrl,
          coverImageUrl,
          category,
          archetype: input.archetype || 'Custom Companion',
          age: 24,
          gender: 'Female',
          occupation: input.archetype || 'Companion',
          status: 'PUBLISHED',
          visibility: 'PUBLIC',
          isFeatured: false,
          sourceType: 'CREATOR',
          moderationStatus: 'APPROVED',
          accessType: 'free',
          createdById: userId,
        },
      });

      const version = await tx.characterVersion.create({
        data: {
          characterId: createdChar.id,
          versionNumber: 1,
          status: 'PUBLISHED',
          publishedAt: new Date(),
          createdById: userId,
          changeSummary: 'Initial custom companion build',
          identityData: identityData as any,
          personalityData: personalityData as any,
          communicationData: communicationData as any,
          languageData: languageData as any,
          behaviorRulesData: behaviorRulesData as any,
          knowledgeData: knowledgeData as any,
          relationshipConfigData: versionDraft.relationshipConfigData as any,
          memoryConfigData: versionDraft.memoryConfigData as any,
          proactivityConfigData: versionDraft.proactivityConfigData as any,
          safetyConfigData: versionDraft.safetyConfigData as any,
          aiConfigData: versionDraft.aiConfigData as any,
          compiledPromptSnapshot: compiled.systemPrompt,
        },
      });

      const updatedChar = await tx.character.update({
        where: { id: createdChar.id },
        data: {
          currentPublishedVersionId: version.id,
          currentVersionNumber: 1,
        },
      });

      // Create initial conversation for this user and companion
      const conv = await tx.conversation.create({
        data: {
          userId,
          characterId: createdChar.id,
          characterVersionId: version.id,
          title: `Chat with ${name}`,
          status: 'ACTIVE',
        },
      });

      return {
        character: updatedChar,
        conversationId: conv.id,
      };
    });

    return result;
  }

  /**
   * Invalidates Redis cache for a character.
   */
  public static async invalidateCharacterCache(characterId: string, slug?: string): Promise<void> {
    try {
      const keysToDelete = [
        `char:pub:id:${characterId}`,
        'discovery:categories:all',
        'home:guest:v26',
      ];
      if (slug) {
        keysToDelete.push(`char:pub:slug:${slug}`);
      }
      await redis.del(...keysToDelete);
      logger.info(`Invalidated public character & home discovery cache for character ${characterId} (${slug || ''})`);
    } catch (err) {
      logger.warn(`Failed to invalidate character cache: ${(err as Error).message}`);
    }
  }
}
