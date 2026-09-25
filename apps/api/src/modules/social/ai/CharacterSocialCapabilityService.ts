import type { CharacterSocialCapability } from '@prisma/client';
import type { CharacterSocialCapabilities } from '@ai-companion/types';
import type { CharacterSocialCapabilitiesInput } from '@ai-companion/validation';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { AuditService } from '../../audit/audit.service.js';
import { ForbiddenError, NotFoundError } from '../../../shared/errors/AppError.js';
import { SocialPolicyService } from '../policy/SocialPolicyService.js';

/**
 * Character social capabilities: creator-configured, platform-approved, policy-checked, versioned.
 * The *effective* view is always clamped by platform caps, and character-initiated DMs are
 * hard-disabled regardless of what is stored.
 */
export class CharacterSocialCapabilityService {
  public static async resolveOwnedCharacter(creatorUserId: string, slug: string) {
    const character = await prisma.character.findFirst({
      where: { slug, deletedAt: null, creatorProfile: { userId: creatorUserId } },
      select: { id: true, slug: true, creatorProfile: { select: { status: true } } },
    });
    if (!character) throw new NotFoundError('Character not found');
    if (character.creatorProfile?.status !== 'ACTIVE') throw new ForbiddenError('Your creator account is not active.');
    return character;
  }

  public static async getRow(characterId: string): Promise<CharacterSocialCapability> {
    return prisma.characterSocialCapability.upsert({ where: { characterId }, create: { characterId }, update: {} });
  }

  public static async effective(characterId: string, slug: string): Promise<CharacterSocialCapabilities> {
    const row = await this.getRow(characterId);
    const config = await SocialPolicyService.getConfig();
    return {
      characterSlug: slug,
      canPublish: row.canPublish,
      canReply: row.canReply,
      canComment: row.canComment,
      canReact: row.canReact,
      canSendNotifications: row.canSendNotifications,
      canMentionUsers: row.canMentionUsers,
      canMessageUsers: false,
      requiresCreatorApproval: row.requiresCreatorApproval,
      maxPostsPerDay: Math.min(row.maxPostsPerDay, config.aiSocial.maxPostsPerDayPlatformCap),
      maxRepliesPerHour: Math.min(row.maxRepliesPerHour, config.aiSocial.maxRepliesPerHourPlatformCap),
      maxInteractionsPerUserPerDay: row.maxInteractionsPerUserPerDay,
      maxDailyCostCents: row.maxDailyCostCents,
      cooldownSeconds: row.cooldownSeconds,
      platformApproved: row.platformApproved,
      version: row.version,
    };
  }

  /** Creator update. Any change to what the character can do voids platform approval until re-reviewed. */
  public static async updateByCreator(creatorUserId: string, slug: string, patch: CharacterSocialCapabilitiesInput): Promise<CharacterSocialCapabilities> {
    const character = await this.resolveOwnedCharacter(creatorUserId, slug);
    const before = await this.getRow(character.id);
    const expandsScope = (['canPublish', 'canReply', 'canComment', 'canReact', 'canSendNotifications', 'canMentionUsers'] as const).some(
      (k) => patch[k] === true && !before[k],
    );
    const after = await prisma.characterSocialCapability.update({
      where: { characterId: character.id },
      data: {
        ...patch,
        version: { increment: 1 },
        updatedByUserId: creatorUserId,
        ...(expandsScope ? { platformApproved: false, platformApprovedAt: null, platformApprovedByAdminId: null } : {}),
      },
    });
    await AuditService.log({
      actorType: 'USER',
      actorId: creatorUserId,
      action: 'CHARACTER_SOCIAL_CAPABILITIES_UPDATED',
      resourceType: 'character_social_capability',
      resourceId: character.id,
      metadata: { before: this.snapshot(before), after: this.snapshot(after), platformApprovalReset: expandsScope },
    });
    return this.effective(character.id, character.slug);
  }

  public static async setPlatformApproval(adminId: string, slug: string, approved: boolean, reason: string): Promise<CharacterSocialCapabilities> {
    const character = await prisma.character.findFirst({ where: { slug, deletedAt: null }, select: { id: true, slug: true } });
    if (!character) throw new NotFoundError('Character not found');
    const before = await this.getRow(character.id);
    const after = await prisma.characterSocialCapability.update({
      where: { characterId: character.id },
      data: { platformApproved: approved, platformApprovedByAdminId: adminId, platformApprovedAt: new Date(), version: { increment: 1 } },
    });
    await AuditService.log({
      actorType: 'ADMIN',
      actorId: adminId,
      action: approved ? 'CHARACTER_SOCIAL_APPROVED' : 'CHARACTER_SOCIAL_APPROVAL_REVOKED',
      resourceType: 'character_social_capability',
      resourceId: character.id,
      metadata: { reason, before: this.snapshot(before), after: this.snapshot(after) },
    });
    return this.effective(character.id, character.slug);
  }

  private static snapshot(r: CharacterSocialCapability): Record<string, unknown> {
    const { createdAt: _c, updatedAt: _u, ...rest } = r;
    return rest;
  }
}
