import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../config/logger.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { ErrorCode } from '@ai-companion/config';
import { RESERVED_USERNAMES } from '@ai-companion/validation';
import type {
  CreatorProfileUpdateInput,
} from '@ai-companion/validation';
import type {
  CreatorProfileData,
  CreatorPublicProfile,
} from '@ai-companion/types';

export class CreatorProfileService {
  /**
   * Onboards an existing authenticated user as a creator.
   */
  public static async onboardCreator(
    userId: string,
    input: any,
  ): Promise<any> {
    if (input.acceptGuidelines === false) {
      throw new AppError('You must review and accept the creator content guidelines', 400, ErrorCode.VALIDATION_ERROR);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      include: { creatorProfile: true },
    });

    if (!user) {
      throw new AppError('User not found', 404, ErrorCode.NOT_FOUND);
    }

    if (user.creatorProfile) {
      throw new AppError('User is already registered as a creator', 409, ErrorCode.CONFLICT);
    }

    const normalizedUsername = (input.username || '').toLowerCase().trim();

    if (RESERVED_USERNAMES.has(normalizedUsername)) {
      throw new AppError('This username is reserved and cannot be claimed', 400, ErrorCode.VALIDATION_ERROR);
    }

    // Check username uniqueness
    const existing = await prisma.creatorProfile.findUnique({
      where: { username: normalizedUsername },
    });

    if (existing) {
      throw new AppError('Username is already taken', 409, ErrorCode.CONFLICT);
    }

    const profile = await prisma.creatorProfile.create({
      data: {
        userId,
        displayName: input.displayName.trim(),
        username: normalizedUsername,
        bio: input.bio || '',
        status: 'ACTIVE',
        verificationStatus: 'UNVERIFIED',
        acceptedGuidelinesVersion: typeof input.guidelinesVersion === 'string' ? (parseInt(input.guidelinesVersion, 10) || 1) : (input.guidelinesVersion || 1),
        guidelinesAcceptedAt: new Date(),
      },
    });

    logger.info(`Creator profile created for user ${userId} with username @${normalizedUsername}`);

    return this.formatProfileData(profile, input.guidelinesVersion);
  }

  /**
   * Retrieves the current user's creator profile.
   */
  public static async getMyProfile(userId: string): Promise<CreatorProfileData> {
    const profile = await prisma.creatorProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new AppError('Creator profile not found for this user', 404, ErrorCode.NOT_FOUND);
    }

    return this.formatProfileData(profile);
  }

  /**
   * Updates the current user's creator profile.
   */
  public static async updateMyProfile(
    userId: string,
    input: CreatorProfileUpdateInput,
  ): Promise<CreatorProfileData> {
    const profile = await prisma.creatorProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new AppError('Creator profile not found for this user', 404, ErrorCode.NOT_FOUND);
    }

    const updated = await prisma.creatorProfile.update({
      where: { userId },
      data: {
        ...(input.displayName && { displayName: input.displayName.trim() }),
        ...(input.bio !== undefined && { bio: input.bio }),
        ...(input.avatarUrl !== undefined && { avatarUrl: input.avatarUrl }),
        ...(input.bannerUrl !== undefined && { bannerUrl: input.bannerUrl }),
        ...(input.website !== undefined && { website: input.website }),
        ...(input.socialLinks !== undefined && { socialLinks: (input.socialLinks as any) || null }),
      },
    });

    return this.formatProfileData(updated);
  }

  /**
   * Alias for updating profile
   */
  public static async updateProfile(
    userId: string,
    input: CreatorProfileUpdateInput,
  ): Promise<CreatorProfileData> {
    return this.updateMyProfile(userId, input);
  }

  /**
   * Retrieves public creator profile and their published characters.
   */
  public static async getPublicProfile(
    username: string,
    currentUserId?: string,
  ): Promise<CreatorPublicProfile> {
    const normalizedUsername = username.toLowerCase().trim();

    const profile = await prisma.creatorProfile.findUnique({
      where: { username: normalizedUsername },
      include: {
        characters: {
          where: {
            status: 'PUBLISHED',
            deletedAt: null,
          },
          select: {
            id: true,
            slug: true,
            name: true,
            tagline: true,
            avatarUrl: true,
            category: true,
            isFeatured: true,
          },
          take: 50,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!profile || profile.status === 'SUSPENDED' || profile.status === 'BANNED') {
      throw new AppError('Creator profile not found or unavailable', 404, ErrorCode.NOT_FOUND);
    }

    let isFollowing = false;
    if (currentUserId) {
      const follow = await prisma.creatorFollow.findUnique({
        where: {
          userId_creatorProfileId: {
            userId: currentUserId,
            creatorProfileId: profile.id,
          },
        },
      });
      isFollowing = !!follow;
    }

    const characters = (profile.characters || []).map((c: any) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      tagline: c.tagline,
      avatarUrl: c.avatarUrl || '',
      category: c.category,
      isFeatured: c.isFeatured,
    }));

    return {
      id: profile.id,
      displayName: profile.displayName,
      username: profile.username,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl,
      bannerUrl: profile.bannerUrl,
      website: profile.website,
      socialLinks: (profile.socialLinks as Record<string, string>) || null,
      verificationStatus: profile.verificationStatus as any,
      totalCharactersCount: profile.totalCharactersCount,
      publishedCharactersCount: profile.characters?.length || 0,
      totalFollowersCount: profile.totalFollowersCount,
      isFollowing,
      publishedCharacters: characters,
      createdAt: profile.createdAt.toISOString(),
    };
  }

  /**
   * Alias for public profile by username
   */
  public static async getPublicProfileByUsername(
    username: string,
    currentUserId?: string,
  ): Promise<CreatorPublicProfile> {
    return this.getPublicProfile(username, currentUserId);
  }

  /**
   * Toggles following/unfollowing a creator.
   */
  public static async toggleFollow(
    arg1: string,
    arg2: string,
    follow?: boolean,
  ): Promise<{ isFollowing: boolean; totalFollowers: number }> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let username = arg1;
    let userId = arg2;
    if (uuidRegex.test(arg1) && !uuidRegex.test(arg2)) {
      userId = arg1;
      username = arg2;
    } else if (!uuidRegex.test(arg1) && uuidRegex.test(arg2)) {
      username = arg1;
      userId = arg2;
    }

    const normalizedUsername = username.toLowerCase().trim();
    const profile = await prisma.creatorProfile.findUnique({
      where: { username: normalizedUsername },
    });

    if (!profile) {
      throw new AppError('Creator not found', 404, ErrorCode.NOT_FOUND);
    }

    if (profile.userId === userId) {
      throw new AppError('Cannot follow your own creator profile', 400, ErrorCode.VALIDATION_ERROR);
    }

    const existingFollow = await prisma.creatorFollow.findUnique({
      where: {
        userId_creatorProfileId: {
          userId,
          creatorProfileId: profile.id,
        },
      },
    });

    const shouldFollow = follow !== undefined ? follow : !existingFollow;

    if (shouldFollow) {
      await prisma.creatorFollow.upsert({
        where: {
          userId_creatorProfileId: {
            userId,
            creatorProfileId: profile.id,
          },
        },
        create: {
          userId,
          creatorProfileId: profile.id,
        },
        update: {},
      });
    } else {
      await prisma.creatorFollow.deleteMany({
        where: {
          userId,
          creatorProfileId: profile.id,
        },
      });
    }

    const count = await prisma.creatorFollow.count({
      where: { creatorProfileId: profile.id },
    });

    await prisma.creatorProfile.update({
      where: { id: profile.id },
      data: { totalFollowersCount: count },
    });

    return { isFollowing: shouldFollow, totalFollowers: count };
  }

  private static formatProfileData(profile: any, originalVersion?: string): any {
    return {
      id: profile.id,
      userId: profile.userId,
      displayName: profile.displayName,
      username: profile.username,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl,
      bannerUrl: profile.bannerUrl,
      website: profile.website,
      socialLinks: (profile.socialLinks as Record<string, string>) || null,
      status: profile.status,
      verificationStatus: profile.verificationStatus,
      acceptedGuidelinesVersion: originalVersion || String(profile.acceptedGuidelinesVersion || '2026.1'),
      acceptedGuidelinesAt: profile.guidelinesAcceptedAt ? profile.guidelinesAcceptedAt.toISOString() : new Date().toISOString(),
      guidelinesAcceptedAt: profile.guidelinesAcceptedAt ? profile.guidelinesAcceptedAt.toISOString() : new Date().toISOString(),
      totalCharactersCount: profile.totalCharactersCount,
      publishedCharactersCount: profile.publishedCharactersCount,
      totalFollowersCount: profile.totalFollowersCount,
      totalConversationsCount: profile.totalConversationsCount,
      totalMessagesCount: profile.totalMessagesCount,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }
}
