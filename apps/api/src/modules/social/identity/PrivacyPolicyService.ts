import type { SocialAudience, SocialPrivacySettings } from '@prisma/client';
import type { SocialPrivacySettingsDto } from '@ai-companion/types';
import type { UpdateSocialPrivacyInput } from '@ai-companion/validation';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { AuditService } from '../../audit/audit.service.js';

/** Relationship of a viewer to the owner of a setting. */
export interface AudienceRelation {
  isSelf: boolean;
  /** Viewer has an ACTIVE follow of the owner. */
  viewerFollowsOwner: boolean;
  /** Owner has an ACTIVE follow of the viewer. */
  ownerFollowsViewer: boolean;
}

/**
 * Per-feature privacy. There is intentionally no single "private account" switch: each surface
 * (profile, follow lists, creations, shares, activity, messages, mentions, comments, invites,
 * discoverability) is evaluated independently by `SocialAccessService`.
 */
export class PrivacyPolicyService {
  public static async get(userId: string): Promise<SocialPrivacySettings> {
    return prisma.socialPrivacySettings.upsert({ where: { userId }, create: { userId }, update: {} });
  }

  public static async getMany(userIds: string[]): Promise<Map<string, SocialPrivacySettings>> {
    const unique = [...new Set(userIds)];
    const rows = await prisma.socialPrivacySettings.findMany({ where: { userId: { in: unique } } });
    const map = new Map(rows.map((r) => [r.userId, r]));
    // Missing rows = defaults (privacy-first); materialize without writes for batch reads.
    for (const id of unique) {
      if (!map.has(id)) map.set(id, this.defaults(id));
    }
    return map;
  }

  public static defaults(userId: string): SocialPrivacySettings {
    const now = new Date();
    return {
      userId,
      profileVisibility: 'LIMITED',
      followPolicy: 'EVERYONE',
      followListAudience: 'NOBODY',
      creationsAudience: 'EVERYONE',
      sharedContentAudience: 'EVERYONE',
      activityAudience: 'NOBODY',
      communitiesAudience: 'NOBODY',
      showOnlineStatus: false,
      whoCanMessage: 'MUTUALS',
      whoCanMention: 'FOLLOWERS',
      whoCanComment: 'EVERYONE',
      whoCanInviteToCommunities: 'MUTUALS',
      discoverable: false,
      searchable: true,
      socialRecommendations: true,
      characterSocialInteractions: false,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
  }

  public static async update(userId: string, patch: UpdateSocialPrivacyInput): Promise<SocialPrivacySettings> {
    await this.get(userId);
    const updated = await prisma.socialPrivacySettings.update({
      where: { userId },
      data: { ...patch, version: { increment: 1 } },
    });
    await AuditService.log({
      actorType: 'USER',
      actorId: userId,
      action: 'SOCIAL_PRIVACY_UPDATED',
      resourceType: 'social_privacy_settings',
      resourceId: userId,
      metadata: { changed: Object.keys(patch), version: updated.version },
    });
    return updated;
  }

  public static audienceAllows(audience: SocialAudience, rel: AudienceRelation): boolean {
    if (rel.isSelf) return true;
    switch (audience) {
      case 'EVERYONE':
        return true;
      case 'FOLLOWERS':
        return rel.viewerFollowsOwner;
      case 'MUTUALS':
        return rel.viewerFollowsOwner && rel.ownerFollowsViewer;
      case 'NOBODY':
      default:
        return false;
    }
  }

  public static toDto(s: SocialPrivacySettings): SocialPrivacySettingsDto {
    return {
      profileVisibility: s.profileVisibility,
      followPolicy: s.followPolicy,
      followListAudience: s.followListAudience,
      creationsAudience: s.creationsAudience,
      sharedContentAudience: s.sharedContentAudience,
      activityAudience: s.activityAudience,
      communitiesAudience: s.communitiesAudience,
      showOnlineStatus: s.showOnlineStatus,
      whoCanMessage: s.whoCanMessage,
      whoCanMention: s.whoCanMention,
      whoCanComment: s.whoCanComment,
      whoCanInviteToCommunities: s.whoCanInviteToCommunities,
      discoverable: s.discoverable,
      searchable: s.searchable,
      socialRecommendations: s.socialRecommendations,
      characterSocialInteractions: s.characterSocialInteractions,
      version: s.version,
      updatedAt: s.updatedAt.toISOString(),
    };
  }
}
