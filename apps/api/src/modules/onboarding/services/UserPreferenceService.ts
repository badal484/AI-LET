import { prisma } from '../../../infrastructure/database/prisma.js';
import { redis } from '../../../infrastructure/redis/redis.js';
import { logger } from '../../../config/logger.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { ErrorCode } from '@ai-companion/config';
import { AuditService } from '../../audit/audit.service.js';
import type { UserPreferenceProfile, ConversationStyle } from '@ai-companion/types';
import type { UserPreferenceUpdateInput } from '@ai-companion/validation';

export class UserPreferenceService {
  /**
   * Retrieves the combined effective preference profile for a user.
   */
  public static async getEffectivePreferences(userId: string): Promise<UserPreferenceProfile> {
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new AppError('User profile not found', 404, ErrorCode.NOT_FOUND);
    }

    const discoveryPref = await prisma.userDiscoveryPreference.findUnique({
      where: { userId },
    });

    return {
      displayName: profile.displayName,
      username: profile.username,
      avatarUrl: profile.avatarUrl,
      bio: profile.bio,
      locale: profile.locale,
      timezone: profile.timezone,
      preferredLanguage: profile.preferredLanguage,
      conversationStyle: (profile.conversationStyle as ConversationStyle) || 'CASUAL',
      preferredCategoryIds: (discoveryPref?.preferredCategoryIds as string[]) || [],
      preferredTagIds: (discoveryPref?.preferredTagIds as string[]) || [],
      personalizationEnabled: discoveryPref?.personalizationEnabled ?? true,
      isNsfwAllowed: profile.isNsfwAllowed,
      audioAutoPlay: profile.audioAutoPlay,
    };
  }

  /**
   * Updates explicit user preferences and invalidates discovery recommendation cache.
   */
  public static async updatePreferences(
    userId: string,
    input: UserPreferenceUpdateInput,
  ): Promise<UserPreferenceProfile> {
    // 1. Update UserProfile fields
    const updatedProfile = await prisma.userProfile.update({
      where: { userId },
      data: {
        ...(input.preferredLanguage && { preferredLanguage: input.preferredLanguage }),
        ...(input.conversationStyle && { conversationStyle: input.conversationStyle }),
        ...(input.isNsfwAllowed !== undefined && { isNsfwAllowed: input.isNsfwAllowed }),
        ...(input.audioAutoPlay !== undefined && { audioAutoPlay: input.audioAutoPlay }),
      },
    });

    // 2. Upsert UserDiscoveryPreference fields
    const updatedDiscoveryPref = await prisma.userDiscoveryPreference.upsert({
      where: { userId },
      create: {
        userId,
        preferredLanguages: input.preferredLanguage ? [input.preferredLanguage] : ['en'],
        preferredCategoryIds: input.preferredCategoryIds || [],
        preferredTagIds: input.preferredTagIds || [],
        preferredStyles: input.conversationStyle ? [input.conversationStyle] : ['CASUAL'],
        personalizationEnabled: input.personalizationEnabled ?? true,
        allowNsfw: input.isNsfwAllowed ?? false,
      },
      update: {
        ...(input.preferredLanguage && { preferredLanguages: [input.preferredLanguage] }),
        ...(input.preferredCategoryIds && { preferredCategoryIds: input.preferredCategoryIds }),
        ...(input.preferredTagIds && { preferredTagIds: input.preferredTagIds }),
        ...(input.conversationStyle && { preferredStyles: [input.conversationStyle] }),
        ...(input.personalizationEnabled !== undefined && {
          personalizationEnabled: input.personalizationEnabled,
        }),
        ...(input.isNsfwAllowed !== undefined && { allowNsfw: input.isNsfwAllowed }),
      },
    });

    // 3. Invalidate Redis recommendation cache
    await this.invalidateUserRecommendationCache(userId);

    // 4. Audit Log
    await AuditService.logEvent({
      actorType: 'USER',
      actorId: userId,
      action: 'PREFERENCES_UPDATED',
      resourceType: 'UserProfile',
      resourceId: updatedProfile.id,
      metadata: { changedFields: Object.keys(input) },
    });

    return {
      displayName: updatedProfile.displayName,
      username: updatedProfile.username,
      avatarUrl: updatedProfile.avatarUrl,
      bio: updatedProfile.bio,
      locale: updatedProfile.locale,
      timezone: updatedProfile.timezone,
      preferredLanguage: updatedProfile.preferredLanguage,
      conversationStyle: (updatedProfile.conversationStyle as ConversationStyle) || 'CASUAL',
      preferredCategoryIds: (updatedDiscoveryPref.preferredCategoryIds as string[]) || [],
      preferredTagIds: (updatedDiscoveryPref.preferredTagIds as string[]) || [],
      personalizationEnabled: updatedDiscoveryPref.personalizationEnabled,
      isNsfwAllowed: updatedProfile.isNsfwAllowed,
      audioAutoPlay: updatedProfile.audioAutoPlay,
    };
  }

  /**
   * Resets explicit user preferences to defaults without affecting conversations or memory.
   */
  public static async resetPreferences(userId: string): Promise<UserPreferenceProfile> {
    const updatedProfile = await prisma.userProfile.update({
      where: { userId },
      data: {
        preferredLanguage: 'en',
        conversationStyle: 'CASUAL',
      },
    });

    await prisma.userDiscoveryPreference.upsert({
      where: { userId },
      create: {
        userId,
        preferredLanguages: ['en'],
        preferredCategoryIds: [],
        preferredTagIds: [],
        preferredStyles: ['CASUAL'],
        personalizationEnabled: true,
      },
      update: {
        preferredLanguages: ['en'],
        preferredCategoryIds: [],
        preferredTagIds: [],
        preferredStyles: ['CASUAL'],
        personalizationEnabled: true,
      },
    });

    await this.invalidateUserRecommendationCache(userId);

    await AuditService.logEvent({
      actorType: 'USER',
      actorId: userId,
      action: 'PREFERENCES_RESET',
      resourceType: 'UserProfile',
      resourceId: updatedProfile.id,
    });

    return {
      displayName: updatedProfile.displayName,
      username: updatedProfile.username,
      avatarUrl: updatedProfile.avatarUrl,
      bio: updatedProfile.bio,
      locale: updatedProfile.locale,
      timezone: updatedProfile.timezone,
      preferredLanguage: updatedProfile.preferredLanguage,
      conversationStyle: 'CASUAL',
      preferredCategoryIds: [],
      preferredTagIds: [],
      personalizationEnabled: true,
      isNsfwAllowed: updatedProfile.isNsfwAllowed,
      audioAutoPlay: updatedProfile.audioAutoPlay,
    };
  }

  /**
   * Invalidates cached discovery recommendations for user.
   */
  private static async invalidateUserRecommendationCache(userId: string): Promise<void> {
    try {
      const pattern = `recommendations:user:${userId}:*`;
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (err) {
      logger.warn(`Failed to invalidate recommendation cache for user ${userId}`, { error: err });
    }
  }
}
