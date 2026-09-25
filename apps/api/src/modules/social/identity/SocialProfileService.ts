import { Prisma } from '@prisma/client';
import { ErrorCode } from '@ai-companion/config';
import type { SocialMyProfile, SocialProfileView, SocialUserCard, SocialViewerRelationship } from '@ai-companion/types';
import type { CreateSocialProfileInput, UpdateSocialProfileInput } from '@ai-companion/validation';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { AuditService } from '../../audit/audit.service.js';
import { AppError, BadRequestError, ConflictError, NotFoundError } from '../../../shared/errors/AppError.js';
import { generatePublicId } from '../shared/ids.js';
import { UsernameService } from './UsernameService.js';
import { PrivacyPolicyService } from './PrivacyPolicyService.js';
import { SocialAccessService } from '../access/SocialAccessService.js';
import { RelationshipReader, type PairRelationship } from '../graph/RelationshipReader.js';
import { SocialContentSafetyService } from '../safety/SocialContentSafetyService.js';
import { SocialPolicyService } from '../policy/SocialPolicyService.js';
import { SocialEvents } from '../shared/SocialEvents.js';

const NOT_FOUND = () => new NotFoundError('Profile not found', ErrorCode.SOCIAL_USER_NOT_FOUND);

export interface ResolvedSocialUser {
  userId: string;
  publicId: string;
  username: string | null;
}

export class SocialProfileService {
  // ---------------------------------------------------------------------------
  // Resolution (public handle → internal id). Internal ids never leave the server.
  // ---------------------------------------------------------------------------

  /** Accepts a publicId or a username (with or without @). Deleted/hidden users resolve to null. */
  public static async resolve(handle: string): Promise<ResolvedSocialUser | null> {
    const trimmed = handle.trim();
    const normalized = UsernameService.normalize(trimmed);
    const row = await prisma.socialProfile.findFirst({
      where: {
        OR: [{ publicId: trimmed }, { username: normalized }],
        status: { not: 'HIDDEN' },
        user: { deletedAt: null, status: { notIn: ['DELETED'] } },
      },
      select: { userId: true, publicId: true, username: true },
    });
    return row;
  }

  public static async resolveOrThrow(handle: string): Promise<ResolvedSocialUser> {
    const r = await this.resolve(handle);
    if (!r) throw NOT_FOUND();
    return r;
  }

  public static async requireOwnProfile(userId: string) {
    const p = await prisma.socialProfile.findUnique({ where: { userId } });
    if (!p) throw new AppError('Set up your social profile first.', 403, ErrorCode.SOCIAL_PROFILE_REQUIRED);
    return p;
  }

  // ---------------------------------------------------------------------------
  // Cards (batch) — the only public representation of a person.
  // ---------------------------------------------------------------------------

  public static async cards(userIds: Array<string | null | undefined>): Promise<Map<string, SocialUserCard>> {
    const ids = [...new Set(userIds.filter((x): x is string => !!x))];
    if (ids.length === 0) return new Map();
    const [profiles, creators] = await Promise.all([
      prisma.socialProfile.findMany({
        where: { userId: { in: ids }, user: { deletedAt: null } },
        select: { userId: true, publicId: true, username: true, displayName: true, avatarUrl: true, status: true },
      }),
      prisma.creatorProfile.findMany({
        where: { userId: { in: ids }, status: 'ACTIVE' },
        select: { userId: true, verificationStatus: true },
      }),
    ]);
    const creatorMap = new Map(creators.map((c) => [c.userId, c]));
    const out = new Map<string, SocialUserCard>();
    for (const p of profiles) {
      if (p.status === 'HIDDEN') continue;
      const c = creatorMap.get(p.userId);
      out.set(p.userId, {
        publicId: p.publicId,
        username: p.username,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl,
        isCreator: !!c,
        isVerified: !!c && c.verificationStatus !== 'UNVERIFIED',
      });
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Own profile
  // ---------------------------------------------------------------------------

  public static async create(userId: string, input: CreateSocialProfileInput): Promise<SocialMyProfile> {
    await SocialPolicyService.assertFeature('social_identity', { userId });
    const existing = await prisma.socialProfile.findUnique({ where: { userId }, select: { id: true } });
    if (existing) throw new ConflictError('You already have a social profile.');

    this.assertSafeProfileText(input.displayName, 'display name');
    if (input.bio) this.assertSafeProfileText(input.bio, 'bio');

    // A creator keeps their creator handle unless they choose otherwise; verified names are protected.
    const creator = await prisma.creatorProfile.findUnique({ where: { userId }, select: { username: true, verificationStatus: true, avatarUrl: true } });
    if (creator && creator.verificationStatus !== 'UNVERIFIED') await UsernameService.protectVerifiedCreator(userId, creator.username);

    try {
      await prisma.$transaction(async (tx) => {
        const claimed = await UsernameService.claimInTx(tx, userId, input.username, { isInitial: true });
        await tx.socialProfile.create({
          data: {
            userId,
            publicId: generatePublicId(),
            username: claimed.username,
            usernameCanonical: claimed.canonical,
            displayName: input.displayName,
            bio: input.bio ?? null,
            pronouns: input.pronouns ?? null,
            avatarUrl: creator?.avatarUrl ?? null,
          },
        });
        await tx.socialPrivacySettings.upsert({ where: { userId }, create: { userId }, update: {} });
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError('That username is taken.', ErrorCode.SOCIAL_USERNAME_TAKEN);
      }
      throw err;
    }

    await AuditService.log({ actorType: 'USER', actorId: userId, action: 'SOCIAL_PROFILE_CREATED', resourceType: 'social_profile', resourceId: userId });
    SocialEvents.emit('SocialProfileCreated', { actorUserId: userId });
    return this.getMine(userId);
  }

  public static async getMine(userId: string): Promise<SocialMyProfile> {
    const p = await this.requireOwnProfile(userId);
    const [settings, cards] = await Promise.all([PrivacyPolicyService.get(userId), this.cards([userId])]);
    const config = await SocialPolicyService.getConfig();
    const card = cards.get(userId);
    return {
      publicId: p.publicId,
      username: p.username,
      displayName: p.displayName,
      avatarUrl: p.avatarUrl,
      isCreator: card?.isCreator ?? false,
      isVerified: card?.isVerified ?? false,
      bio: p.bio,
      pronouns: p.pronouns,
      visibility: settings.profileVisibility,
      isFullView: true,
      followersCount: p.followersCount,
      followingCount: p.followingCount,
      joinedAt: p.createdAt.toISOString(),
      relationship: null,
      usernameChangeAvailableAt: p.usernameChangedAt
        ? new Date(p.usernameChangedAt.getTime() + config.username.changeCooldownDays * 86_400_000).toISOString()
        : null,
      privacy: PrivacyPolicyService.toDto(settings),
    };
  }

  public static async update(userId: string, patch: UpdateSocialProfileInput): Promise<SocialMyProfile> {
    await this.requireOwnProfile(userId);
    if (patch.displayName) this.assertSafeProfileText(patch.displayName, 'display name');
    if (patch.bio) this.assertSafeProfileText(patch.bio, 'bio');
    await prisma.socialProfile.update({ where: { userId }, data: patch });
    await AuditService.log({ actorType: 'USER', actorId: userId, action: 'SOCIAL_PROFILE_UPDATED', resourceType: 'social_profile', resourceId: userId, metadata: { fields: Object.keys(patch) } });
    return this.getMine(userId);
  }

  /** Profile text is shown publicly and cannot be "pending", so anything not clearly safe is rejected. */
  private static assertSafeProfileText(text: string, field: string): void {
    const evaluation = SocialContentSafetyService.evaluateText(text, { surface: 'PROFILE', maxLinks: 1 });
    if (evaluation.decision.action === 'BLOCK' || evaluation.decision.action === 'REQUIRE_MODERATION' || evaluation.piiFindings.length > 0) {
      throw new BadRequestError(`Please revise your ${field}. ${evaluation.decision.userMessage ?? 'It may contain personal details or content that breaks our guidelines.'}`.trim());
    }
    const lowered = text.toLowerCase();
    if (/\b(official|verified|moderator|admin|staff|support team)\b/.test(lowered)) {
      throw new BadRequestError(`Your ${field} can't imply you are staff or verified.`);
    }
  }

  // ---------------------------------------------------------------------------
  // Public view
  // ---------------------------------------------------------------------------

  public static async getView(viewerId: string | null, handle: string): Promise<SocialProfileView> {
    const target = await this.resolveOrThrow(handle);
    const rel: PairRelationship | undefined = viewerId ? await RelationshipReader.between(viewerId, target.userId) : undefined;
    const access = await SocialAccessService.profileAccess(viewerId, target.userId, rel);
    // Blocked / hidden → indistinguishable from "does not exist" (no enumeration, no block inference).
    if (!access.exists) throw NOT_FOUND();

    const [p, settings, cards] = await Promise.all([
      prisma.socialProfile.findUniqueOrThrow({ where: { userId: target.userId } }),
      PrivacyPolicyService.get(target.userId),
      this.cards([target.userId]),
    ]);
    const card = cards.get(target.userId);
    if (!card) throw NOT_FOUND();

    let relationship: SocialViewerRelationship | null = null;
    if (viewerId && rel) {
      const [message, mention] = rel.isSelf
        ? [{ allowed: false }, { allowed: true }]
        : await Promise.all([SocialAccessService.canStartConversation(viewerId, target.userId), SocialAccessService.canMention(viewerId, target.userId, settings)]);
      relationship = {
        isSelf: rel.isSelf,
        following: rel.viewerFollows,
        followedBy: rel.targetFollows === 'ACTIVE',
        isMutual: rel.viewerFollows === 'ACTIVE' && rel.targetFollows === 'ACTIVE',
        isMuted: rel.viewerMutedScopes.length > 0,
        hasBlocked: rel.viewerBlockedTarget,
        canMessage: message.allowed,
        canMention: mention.allowed,
      };
    }

    const countsVisible = access.full;
    return {
      ...card,
      bio: access.full ? p.bio : null,
      pronouns: access.full ? p.pronouns : null,
      visibility: settings.profileVisibility,
      isFullView: access.full,
      followersCount: countsVisible ? p.followersCount : null,
      followingCount: countsVisible ? p.followingCount : null,
      joinedAt: access.full ? p.createdAt.toISOString() : null,
      relationship,
    };
  }
}
