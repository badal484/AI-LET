import type { SocialContent, SocialPrivacySettings } from '@prisma/client';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { PrivacyPolicyService, type AudienceRelation } from '../identity/PrivacyPolicyService.js';
import { RelationshipReader, isBlockedEitherWay, type PairRelationship } from '../graph/RelationshipReader.js';
import { SocialConsentService } from '../consent/SocialConsentService.js';

export interface AccessDecision {
  allowed: boolean;
  /** Internal reason code for audit/simulator. */
  reason: string;
  /** Safe message for the actor. Deliberately vague where precision would leak privacy (e.g. blocks). */
  userMessage?: string;
}

export interface ProfileAccess {
  /** False = behave as if the profile does not exist (blocked / deleted / hidden). */
  exists: boolean;
  /** True = full profile; false = minimal public card only. */
  full: boolean;
  reason: string;
}

const allow = (reason = 'OK'): AccessDecision => ({ allowed: true, reason });
const deny = (reason: string, userMessage: string): AccessDecision => ({ allowed: false, reason, userMessage });

/** Generic message for block-based denials so the blocked party can't infer the block. */
const UNAVAILABLE = "This isn't available.";

function audienceRel(rel: PairRelationship): AudienceRelation {
  return {
    isSelf: rel.isSelf,
    viewerFollowsOwner: rel.viewerFollows === 'ACTIVE',
    ownerFollowsViewer: rel.targetFollows === 'ACTIVE',
  };
}

/**
 * The ONLY place social access rules live. Controllers and services must call these methods rather
 * than re-implementing checks, so no endpoint can become a bypass for blocking or privacy.
 */
export class SocialAccessService {
  private static async activeProfileOwner(userId: string): Promise<{ status: string } | null> {
    const row = await prisma.socialProfile.findFirst({
      where: { userId, user: { deletedAt: null, status: { not: 'DELETED' } } },
      select: { status: true },
    });
    return row;
  }

  // ---------------------------------------------------------------------------
  // Profiles & graph visibility
  // ---------------------------------------------------------------------------

  public static async profileAccess(viewerId: string | null, ownerId: string, rel?: PairRelationship): Promise<ProfileAccess> {
    const owner = await this.activeProfileOwner(ownerId);
    if (!owner || owner.status === 'HIDDEN') return { exists: false, full: false, reason: 'NO_PROFILE' };
    if (viewerId === ownerId) return { exists: true, full: true, reason: 'SELF' };
    if (!viewerId) {
      const s = await PrivacyPolicyService.get(ownerId);
      return { exists: true, full: s.profileVisibility === 'PUBLIC', reason: 'ANONYMOUS' };
    }
    const r = rel ?? (await RelationshipReader.between(viewerId, ownerId));
    if (isBlockedEitherWay(r)) return { exists: false, full: false, reason: 'BLOCKED' };
    const s = await PrivacyPolicyService.get(ownerId);
    if (s.profileVisibility === 'PUBLIC') return { exists: true, full: true, reason: 'PUBLIC' };
    const follower = r.viewerFollows === 'ACTIVE';
    return { exists: true, full: follower, reason: follower ? 'FOLLOWER' : `${s.profileVisibility}_CARD_ONLY` };
  }

  public static async canView(viewerId: string | null, ownerId: string): Promise<AccessDecision> {
    const a = await this.profileAccess(viewerId, ownerId);
    return a.exists ? allow(a.reason) : deny(a.reason, UNAVAILABLE);
  }

  public static async canViewFollowList(viewerId: string | null, ownerId: string): Promise<AccessDecision> {
    const access = await this.profileAccess(viewerId, ownerId);
    if (!access.exists || !access.full) return deny('PROFILE_NOT_VISIBLE', UNAVAILABLE);
    if (viewerId === ownerId) return allow('SELF');
    const s = await PrivacyPolicyService.get(ownerId);
    if (!viewerId) return s.followListAudience === 'EVERYONE' ? allow() : deny('FOLLOW_LIST_PRIVATE', 'This list is private.');
    const r = await RelationshipReader.between(viewerId, ownerId);
    return PrivacyPolicyService.audienceAllows(s.followListAudience, audienceRel(r)) ? allow() : deny('FOLLOW_LIST_PRIVATE', 'This list is private.');
  }

  /** `requiresApproval` = follow becomes a PENDING request. */
  public static async canFollow(followerId: string, targetId: string): Promise<AccessDecision & { requiresApproval: boolean }> {
    if (followerId === targetId) return { ...deny('SELF', "You can't follow yourself."), requiresApproval: false };
    const owner = await this.activeProfileOwner(targetId);
    if (!owner || owner.status === 'HIDDEN') return { ...deny('NO_PROFILE', UNAVAILABLE), requiresApproval: false };
    const r = await RelationshipReader.between(followerId, targetId);
    if (isBlockedEitherWay(r)) return { ...deny('BLOCKED', UNAVAILABLE), requiresApproval: false };
    const s = await PrivacyPolicyService.get(targetId);
    if (s.followPolicy === 'NOBODY') return { ...deny('FOLLOWS_DISABLED', "This account isn't accepting followers."), requiresApproval: false };
    const requiresApproval = s.followPolicy === 'APPROVAL_REQUIRED' || s.profileVisibility === 'PRIVATE';
    return { ...allow(), requiresApproval };
  }

  // ---------------------------------------------------------------------------
  // Messaging
  // ---------------------------------------------------------------------------

  /**
   * Can `senderId` start a conversation with `recipientId`?
   * `direct` = may message without a request (mutual follows and recipient allows messages).
   */
  public static async canStartConversation(senderId: string, recipientId: string): Promise<AccessDecision & { direct: boolean }> {
    if (senderId === recipientId) return { ...deny('SELF', "You can't message yourself."), direct: false };
    const owner = await this.activeProfileOwner(recipientId);
    if (!owner || owner.status === 'HIDDEN') return { ...deny('NO_PROFILE', UNAVAILABLE), direct: false };
    const r = await RelationshipReader.between(senderId, recipientId);
    if (isBlockedEitherWay(r)) return { ...deny('BLOCKED', UNAVAILABLE), direct: false };

    const [senderConsent, recipientConsent] = await Promise.all([
      SocialConsentService.isGranted(senderId, 'DIRECT_MESSAGING'),
      SocialConsentService.isGranted(recipientId, 'DIRECT_MESSAGING'),
    ]);
    if (!senderConsent) return { ...deny('SENDER_CONSENT_MISSING', 'Turn on direct messages in Settings → Social & Privacy first.'), direct: false };
    if (!recipientConsent) return { ...deny('RECIPIENT_NOT_ACCEPTING', "This person isn't accepting messages."), direct: false };

    const s = await PrivacyPolicyService.get(recipientId);
    const rel = audienceRel(r);
    const mutual = rel.viewerFollowsOwner && rel.ownerFollowsViewer;
    if (s.whoCanMessage === 'NOBODY') return { ...deny('MESSAGES_OFF', "This person isn't accepting messages."), direct: false };
    if (!PrivacyPolicyService.audienceAllows(s.whoCanMessage, rel)) {
      return { ...deny('AUDIENCE', "This person only accepts messages from people they're connected with."), direct: false };
    }
    return { ...allow(), direct: mutual };
  }

  /** Can a participant keep messaging inside an existing thread? (blocks always win) */
  public static async canMessage(senderId: string, recipientId: string): Promise<AccessDecision> {
    if (await RelationshipReader.hasBlockEitherWay(senderId, recipientId)) return deny('BLOCKED', UNAVAILABLE);
    const recipientConsent = await SocialConsentService.isGranted(recipientId, 'DIRECT_MESSAGING');
    if (!recipientConsent) return deny('RECIPIENT_NOT_ACCEPTING', "This person isn't accepting messages.");
    return allow();
  }

  // ---------------------------------------------------------------------------
  // Content, comments, mentions, sharing, notifications
  // ---------------------------------------------------------------------------

  public static async canViewContent(
    viewerId: string | null,
    content: Pick<SocialContent, 'authorUserId' | 'status' | 'visibility' | 'communityId' | 'revokedAt' | 'expiresAt' | 'deletedAt' | 'kind'>,
  ): Promise<AccessDecision> {
    const isOwner = !!viewerId && content.authorUserId === viewerId;
    if (content.deletedAt || content.revokedAt) return deny('GONE', UNAVAILABLE);
    if (content.expiresAt && content.expiresAt.getTime() < Date.now()) return deny('EXPIRED', 'This link has expired.');
    if (content.status !== 'PUBLISHED' && !isOwner) return deny(`STATUS_${content.status}`, UNAVAILABLE);
    if (isOwner) return allow('OWNER');

    if (content.authorUserId) {
      if (viewerId && (await RelationshipReader.hasBlockEitherWay(viewerId, content.authorUserId))) return deny('BLOCKED', UNAVAILABLE);
      const authorProfile = await prisma.socialProfile.findUnique({ where: { userId: content.authorUserId }, select: { status: true } });
      if (authorProfile?.status === 'HIDDEN') return deny('AUTHOR_HIDDEN', UNAVAILABLE);
    }

    if (content.communityId) {
      return this.canViewCommunityContent(viewerId, content.communityId);
    }

    if (content.visibility === 'PUBLIC' || content.visibility === 'UNLISTED') return allow();
    if (content.visibility === 'FOLLOWERS') {
      if (!viewerId || !content.authorUserId) return deny('FOLLOWERS_ONLY', 'Only followers can see this.');
      const r = await RelationshipReader.between(viewerId, content.authorUserId);
      return r.viewerFollows === 'ACTIVE' ? allow() : deny('FOLLOWERS_ONLY', 'Only followers can see this.');
    }
    return deny('VISIBILITY', UNAVAILABLE);
  }

  public static async canViewCommunityContent(viewerId: string | null, communityId: string): Promise<AccessDecision> {
    const community = await prisma.community.findUnique({ where: { id: communityId }, select: { privacy: true, status: true, deletedAt: true } });
    if (!community || community.deletedAt || community.status === 'SUSPENDED') return deny('COMMUNITY_UNAVAILABLE', UNAVAILABLE);
    const member = viewerId
      ? await prisma.communityMember.findUnique({ where: { communityId_userId: { communityId, userId: viewerId } }, select: { status: true } })
      : null;
    if (member?.status === 'BANNED') return deny('COMMUNITY_BANNED', "You can't view this community.");
    if (community.privacy === 'PUBLIC') return allow();
    return member && ['ACTIVE', 'MUTED'].includes(member.status) ? allow('MEMBER') : deny('COMMUNITY_PRIVATE', 'Join this community to see its posts.');
  }

  public static async canComment(commenterId: string, content: SocialContent): Promise<AccessDecision> {
    const view = await this.canViewContent(commenterId, content);
    if (!view.allowed) return view;
    if (content.status !== 'PUBLISHED') return deny('NOT_PUBLISHED', "Comments aren't open yet.");
    if (content.communityId) {
      const m = await prisma.communityMember.findUnique({ where: { communityId_userId: { communityId: content.communityId, userId: commenterId } }, select: { status: true, restrictedUntil: true } });
      if (!m || m.status !== 'ACTIVE') return deny('NOT_COMMUNITY_MEMBER', 'Join this community to comment.');
      if (m.restrictedUntil && m.restrictedUntil > new Date()) return deny('COMMUNITY_RESTRICTED', "You can't comment in this community right now.");
    }
    if (!content.authorUserId || content.authorUserId === commenterId) return allow();
    const s = await PrivacyPolicyService.get(content.authorUserId);
    const r = await RelationshipReader.between(commenterId, content.authorUserId);
    if (isBlockedEitherWay(r)) return deny('BLOCKED', UNAVAILABLE);
    return PrivacyPolicyService.audienceAllows(s.whoCanComment, audienceRel(r)) ? allow() : deny('COMMENT_AUDIENCE', 'The author limited who can comment.');
  }

  public static async canMention(mentionerId: string, targetId: string, settings?: SocialPrivacySettings): Promise<AccessDecision> {
    if (mentionerId === targetId) return allow('SELF');
    const owner = await this.activeProfileOwner(targetId);
    if (!owner || owner.status === 'HIDDEN') return deny('NO_PROFILE', UNAVAILABLE);
    const r = await RelationshipReader.between(mentionerId, targetId);
    if (isBlockedEitherWay(r)) return deny('BLOCKED', UNAVAILABLE);
    const s = settings ?? (await PrivacyPolicyService.get(targetId));
    return PrivacyPolicyService.audienceAllows(s.whoCanMention, audienceRel(r)) ? allow() : deny('MENTION_AUDIENCE', "This person can't be mentioned.");
  }

  public static async canShareWith(senderId: string, recipientId: string): Promise<AccessDecision> {
    if (await RelationshipReader.hasBlockEitherWay(senderId, recipientId)) return deny('BLOCKED', UNAVAILABLE);
    return allow();
  }

  public static async canInviteToCommunity(inviterId: string, inviteeId: string): Promise<AccessDecision> {
    const r = await RelationshipReader.between(inviterId, inviteeId);
    if (isBlockedEitherWay(r)) return deny('BLOCKED', UNAVAILABLE);
    const s = await PrivacyPolicyService.get(inviteeId);
    // Relationship from the invitee's perspective: does the inviter follow the invitee, etc.
    return PrivacyPolicyService.audienceAllows(s.whoCanInviteToCommunities, audienceRel(r)) ? allow() : deny('INVITE_AUDIENCE', "This person isn't accepting invitations.");
  }

  /** Recipient-side filter for every social notification. */
  public static async canReceiveNotificationFrom(recipientId: string, actorId: string | null): Promise<AccessDecision> {
    if (!actorId) return allow('SYSTEM');
    if (recipientId === actorId) return deny('SELF', 'self');
    const r = await RelationshipReader.between(recipientId, actorId);
    if (isBlockedEitherWay(r)) return deny('BLOCKED', 'blocked');
    if (r.viewerMutedScopes.some((s) => s === 'ALL' || s === 'NOTIFICATIONS')) return deny('MUTED', 'muted');
    return allow();
  }
}
