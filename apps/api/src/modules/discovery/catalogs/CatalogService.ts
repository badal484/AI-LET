import { prisma } from '../../../infrastructure/database/prisma.js';
import { redis } from '../../../infrastructure/redis/redis.js';
import { logger } from '../../../config/logger.js';
import { NotFoundError } from '../../../shared/errors/AppError.js';
import { CharacterDiscoveryEligibilityService } from '../services/CharacterDiscoveryEligibilityService.js';
import type {
  CharacterCategorySummary,
  CuratedCollectionSummary,
  CharacterCatalogItem,
  PublicCharacterDetailedProfile,
  UserDiscoveryPreferencesData,
} from '@ai-companion/types';

export class CatalogService {
  private static CACHE_TTL_SECONDS = 1800; // 30 minutes

  /**
   * Formats a raw Prisma character query result into a public CharacterCatalogItem.
   */
  public static mapToCatalogItem(
    character: any,
    options: {
      isFavorite?: boolean;
      userEntitlements?: string[];
      reason?: string | null;
      reasonCode?: string | null;
    } = {},
  ): CharacterCatalogItem {
    const config = character.discoveryConfig || {};
    const tags = (character.tagLinks || []).map((tl: any) => ({
      id: tl.tag.id,
      slug: tl.tag.slug,
      name: tl.tag.name,
      displayName: tl.tag.displayName,
    }));

    const voiceAvailable = Boolean(
      character.currentPublishedVersion?.voiceConfigData ||
      character.voiceSessions?.length > 0 ||
      character.archetype?.includes('voice')
    );

    return {
      id: character.id,
      slug: character.slug,
      name: character.name,
      tagline: character.tagline,
      shortDescription: character.shortDescription || character.tagline,
      avatarUrl: character.avatarUrl,
      coverImageUrl: character.coverImageUrl || character.avatarUrl,
      category: character.category,
      categoryDisplayName: character.categoryRef?.displayName || character.category,
      archetype: character.archetype,
      age: character.age,
      gender: character.gender,
      occupation: character.occupation,
      status: character.status,
      visibility: character.visibility,
      isFeatured: character.isFeatured || (config.editorialPriority > 0),
      isFavorite: options.isFavorite || false,
      accessType: character.accessType || 'free',
      requiredEntitlement: character.requiredEntitlement,
      currentVersionNumber: character.currentVersionNumber,
      tags,
      conversationStarters: (config.conversationStarters as string[]) || [],
      highlightBadges: (config.highlightBadges as string[]) || [],
      voiceAvailable,
      recommendationReason: options.reason || null,
      recommendationReasonCode: options.reasonCode || null,
      updatedAt: character.updatedAt instanceof Date
        ? character.updatedAt.toISOString()
        : (typeof character.updatedAt === 'string' ? character.updatedAt : new Date().toISOString()),
    };
  }


  /**
   * Retrieves all active character categories with character counts.
   */
  public static async getCategories(): Promise<CharacterCategorySummary[]> {
    const cacheKey = 'discovery:categories:all';

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      logger.warn(`[CatalogService] Redis read failure for ${cacheKey}: ${(err as Error).message}`);
    }

    const categories = await prisma.characterCategory.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      include: {
        tags: {
          where: { isCurated: true },
          orderBy: { displayOrder: 'asc' },
        },
        _count: {
          select: {
            characters: {
              where: {
                status: 'PUBLISHED',
                visibility: 'PUBLIC',
                deletedAt: null,
              },
            },
          },
        },
      },
    });

    const result: CharacterCategorySummary[] = categories.map(c => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      displayName: c.displayName,
      description: c.description,
      iconUrl: c.iconUrl,
      coverImageUrl: c.coverImageUrl,
      displayOrder: c.displayOrder,
      isActive: c.isActive,
      isFeatured: c.isFeatured,
      characterCount: c._count.characters,
      tags: c.tags.map(t => ({
        id: t.id,
        slug: t.slug,
        name: t.name,
        displayName: t.displayName,
        description: t.description,
        categoryId: t.categoryId,
        isCurated: t.isCurated,
        displayOrder: t.displayOrder,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));

    try {
      await redis.set(cacheKey, JSON.stringify(result), 'EX', this.CACHE_TTL_SECONDS);
    } catch (err) {
      logger.warn(`[CatalogService] Redis write failure for ${cacheKey}: ${(err as Error).message}`);
    }

    return result;
  }

  /**
   * Retrieves a single category by slug with its characters.
   */
  public static async getCategoryBySlug(
    slug: string,
    userId?: string,
  ): Promise<{ category: CharacterCategorySummary; characters: CharacterCatalogItem[] }> {
    const category = await prisma.characterCategory.findUnique({
      where: { slug },
      include: {
        tags: {
          where: { isCurated: true },
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    if (!category) {
      throw new NotFoundError(`Category '${slug}' not found`);
    }

    const where = CharacterDiscoveryEligibilityService.getPublicEligibilityWhereClause();
    where['OR'] = [
      { categoryId: category.id },
      { category: category.slug },
      { category: { equals: category.name, mode: 'insensitive' } },
    ];

    const characters = await prisma.character.findMany({
      where,
      take: 30,
      orderBy: [{ isFeatured: 'desc' }, { updatedAt: 'desc' }],
      include: {
        categoryRef: true,
        discoveryConfig: true,
        currentPublishedVersion: true,
        tagLinks: {
          include: { tag: true },
        },
      },
    });

    let favoriteSet = new Set<string>();
    if (userId) {
      const favs = await prisma.userFavorite.findMany({
        where: { userId, characterId: { in: characters.map(c => c.id) } },
        select: { characterId: true },
      });
      favoriteSet = new Set(favs.map(f => f.characterId));
    }

    const mappedCharacters = characters.map(c =>
      this.mapToCatalogItem(c, { isFavorite: favoriteSet.has(c.id) }),
    );

    const categorySummary: CharacterCategorySummary = {
      id: category.id,
      slug: category.slug,
      name: category.name,
      displayName: category.displayName,
      description: category.description,
      iconUrl: category.iconUrl,
      coverImageUrl: category.coverImageUrl,
      displayOrder: category.displayOrder,
      isActive: category.isActive,
      isFeatured: category.isFeatured,
      characterCount: characters.length,
      tags: category.tags.map(t => ({
        id: t.id,
        slug: t.slug,
        name: t.name,
        displayName: t.displayName,
        description: t.description,
        categoryId: t.categoryId,
        isCurated: t.isCurated,
        displayOrder: t.displayOrder,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
      createdAt: category.createdAt.toISOString(),
      updatedAt: category.updatedAt.toISOString(),
    };

    return {
      category: categorySummary,
      characters: mappedCharacters,
    };
  }

  /**
   * Retrieves all published curated collections.
   */
  public static async getCollections(userId?: string): Promise<CuratedCollectionSummary[]> {
    const now = new Date();
    const collections = await prisma.curatedCollection.findMany({
      where: {
        isPublished: true,
        OR: [
          { publishStartAt: null },
          { publishStartAt: { lte: now } },
        ],
        AND: [
          {
            OR: [
              { publishEndAt: null },
              { publishEndAt: { gte: now } },
            ],
          },
        ],
      },
      orderBy: { displayOrder: 'asc' },
      include: {
        items: {
          orderBy: { displayOrder: 'asc' },
          include: {
            character: {
              include: {
                categoryRef: true,
                discoveryConfig: true,
                currentPublishedVersion: true,
                tagLinks: {
                  include: { tag: true },
                },
              },
            },
          },
        },
      },
    });

    let favoriteSet = new Set<string>();
    if (userId) {
      const allCharIds = collections.flatMap(c => c.items.map(i => i.characterId));
      if (allCharIds.length > 0) {
        const favs = await prisma.userFavorite.findMany({
          where: { userId, characterId: { in: allCharIds } },
          select: { characterId: true },
        });
        favoriteSet = new Set(favs.map(f => f.characterId));
      }
    }

    return collections.map(col => {
      const eligibleItems = col.items.filter(
        item => item.character && item.character.status === 'PUBLISHED' && !item.character.deletedAt,
      );

      return {
        id: col.id,
        slug: col.slug,
        title: col.title,
        subtitle: col.subtitle,
        description: col.description,
        heroImageUrl: col.heroImageUrl,
        badgeText: col.badgeText,
        displayOrder: col.displayOrder,
        isPublished: col.isPublished,
        publishStartAt: col.publishStartAt?.toISOString() || null,
        publishEndAt: col.publishEndAt?.toISOString() || null,
        itemCount: eligibleItems.length,
        items: eligibleItems.map(i => ({
          id: i.id,
          collectionId: i.collectionId,
          characterId: i.characterId,
          displayOrder: i.displayOrder,
          customBadge: i.customBadge,
          highlightNote: i.highlightNote,
          character: this.mapToCatalogItem(i.character, { isFavorite: favoriteSet.has(i.characterId) }),
        })),
        createdAt: col.createdAt.toISOString(),
        updatedAt: col.updatedAt.toISOString(),
      };
    });
  }

  /**
   * Retrieves single collection by slug.
   */
  public static async getCollectionBySlug(slug: string, userId?: string): Promise<CuratedCollectionSummary> {
    const col = await prisma.curatedCollection.findUnique({
      where: { slug },
      include: {
        items: {
          orderBy: { displayOrder: 'asc' },
          include: {
            character: {
              include: {
                categoryRef: true,
                discoveryConfig: true,
                currentPublishedVersion: true,
                tagLinks: {
                  include: { tag: true },
                },
              },
            },
          },
        },
      },
    });

    if (!col) {
      throw new NotFoundError(`Collection '${slug}' not found`);
    }

    let favoriteSet = new Set<string>();
    if (userId) {
      const charIds = col.items.map(i => i.characterId);
      const favs = await prisma.userFavorite.findMany({
        where: { userId, characterId: { in: charIds } },
        select: { characterId: true },
      });
      favoriteSet = new Set(favs.map(f => f.characterId));
    }

    const eligibleItems = col.items.filter(
      item => item.character && item.character.status === 'PUBLISHED' && !item.character.deletedAt,
    );

    return {
      id: col.id,
      slug: col.slug,
      title: col.title,
      subtitle: col.subtitle,
      description: col.description,
      heroImageUrl: col.heroImageUrl,
      badgeText: col.badgeText,
      displayOrder: col.displayOrder,
      isPublished: col.isPublished,
      publishStartAt: col.publishStartAt?.toISOString() || null,
      publishEndAt: col.publishEndAt?.toISOString() || null,
      itemCount: eligibleItems.length,
      items: eligibleItems.map(i => ({
        id: i.id,
        collectionId: i.collectionId,
        characterId: i.characterId,
        displayOrder: i.displayOrder,
        customBadge: i.customBadge,
        highlightNote: i.highlightNote,
        character: this.mapToCatalogItem(i.character, { isFavorite: favoriteSet.has(i.characterId) }),
      })),
      createdAt: col.createdAt.toISOString(),
      updatedAt: col.updatedAt.toISOString(),
    };
  }

  /**
   * Retrieves a sanitized public detailed profile for a character.
   * STRICTLY strips system prompts, hidden rules, AI provider tokens, and internal memory configs.
   */
  public static async getPublicCharacterProfile(
    slugOrId: string,
    userId?: string,
    userEntitlements: string[] = [],
  ): Promise<PublicCharacterDetailedProfile> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);

    const character = await prisma.character.findFirst({
      where: {
        OR: isUuid ? [{ id: slugOrId }] : [{ slug: slugOrId }],
        status: 'PUBLISHED',
        deletedAt: null,
      },
      include: {
        categoryRef: true,
        discoveryConfig: true,
        currentPublishedVersion: true,
        tagLinks: {
          include: { tag: true },
        },
      },
    });

    if (!character || !character.currentPublishedVersion) {
      throw new NotFoundError('Character not found or is not published');
    }

    const version = character.currentPublishedVersion;
    const personalityData = (version.personalityData as any) || {};
    const communicationData = (version.communicationData as any) || {};
    const languageData = (version.languageData as any) || {};
    const discoveryConfig = character.discoveryConfig || {};

    let isFavorite = false;
    let existingConversationId: string | null = null;

    if (userId) {
      const [fav, conv] = await Promise.all([
        prisma.userFavorite.findUnique({
          where: {
            userId_characterId: {
              userId,
              characterId: character.id,
            },
          },
        }),
        prisma.conversation.findFirst({
          where: {
            userId,
            characterId: character.id,
            status: 'ACTIVE',
          },
          orderBy: { updatedAt: 'desc' },
          select: { id: true },
        }),
      ]);

      isFavorite = Boolean(fav);
      existingConversationId = conv?.id || null;
    }

    // Similar characters (same category or similar archetype)
    const similarRaw = await prisma.character.findMany({
      where: {
        id: { not: character.id },
        category: character.category,
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        deletedAt: null,
      },
      take: 5,
      orderBy: [{ isFeatured: 'desc' }, { updatedAt: 'desc' }],
      include: {
        categoryRef: true,
        discoveryConfig: true,
        currentPublishedVersion: true,
        tagLinks: {
          include: { tag: true },
        },
      },
    });

    const similarCharacters = similarRaw.map(sc => this.mapToCatalogItem(sc));

    const isLockedForUser = CharacterDiscoveryEligibilityService.isCharacterLocked(
      character,
      userEntitlements,
    );

    const voiceAvailable = Boolean(version.voiceConfigData);

    const tags = (character.tagLinks || []).map(tl => ({
      id: tl.tag.id,
      slug: tl.tag.slug,
      name: tl.tag.name,
      displayName: tl.tag.displayName,
    }));

    return {
      id: character.id,
      slug: character.slug,
      name: character.name,
      tagline: character.tagline,
      shortDescription: character.shortDescription || character.tagline,
      longDescription: character.longDescription || character.backstory || character.tagline,
      avatarUrl: character.avatarUrl,
      coverImageUrl: character.coverImageUrl || character.avatarUrl,
      category: character.category,
      categoryDisplayName: character.categoryRef?.displayName || character.category,
      archetype: character.archetype,
      age: character.age,
      gender: character.gender,
      occupation: character.occupation,
      isFeatured: character.isFeatured || Boolean((discoveryConfig as any).editorialPriority > 0),
      isFavorite,
      accessType: (character.accessType as any) || 'free',
      requiredEntitlement: character.requiredEntitlement,
      isLockedForUser,
      tags,
      traits: {
        warmth: personalityData.traits?.warmth ?? 75,
        playfulness: personalityData.traits?.playfulness ?? 70,
        curiosity: personalityData.traits?.curiosity ?? 80,
        sarcasm: personalityData.traits?.sarcasm ?? 25,
        empathy: personalityData.traits?.empathy ?? 80,
        humorStyle: personalityData.humorStyle ?? 'playful',
        quirks: personalityData.customQuirks ?? [],
      },
      communication: {
        pacing: communicationData.pacing ?? 'thoughtful',
        formality: communicationData.formality ?? 'casual',
        primaryLanguage: languageData.primaryLanguage ?? 'en',
      },
      conversationStarters: ((discoveryConfig as any).conversationStarters as string[]) || [
        `Say hello to ${character.name}`,
        `Ask ${character.name} about their day`,
      ],
      highlightBadges: ((discoveryConfig as any).highlightBadges as string[]) || [],
      voiceAvailable,
      voiceSampleUrl: null,
      existingConversationId,
      similarCharacters,
      createdAt: character.createdAt.toISOString(),
    };
  }

  /**
   * Favorites or unfavorites a character for a user.
   */
  public static async toggleFavorite(
    userId: string,
    characterId: string,
    isFavorite: boolean,
  ): Promise<{ characterId: string; isFavorite: boolean }> {
    if (isFavorite) {
      await prisma.userFavorite.upsert({
        where: {
          userId_characterId: {
            userId,
            characterId,
          },
        },
        create: {
          userId,
          characterId,
        },
        update: {},
      });
    } else {
      await prisma.userFavorite.deleteMany({
        where: {
          userId,
          characterId,
        },
      });
    }

    // Invalidate user recommendations cache
    try {
      await redis.del(`recs:user:${userId}:v1`);
    } catch {
      // ignore
    }

    return { characterId, isFavorite };
  }

  /**
   * Lists user's favorited characters.
   */
  public static async listUserFavorites(userId: string): Promise<CharacterCatalogItem[]> {
    const favorites = await prisma.userFavorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        character: {
          include: {
            categoryRef: true,
            discoveryConfig: true,
            currentPublishedVersion: true,
            tagLinks: {
              include: { tag: true },
            },
          },
        },
      },
    });

    return favorites
      .filter(f => f.character && f.character.status === 'PUBLISHED' && !f.character.deletedAt)
      .map(f => this.mapToCatalogItem(f.character, { isFavorite: true }));
  }

  /**
   * Retrieves user discovery preferences or returns default.
   */
  public static async getUserDiscoveryPreferences(userId: string): Promise<UserDiscoveryPreferencesData> {
    const pref = await prisma.userDiscoveryPreference.findUnique({
      where: { userId },
    });

    if (!pref) {
      return {
        userId,
        preferredLanguages: ['en'],
        preferredCategoryIds: [],
        preferredTagIds: [],
        preferredStyles: [],
        personalizationEnabled: true,
        allowNsfw: false,
        updatedAt: new Date().toISOString(),
      };
    }

    return {
      userId: pref.userId,
      preferredLanguages: (pref.preferredLanguages as string[]) || ['en'],
      preferredCategoryIds: (pref.preferredCategoryIds as string[]) || [],
      preferredTagIds: (pref.preferredTagIds as string[]) || [],
      preferredStyles: (pref.preferredStyles as string[]) || [],
      personalizationEnabled: pref.personalizationEnabled,
      allowNsfw: pref.allowNsfw,
      updatedAt: pref.updatedAt.toISOString(),
    };
  }

  /**
   * Updates user discovery preferences.
   */
  public static async updateUserDiscoveryPreferences(
    userId: string,
    data: Partial<UserDiscoveryPreferencesData>,
  ): Promise<UserDiscoveryPreferencesData> {
    const updated = await prisma.userDiscoveryPreference.upsert({
      where: { userId },
      create: {
        userId,
        preferredLanguages: (data.preferredLanguages as any) || ['en'],
        preferredCategoryIds: (data.preferredCategoryIds as any) || [],
        preferredTagIds: (data.preferredTagIds as any) || [],
        preferredStyles: (data.preferredStyles as any) || [],
        personalizationEnabled: data.personalizationEnabled ?? true,
        allowNsfw: data.allowNsfw ?? false,
      },
      update: {
        ...(data.preferredLanguages ? { preferredLanguages: data.preferredLanguages as any } : {}),
        ...(data.preferredCategoryIds ? { preferredCategoryIds: data.preferredCategoryIds as any } : {}),
        ...(data.preferredTagIds ? { preferredTagIds: data.preferredTagIds as any } : {}),
        ...(data.preferredStyles ? { preferredStyles: data.preferredStyles as any } : {}),
        ...(data.personalizationEnabled !== undefined ? { personalizationEnabled: data.personalizationEnabled } : {}),
        ...(data.allowNsfw !== undefined ? { allowNsfw: data.allowNsfw } : {}),
      },
    });

    // Invalidate recommendation cache for user
    try {
      await redis.del(`recs:user:${userId}:v1`);
    } catch {
      // ignore
    }

    return {
      userId: updated.userId,
      preferredLanguages: (updated.preferredLanguages as string[]) || ['en'],
      preferredCategoryIds: (updated.preferredCategoryIds as string[]) || [],
      preferredTagIds: (updated.preferredTagIds as string[]) || [],
      preferredStyles: (updated.preferredStyles as string[]) || [],
      personalizationEnabled: updated.personalizationEnabled,
      allowNsfw: updated.allowNsfw,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * Resets all discovery behavioral signals and recommendation personalization for a user.
   */
  public static async resetPersonalization(userId: string): Promise<void> {
    await Promise.all([
      prisma.userCharacterSignal.deleteMany({ where: { userId } }),
      prisma.userDiscoveryPreference.deleteMany({ where: { userId } }),
      prisma.discoveryEventLog.deleteMany({ where: { userId } }),
    ]);

    try {
      await redis.del(`recs:user:${userId}:v1`);
    } catch {
      // ignore
    }
  }
}
