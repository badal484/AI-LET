import { Prisma, type SocialContent, type SocialContentStatus } from '@prisma/client';
import { ErrorCode } from '@ai-companion/config';
import type {
  SocialCharacterRef,
  SocialContentAttribution,
  SocialContentView,
  SocialCursorPage,
  SocialReactionType,
  SocialShareMetadata,
  SocialSharePreview,
  SocialSharePreviewMessage,
} from '@ai-companion/types';
import type { SocialCreatePostInput, SocialCreateShareInput, SocialEditPostInput, SocialSharePreviewInput } from '@ai-companion/validation';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { env } from '../../../config/env.js';
import { AuditService } from '../../audit/audit.service.js';
import { AppError, BadRequestError, ForbiddenError, NotFoundError } from '../../../shared/errors/AppError.js';
import { SocialAccessService } from '../access/SocialAccessService.js';
import { SocialProfileService } from '../identity/SocialProfileService.js';
import { SocialPolicyService } from '../policy/SocialPolicyService.js';
import { SocialAbuseService } from '../safety/SocialAbuseService.js';
import { SocialRateLimiter } from '../safety/SocialRateLimiter.js';
import { ShareSafetyPipeline, type ShareSafetyResult } from '../safety/ShareSafetyPipeline.js';
import { SocialContentSafetyService } from '../safety/SocialContentSafetyService.js';
import { SocialModerationService } from '../moderation/SocialModerationService.js';
import { SocialEvents } from '../shared/SocialEvents.js';
import { decodeCursor, generatePublicId, keysetAfter, toPage } from '../shared/ids.js';
import { RelationshipReader } from '../graph/RelationshipReader.js';
import { PrivacyPolicyService } from '../identity/PrivacyPolicyService.js';

const NOT_FOUND = () => new NotFoundError('This content is unavailable.', ErrorCode.SOCIAL_CONTENT_NOT_FOUND);
const EXTERNAL_COPY_NOTICE = 'Anyone with the link can view this. You can revoke it at any time, but copies made outside the app (screenshots, reposts) cannot be recalled.';

/** Only these character fields may ever appear in public: the published, safe representation. */
const SAFE_CHARACTER_SELECT = {
  id: true,
  slug: true,
  name: true,
  tagline: true,
  shortDescription: true,
  avatarUrl: true,
  category: true,
  status: true,
  visibility: true,
  deletedAt: true,
  creatorProfile: { select: { displayName: true, username: true, verificationStatus: true, status: true } },
} satisfies Prisma.CharacterSelect;

type SafeCharacter = Prisma.CharacterGetPayload<{ select: typeof SAFE_CHARACTER_SELECT }>;

function isPubliclyShareable(c: SafeCharacter | null): c is SafeCharacter {
  return !!c && !c.deletedAt && c.status === 'PUBLISHED' && (c.visibility === 'PUBLIC' || c.visibility === 'UNLISTED');
}

function characterRef(c: { slug: string; name: string; avatarUrl: string | null }): SocialCharacterRef {
  return { slug: c.slug, name: c.name, avatarUrl: c.avatarUrl, isAi: true };
}

interface BuiltSnapshot {
  kind: 'CHARACTER_SHARE' | 'CONVERSATION_EXCERPT';
  characterId: string | null;
  character: SafeCharacter | null;
  sourceType: string;
  sourceRef: string;
  safety: ShareSafetyResult;
  messages: SocialSharePreviewMessage[];
  attachmentsExcluded: number;
  snapshot: Record<string, unknown>;
  defaultTitle: string;
}

export class SocialContentService {
  // ---------------------------------------------------------------------------
  // Sharing: preview → confirm → immutable snapshot
  // ---------------------------------------------------------------------------

  /** Builds the redacted snapshot server-side from sources the caller owns. Nothing is persisted. */
  private static async buildSnapshot(userId: string, source: SocialSharePreviewInput): Promise<BuiltSnapshot> {
    const config = await SocialPolicyService.getConfig();

    if (source.kind === 'CHARACTER_SHARE') {
      await SocialPolicyService.assertFeature('character_sharing', { userId });
      const character = await prisma.character.findFirst({ where: { slug: source.characterSlug }, select: SAFE_CHARACTER_SELECT });
      if (!isPubliclyShareable(character)) throw new NotFoundError('Character not found');
      const text = [character.name, character.tagline, character.shortDescription].filter(Boolean).join('\n');
      const safety = ShareSafetyPipeline.run([{ ref: 'character', text }], config.sharing);
      return {
        kind: 'CHARACTER_SHARE',
        characterId: character.id,
        character,
        sourceType: 'CHARACTER',
        sourceRef: character.id,
        safety,
        messages: [],
        attachmentsExcluded: 0,
        snapshot: {
          character: {
            slug: character.slug,
            name: character.name,
            tagline: character.tagline,
            shortDescription: character.shortDescription,
            avatarUrl: character.avatarUrl,
            category: character.category,
            isAi: true,
            creator: character.creatorProfile && character.creatorProfile.status === 'ACTIVE'
              ? { displayName: character.creatorProfile.displayName, username: character.creatorProfile.username, isVerified: character.creatorProfile.verificationStatus !== 'UNVERIFIED' }
              : null,
          },
        },
        defaultTitle: character.name,
      };
    }

    // CONVERSATION_EXCERPT
    await SocialPolicyService.assertFeature('public_conversation_sharing', { userId });
    if (source.messageIds.length > config.sharing.maxExcerptMessages) {
      throw new BadRequestError(`You can share at most ${config.sharing.maxExcerptMessages} messages.`);
    }
    // Ownership: the conversation must belong to the caller. Anything else is a not-found (no IDOR).
    const conversation = await prisma.conversation.findFirst({
      where: { id: source.conversationId, userId, deletedAt: null },
      select: { id: true, characterId: true },
    });
    if (!conversation) throw new NotFoundError('Conversation not found');
    const rows = await prisma.message.findMany({
      where: { id: { in: source.messageIds }, conversationId: conversation.id, status: { in: ['SENT', 'COMPLETED'] } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, senderType: true, content: true, parts: { select: { partType: true } } },
    });
    if (rows.length !== new Set(source.messageIds).size) throw new BadRequestError('Some selected messages are unavailable.');

    const character = await prisma.character.findFirst({ where: { id: conversation.characterId }, select: SAFE_CHARACTER_SELECT });
    const shareableCharacter = isPubliclyShareable(character) ? character : null;

    const manual = new Map<string, string[]>();
    for (const r of source.manualRedactions ?? []) manual.set(r.messageId, [...(manual.get(r.messageId) ?? []), r.text]);
    const speakable = rows.filter((m) => m.senderType !== 'SYSTEM');
    const safety = ShareSafetyPipeline.run(
      speakable.map((m) => ({ ref: m.id, text: m.content, manualRedactions: manual.get(m.id) })),
      config.sharing,
    );
    const attachmentsExcluded = rows.reduce((n, m) => n + m.parts.filter((p) => p.partType !== 'text').length, 0);

    // Public refs are positional, never message ids.
    const messages: SocialSharePreviewMessage[] = safety.items.map((item, idx) => ({
      ref: `m${idx + 1}`,
      speaker: speakable[idx]!.senderType === 'CHARACTER' ? 'CHARACTER' : 'USER',
      text: item.text,
      redacted: item.redacted,
    }));

    return {
      kind: 'CONVERSATION_EXCERPT',
      characterId: shareableCharacter?.id ?? null,
      character: shareableCharacter,
      sourceType: 'CONVERSATION',
      sourceRef: conversation.id,
      safety,
      messages,
      attachmentsExcluded,
      snapshot: {
        character: shareableCharacter ? { ...characterRef(shareableCharacter) } : { name: 'A private character', isAi: true },
        messages: messages.map((m) => ({ speaker: m.speaker, text: m.text })),
        attachmentsExcluded,
        disclaimer: 'Character messages are AI-generated.',
      },
      defaultTitle: shareableCharacter ? `A conversation with ${shareableCharacter.name}` : 'A conversation excerpt',
    };
  }

  public static async previewShare(userId: string, source: SocialSharePreviewInput): Promise<SocialSharePreview> {
    const built = await this.buildSnapshot(userId, source);
    const needsToken = built.safety.decision.action === 'REQUIRE_CONFIRMATION';
    return {
      kind: built.kind,
      visibleMessageCount: built.messages.length,
      messages: built.messages,
      character: built.character ? characterRef(built.character) : null,
      findings: built.safety.findings,
      decision: built.safety.decision,
      confirmationToken: needsToken ? ShareSafetyPipeline.issueConfirmationToken(userId, built.safety.fingerprint) : null,
      externalCopyNotice: EXTERNAL_COPY_NOTICE,
    };
  }

  public static async createShare(userId: string, input: SocialCreateShareInput, requestId?: string): Promise<SocialContentView> {
    await SocialProfileService.requireOwnProfile(userId);
    await SocialAbuseService.assertCapability(userId, 'SHARE');
    await SocialRateLimiter.enforce('share', userId);
    const config = await SocialPolicyService.getConfig();

    // Rebuild from source at creation time: the client never supplies the public payload.
    const built = await this.buildSnapshot(userId, input.source);
    const decision = built.safety.decision;
    if (decision.action === 'BLOCK') throw new AppError(decision.userMessage ?? 'This cannot be shared.', 422, ErrorCode.SOCIAL_PII_DETECTED);
    if (decision.action === 'REQUIRE_CONFIRMATION' && !ShareSafetyPipeline.verifyConfirmationToken(userId, built.safety.fingerprint, input.confirmationToken)) {
      throw new AppError('Please review the redacted preview and confirm before sharing.', 409, ErrorCode.SOCIAL_CONFIRMATION_REQUIRED);
    }

    let caption: string | null = null;
    let captionNeedsReview = false;
    if (input.caption) {
      const cap = SocialContentSafetyService.evaluateText(input.caption, { surface: 'POST', maxLinks: 1 });
      if (cap.decision.action === 'BLOCK') throw new AppError(cap.decision.userMessage ?? 'Caption not allowed', 422, ErrorCode.SOCIAL_CONTENT_REJECTED);
      captionNeedsReview = cap.decision.action === 'REQUIRE_MODERATION';
      caption = cap.sanitizedText;
    }

    const needsHuman = built.safety.requiresModeration || captionNeedsReview;
    const status: SocialContentStatus = needsHuman ? 'PENDING_MODERATION' : 'PUBLISHED';
    const expiresInDays = input.expiresInDays ?? config.sharing.defaultExpiryDays;

    const content = await prisma.socialContent.create({
      data: {
        publicId: generatePublicId(),
        kind: built.kind,
        authorType: 'USER',
        authorUserId: userId,
        characterId: built.characterId,
        sourceType: built.sourceType,
        sourceRef: built.sourceRef,
        title: input.title ?? built.defaultTitle,
        body: caption,
        snapshot: built.snapshot as Prisma.InputJsonValue,
        visibility: input.visibility,
        status,
        moderationStatus: needsHuman ? 'FLAGGED' : 'APPROVED',
        moderationReasons: decision.reasons.length ? (decision.reasons as Prisma.InputJsonValue) : Prisma.JsonNull,
        redactionReport: built.safety.findings as unknown as Prisma.InputJsonValue,
        expiresAt: new Date(Date.now() + expiresInDays * 86_400_000),
        publishedAt: status === 'PUBLISHED' ? new Date() : null,
      },
    });

    if (needsHuman) {
      await SocialModerationService.openAutomatedCase({
        targetType: 'CONTENT',
        targetId: content.id,
        subjectUserId: userId,
        queue: 'USER_CONTENT',
        severity: 'MEDIUM',
        signals: { reasons: decision.reasons, stage: 'pre_publication' },
        reasons: decision.reasons,
      });
    }

    await AuditService.log({ actorType: 'USER', actorId: userId, action: 'SOCIAL_CONTENT_SHARED', resourceType: 'social_content', resourceId: content.id, metadata: { kind: built.kind, visibility: input.visibility, status, findings: built.safety.findings.map((f) => f.type) } });
    SocialEvents.emit('ContentShared', { actorUserId: userId, contentId: content.publicId, contentType: built.kind, characterId: built.characterId, visibility: input.visibility, requestId });
    return (await this.toViews([content], userId))[0]!;
  }

  // ---------------------------------------------------------------------------
  // Posts (creator & community)
  // ---------------------------------------------------------------------------

  public static async createPost(userId: string, input: SocialCreatePostInput, requestId?: string): Promise<SocialContentView> {
    await SocialProfileService.requireOwnProfile(userId);
    await SocialAbuseService.assertCapability(userId, 'PUBLISH');
    await SocialRateLimiter.enforce('content_publish', userId);

    let characterId: string | null = null;
    let communityId: string | null = null;

    if (input.kind === 'CREATOR_POST') {
      const creator = await prisma.creatorProfile.findUnique({ where: { userId }, select: { id: true, status: true } });
      if (!creator || creator.status !== 'ACTIVE') throw new ForbiddenError('Only active creators can publish creator posts.');
      if (input.characterSlug) {
        const ch = await prisma.character.findFirst({ where: { slug: input.characterSlug, creatorProfileId: creator.id, deletedAt: null }, select: { id: true } });
        if (!ch) throw new NotFoundError('Character not found');
        characterId = ch.id;
      }
    } else {
      await SocialPolicyService.assertFeature('communities', { userId });
      if (!input.communitySlug) throw new BadRequestError('communitySlug is required for community posts');
      const community = await prisma.community.findFirst({ where: { slug: input.communitySlug, deletedAt: null, status: { in: ['ACTIVE'] } }, select: { id: true } });
      if (!community) throw new NotFoundError('Community not found', ErrorCode.SOCIAL_COMMUNITY_NOT_FOUND);
      const m = await prisma.communityMember.findUnique({ where: { communityId_userId: { communityId: community.id, userId } } });
      if (!m || m.status !== 'ACTIVE' || (m.restrictedUntil && m.restrictedUntil > new Date())) throw new ForbiddenError("You can't post in this community.");
      communityId = community.id;
    }

    const config = await SocialPolicyService.getConfig();
    const isDuplicate = await SocialAbuseService.isDuplicateContent(userId, 'post', input.body);
    const evaluation = SocialContentSafetyService.evaluateText(`${input.title ?? ''}\n${input.body}`, { surface: 'POST', maxLinks: config.comments.maxLinks + 1, isDuplicate });
    if (evaluation.decision.action === 'BLOCK') throw new AppError(evaluation.decision.userMessage ?? 'Not allowed', 422, ErrorCode.SOCIAL_CONTENT_REJECTED);
    const needsHuman = evaluation.decision.action === 'REQUIRE_MODERATION';

    const bodyEval = SocialContentSafetyService.evaluateText(input.body, { surface: 'POST' });
    const content = await prisma.socialContent.create({
      data: {
        publicId: generatePublicId(),
        kind: input.kind,
        authorType: input.kind === 'CREATOR_POST' ? 'CREATOR' : 'USER',
        authorUserId: userId,
        characterId,
        communityId,
        title: input.title ?? null,
        body: bodyEval.sanitizedText,
        snapshot: {},
        visibility: input.kind === 'COMMUNITY_POST' ? 'COMMUNITY' : input.visibility === 'COMMUNITY' ? 'PUBLIC' : input.visibility,
        status: needsHuman ? 'PENDING_MODERATION' : 'PUBLISHED',
        moderationStatus: needsHuman ? 'FLAGGED' : 'APPROVED',
        moderationReasons: evaluation.decision.reasons.length ? (evaluation.decision.reasons as Prisma.InputJsonValue) : Prisma.JsonNull,
        topics: input.topics.map((t) => t.toLowerCase()),
        publishedAt: needsHuman ? null : new Date(),
      },
    });
    await prisma.socialContentRevision.create({
      data: { contentId: content.id, version: 1, title: content.title, body: content.body, snapshot: {}, editedByUserId: userId, moderationStatus: content.moderationStatus },
    });
    if (needsHuman) {
      await SocialModerationService.openAutomatedCase({
        targetType: 'CONTENT',
        targetId: content.id,
        subjectUserId: userId,
        queue: communityId ? 'COMMUNITIES' : 'USER_CONTENT',
        severity: 'MEDIUM',
        signals: evaluation.signals,
        reasons: evaluation.decision.reasons,
      });
    }
    await AuditService.log({ actorType: 'USER', actorId: userId, action: 'SOCIAL_POST_CREATED', resourceType: 'social_content', resourceId: content.id, metadata: { kind: input.kind, status: content.status } });
    SocialEvents.emit(content.status === 'PUBLISHED' ? 'ContentPublished' : 'ContentShared', { actorUserId: userId, contentId: content.publicId, contentType: input.kind, characterId, communityId, visibility: content.visibility, requestId });
    return (await this.toViews([content], userId))[0]!;
  }

  /** Edits keep a full revision history and re-run moderation: an edit can never bypass review. */
  public static async editPost(userId: string, publicId: string, input: SocialEditPostInput): Promise<SocialContentView> {
    const content = await prisma.socialContent.findUnique({ where: { publicId } });
    if (!content || content.authorUserId !== userId || content.deletedAt) throw NOT_FOUND();
    if (!['CREATOR_POST', 'COMMUNITY_POST'].includes(content.kind)) throw new BadRequestError('Shares are immutable snapshots. Revoke and share again instead.');
    if (['HIDDEN', 'REJECTED', 'DELETED', 'ARCHIVED'].includes(content.status)) throw new ForbiddenError('This post can no longer be edited.');

    const nextTitle = input.title === undefined ? content.title : input.title;
    const nextBody = input.body ?? content.body ?? '';
    const evaluation = SocialContentSafetyService.evaluateText(`${nextTitle ?? ''}\n${nextBody}`, { surface: 'POST' });
    if (evaluation.decision.action === 'BLOCK') throw new AppError(evaluation.decision.userMessage ?? 'Not allowed', 422, ErrorCode.SOCIAL_CONTENT_REJECTED);
    const needsHuman = evaluation.decision.action === 'REQUIRE_MODERATION';
    const bodyEval = SocialContentSafetyService.evaluateText(nextBody, { surface: 'POST' });

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.socialContent.update({
        where: { id: content.id },
        data: {
          title: nextTitle,
          body: bodyEval.sanitizedText,
          version: { increment: 1 },
          // A restricted post stays restricted; otherwise flagged edits wait for review.
          status: content.status === 'RESTRICTED' ? 'RESTRICTED' : needsHuman ? 'PENDING_MODERATION' : content.status === 'PENDING_MODERATION' ? 'PENDING_MODERATION' : 'PUBLISHED',
          moderationStatus: needsHuman ? 'FLAGGED' : content.moderationStatus,
          moderationReasons: evaluation.decision.reasons.length ? (evaluation.decision.reasons as Prisma.InputJsonValue) : Prisma.JsonNull,
        },
      });
      await tx.socialContentRevision.create({
        data: { contentId: row.id, version: row.version, title: row.title, body: row.body, snapshot: {}, editedByUserId: userId, moderationStatus: row.moderationStatus },
      });
      return row;
    });
    if (needsHuman) {
      await SocialModerationService.openAutomatedCase({ targetType: 'CONTENT', targetId: content.id, subjectUserId: userId, queue: content.communityId ? 'COMMUNITIES' : 'USER_CONTENT', severity: 'MEDIUM', signals: { ...evaluation.signals, stage: 'edit' }, reasons: evaluation.decision.reasons });
    }
    await AuditService.log({ actorType: 'USER', actorId: userId, action: 'SOCIAL_POST_EDITED', resourceType: 'social_content', resourceId: content.id, metadata: { version: updated.version } });
    return (await this.toViews([updated], userId))[0]!;
  }

  /** Revocation stops internal access immediately. External copies cannot be recalled (stated in UX). */
  public static async revoke(userId: string, publicId: string): Promise<{ revoked: boolean }> {
    const res = await prisma.socialContent.updateMany({ where: { publicId, authorUserId: userId, revokedAt: null }, data: { revokedAt: new Date() } });
    if (res.count > 0) {
      await AuditService.log({ actorType: 'USER', actorId: userId, action: 'SOCIAL_CONTENT_REVOKED', resourceType: 'social_content', resourceId: publicId });
      SocialEvents.emit('ContentRemoved', { actorUserId: userId, contentId: publicId, source: 'revoke' });
    }
    return { revoked: res.count > 0 };
  }

  public static async deleteOwn(userId: string, publicId: string): Promise<{ deleted: boolean }> {
    const res = await prisma.socialContent.updateMany({
      where: { publicId, authorUserId: userId, deletedAt: null },
      data: { status: 'DELETED', deletedAt: new Date() },
    });
    if (res.count > 0) {
      await AuditService.log({ actorType: 'USER', actorId: userId, action: 'SOCIAL_CONTENT_DELETED', resourceType: 'social_content', resourceId: publicId });
      SocialEvents.emit('ContentRemoved', { actorUserId: userId, contentId: publicId, source: 'delete' });
    }
    return { deleted: res.count > 0 };
  }

  // ---------------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------------

  /** Loads by public id and enforces access. Unavailable = not-found (no existence leak). */
  public static async getAccessible(viewerId: string | null, publicId: string): Promise<SocialContent> {
    const content = await prisma.socialContent.findUnique({ where: { publicId } });
    if (!content) throw NOT_FOUND();
    const access = await SocialAccessService.canViewContent(viewerId, content);
    if (!access.allowed) {
      if (access.reason === 'EXPIRED') throw new AppError('This link has expired.', 410, ErrorCode.SOCIAL_SHARE_EXPIRED);
      throw NOT_FOUND();
    }
    return content;
  }

  public static async getView(viewerId: string | null, publicId: string): Promise<SocialContentView> {
    const content = await this.getAccessible(viewerId, publicId);
    SocialEvents.emit('ContentViewed', { actorUserId: viewerId, contentId: content.publicId, contentType: content.kind, characterId: content.characterId, surface: 'detail' });
    return (await this.toViews([content], viewerId))[0]!;
  }

  public static async getShareMetadata(publicId: string): Promise<SocialShareMetadata> {
    const content = await this.getAccessible(null, publicId);
    const snapshot = content.snapshot as { character?: { name?: string; avatarUrl?: string | null } };
    const characterName = snapshot.character?.name ?? null;
    // Link previews never include message text or captions — only generic, safe metadata.
    const description =
      content.kind === 'CONVERSATION_EXCERPT'
        ? `A shared conversation${characterName ? ` with ${characterName}, an AI character` : ''}.`
        : content.kind === 'CHARACTER_SHARE'
          ? `Meet ${characterName ?? 'this character'} — an AI character.`
          : 'A post on AI Companion.';
    return {
      title: content.title ?? 'Shared on AI Companion',
      description,
      imageUrl: snapshot.character?.avatarUrl ?? null,
      canonicalUrl: this.shareUrl(content),
    };
  }

  public static async listByAuthor(viewerId: string | null, handle: string, cursor: string | undefined, limit: number): Promise<SocialCursorPage<SocialContentView>> {
    const owner = await SocialProfileService.resolveOrThrow(handle);
    const access = await SocialAccessService.profileAccess(viewerId, owner.userId);
    if (!access.exists) throw new NotFoundError('Profile not found', ErrorCode.SOCIAL_USER_NOT_FOUND);
    if (!access.full) return { items: [], nextCursor: null };
    const isOwner = viewerId === owner.userId;

    // One relationship + privacy read for the whole page (no per-item access queries).
    let allowedVisibilities: Array<'PUBLIC' | 'FOLLOWERS'> = ['PUBLIC'];
    if (!isOwner) {
      const settings = await PrivacyPolicyService.get(owner.userId);
      const rel = viewerId ? await RelationshipReader.between(viewerId, owner.userId) : null;
      const audienceRel = { isSelf: false, viewerFollowsOwner: rel?.viewerFollows === 'ACTIVE', ownerFollowsViewer: rel?.targetFollows === 'ACTIVE' };
      if (!PrivacyPolicyService.audienceAllows(settings.sharedContentAudience, audienceRel)) return { items: [], nextCursor: null };
      if (audienceRel.viewerFollowsOwner) allowedVisibilities = ['PUBLIC', 'FOLLOWERS'];
    }

    const rows = await prisma.socialContent.findMany({
      where: {
        authorUserId: owner.userId,
        communityId: null,
        deletedAt: null,
        revokedAt: null,
        ...(isOwner ? {} : { status: 'PUBLISHED', visibility: { in: allowedVisibilities }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }),
        ...keysetAfter(decodeCursor(cursor)),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const page = toPage(rows, limit, (r) => ({ at: r.createdAt, id: r.id }));
    return { items: await this.toViews(page.items, viewerId), nextCursor: page.nextCursor };
  }

  public static async listByCharacter(viewerId: string | null, slug: string, cursor: string | undefined, limit: number): Promise<SocialCursorPage<SocialContentView>> {
    const character = await prisma.character.findFirst({ where: { slug, deletedAt: null, status: 'PUBLISHED' }, select: { id: true } });
    if (!character) throw new NotFoundError('Character not found');
    const hidden = viewerId ? await RelationshipReader.blockedEitherWaySet(viewerId) : new Set<string>();
    const rows = await prisma.socialContent.findMany({
      where: {
        characterId: character.id,
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        communityId: null,
        deletedAt: null,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        ...(hidden.size ? { NOT: { authorUserId: { in: [...hidden] } } } : {}),
        ...keysetAfter(decodeCursor(cursor)),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const page = toPage(rows, limit, (r) => ({ at: r.createdAt, id: r.id }));
    return { items: await this.toViews(page.items, viewerId), nextCursor: page.nextCursor };
  }

  // ---------------------------------------------------------------------------
  // Mapping
  // ---------------------------------------------------------------------------

  public static shareUrl(c: Pick<SocialContent, 'publicId' | 'kind'>): string {
    const base = env.SOCIAL_PUBLIC_BASE_URL.replace(/\/$/, '');
    return ['CREATOR_POST', 'COMMUNITY_POST', 'CHARACTER_POST'].includes(c.kind) ? `${base}/p/${c.publicId}` : `${base}/share/${c.publicId}`;
  }

  public static attribution(c: Pick<SocialContent, 'kind' | 'isAiGenerated' | 'authorType'>): SocialContentAttribution {
    if (c.isAiGenerated || c.authorType === 'AI_CHARACTER') return 'AI_GENERATED';
    if (c.authorType === 'PLATFORM') return 'PLATFORM';
    if (c.kind === 'CREATOR_POST') return 'CREATOR_WROTE_THIS';
    return 'USER_SHARED';
  }

  public static async toViews(rows: SocialContent[], viewerId: string | null): Promise<SocialContentView[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const [cards, characters, communities, reactions] = await Promise.all([
      SocialProfileService.cards(rows.map((r) => r.authorUserId)),
      prisma.character.findMany({ where: { id: { in: rows.map((r) => r.characterId).filter((x): x is string => !!x) } }, select: { id: true, slug: true, name: true, avatarUrl: true } }),
      prisma.community.findMany({ where: { id: { in: rows.map((r) => r.communityId).filter((x): x is string => !!x) } }, select: { id: true, slug: true, name: true } }),
      viewerId ? prisma.socialReaction.findMany({ where: { userId: viewerId, contentId: { in: ids } }, select: { contentId: true, reactionType: true } }) : [],
    ]);
    return rows.map((c) => {
      const ch = characters.find((x) => x.id === c.characterId);
      const cm = communities.find((x) => x.id === c.communityId);
      return {
        publicId: c.publicId,
        kind: c.kind,
        attribution: this.attribution(c),
        author: c.authorUserId ? cards.get(c.authorUserId) ?? null : null,
        character: ch ? characterRef(ch) : null,
        community: cm ? { slug: cm.slug, name: cm.name } : null,
        title: c.title,
        body: c.body,
        snapshot: (c.snapshot as Record<string, unknown>) ?? {},
        visibility: c.visibility,
        status: c.status,
        isAiGenerated: c.isAiGenerated,
        reactionCount: c.reactionCount,
        commentCount: c.commentCount,
        viewerReactions: reactions.filter((r) => r.contentId === c.id).map((r) => r.reactionType as SocialReactionType),
        isOwner: !!viewerId && c.authorUserId === viewerId,
        isEdited: c.version > 1,
        expiresAt: c.expiresAt?.toISOString() ?? null,
        publishedAt: c.publishedAt?.toISOString() ?? null,
        createdAt: c.createdAt.toISOString(),
        shareUrl: this.shareUrl(c),
      };
    });
  }
}
