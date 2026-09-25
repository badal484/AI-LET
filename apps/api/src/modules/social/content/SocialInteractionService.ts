import { Prisma, type SocialComment, type SocialReactionType } from '@prisma/client';
import { ErrorCode } from '@ai-companion/config';
import type { SocialCommentView, SocialCursorPage } from '@ai-companion/types';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { AuditService } from '../../audit/audit.service.js';
import { AppError, ForbiddenError, NotFoundError } from '../../../shared/errors/AppError.js';
import { SocialAccessService } from '../access/SocialAccessService.js';
import { SocialProfileService } from '../identity/SocialProfileService.js';
import { UsernameService } from '../identity/UsernameService.js';
import { SocialPolicyService } from '../policy/SocialPolicyService.js';
import { SocialAbuseService } from '../safety/SocialAbuseService.js';
import { SocialRateLimiter } from '../safety/SocialRateLimiter.js';
import { SocialContentSafetyService } from '../safety/SocialContentSafetyService.js';
import { SocialModerationService } from '../moderation/SocialModerationService.js';
import { RelationshipReader } from '../graph/RelationshipReader.js';
import { SocialEvents } from '../shared/SocialEvents.js';
import { decodeCursor, toPage } from '../shared/ids.js';
import { SocialContentService } from './SocialContentService.js';

const MENTION_PATTERN = '(^|[^\\w@])@([A-Za-z0-9](?:[A-Za-z0-9_.]{1,28}[A-Za-z0-9])?)';

export class MentionService {
  public static extract(text: string): string[] {
    const re = new RegExp(MENTION_PATTERN, 'g');
    const out = new Set<string>();
    for (const m of text.matchAll(re)) out.add(UsernameService.normalize(m[2]!));
    return [...out];
  }

  /**
   * Resolves @usernames to user ids the actor is ALLOWED to mention. Disallowed mentions are dropped
   * silently (the text stays, but no link/notification) so privacy settings and blocks don't leak.
   */
  public static async resolveAllowed(actorId: string, text: string): Promise<{ userIds: string[]; attempted: number }> {
    const usernames = this.extract(text);
    if (usernames.length === 0 || !(await SocialPolicyService.isFeatureEnabled('mentions', { userId: actorId }))) return { userIds: [], attempted: usernames.length };
    const profiles = await prisma.socialProfile.findMany({ where: { username: { in: usernames } }, select: { userId: true } });
    const allowed: string[] = [];
    for (const p of profiles) {
      if (p.userId === actorId) continue;
      if ((await SocialAccessService.canMention(actorId, p.userId)).allowed) allowed.push(p.userId);
    }
    return { userIds: allowed, attempted: usernames.length };
  }
}

export class SocialReactionService {
  /** Idempotent: re-adding the same reaction is a no-op; counters change only when a row is created. */
  public static async react(userId: string, publicId: string, reactionType: SocialReactionType, requestId?: string) {
    await SocialPolicyService.assertFeature('reactions', { userId });
    await SocialAbuseService.assertCapability(userId, 'ANY');
    await SocialRateLimiter.enforce('reaction', userId);
    const content = await SocialContentService.getAccessible(userId, publicId);
    if (content.status !== 'PUBLISHED') throw new ForbiddenError("Reactions aren't open yet.");

    let created = false;
    try {
      created = await prisma.$transaction(async (tx) => {
        const exists = await tx.socialReaction.findUnique({ where: { userId_contentId_reactionType: { userId, contentId: content.id, reactionType } }, select: { id: true } });
        if (exists) return false;
        await tx.socialReaction.create({ data: { userId, contentId: content.id, reactionType } });
        await tx.socialContent.update({ where: { id: content.id }, data: { reactionCount: { increment: 1 } } });
        return true;
      });
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
    }
    if (created && content.authorUserId && content.authorUserId !== userId) {
      SocialEvents.emit('ReactionCreated', { actorUserId: userId, recipientUserId: content.authorUserId, contentId: content.publicId, contentType: content.kind, characterId: content.characterId, requestId });
    }
    const fresh = await prisma.socialContent.findUniqueOrThrow({ where: { id: content.id }, select: { reactionCount: true } });
    return { reacted: true, reactionCount: fresh.reactionCount };
  }

  public static async unreact(userId: string, publicId: string, reactionType: SocialReactionType) {
    const content = await prisma.socialContent.findUnique({ where: { publicId }, select: { id: true } });
    if (!content) throw new NotFoundError('This content is unavailable.', ErrorCode.SOCIAL_CONTENT_NOT_FOUND);
    await prisma.$transaction(async (tx) => {
      const res = await tx.socialReaction.deleteMany({ where: { userId, contentId: content.id, reactionType } });
      if (res.count === 1) await tx.socialContent.update({ where: { id: content.id }, data: { reactionCount: { decrement: 1 } } });
    });
    const fresh = await prisma.socialContent.findUniqueOrThrow({ where: { id: content.id }, select: { reactionCount: true } });
    return { reacted: false, reactionCount: Math.max(0, fresh.reactionCount) };
  }
}

export class SocialCommentService {
  public static async create(userId: string, publicId: string, input: { body: string; parentId?: string }, requestId?: string): Promise<SocialCommentView> {
    await SocialPolicyService.assertFeature('comments', { userId });
    await SocialProfileService.requireOwnProfile(userId);
    await SocialAbuseService.assertCapability(userId, 'COMMENT');
    const config = await SocialPolicyService.getConfig();
    const account = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
    await SocialRateLimiter.enforce('comment', userId, { accountCreatedAt: account?.createdAt });

    const content = await SocialContentService.getAccessible(userId, publicId);
    const access = await SocialAccessService.canComment(userId, content);
    if (!access.allowed) {
      if (access.reason === 'BLOCKED') throw new NotFoundError('This content is unavailable.', ErrorCode.SOCIAL_CONTENT_NOT_FOUND);
      throw new ForbiddenError(access.userMessage ?? "You can't comment here.", ErrorCode.SOCIAL_PRIVACY_RESTRICTED);
    }
    if (input.body.length > config.comments.maxLength) throw new AppError(`Comments can be at most ${config.comments.maxLength} characters.`, 400, ErrorCode.SOCIAL_COMMENT_TOO_LONG);

    let parent: SocialComment | null = null;
    if (input.parentId) {
      parent = await prisma.socialComment.findUnique({ where: { id: input.parentId } });
      if (!parent || parent.contentId !== content.id || parent.status !== 'PUBLISHED') throw new NotFoundError('Comment not found', ErrorCode.SOCIAL_COMMENT_NOT_FOUND);
      // Fixed depth: top-level + one reply level. Replies to replies attach to the top-level thread.
      if (parent.parentId) parent = await prisma.socialComment.findUnique({ where: { id: parent.parentId } });
      if (parent?.authorUserId && (await RelationshipReader.hasBlockEitherWay(userId, parent.authorUserId))) {
        throw new NotFoundError('Comment not found', ErrorCode.SOCIAL_COMMENT_NOT_FOUND);
      }
    }

    const mentions = await MentionService.resolveAllowed(userId, input.body);
    const isDuplicate = await SocialAbuseService.isDuplicateContent(userId, 'comment', input.body);
    const evaluation = SocialContentSafetyService.evaluateText(input.body, {
      surface: 'COMMENT',
      maxLinks: config.comments.maxLinks,
      mentionCount: mentions.attempted,
      maxMentions: config.comments.maxMentions,
      isDuplicate,
    });
    if (evaluation.decision.action === 'BLOCK') {
      if (evaluation.decision.reasons.includes('DUPLICATE_CONTENT') || evaluation.decision.reasons.includes('TOO_MANY_MENTIONS')) {
        await SocialAbuseService.escalateIfNeeded(userId, 'COMMENT_SPAM');
      }
      throw new AppError(evaluation.decision.userMessage ?? 'Comment not allowed', 422, ErrorCode.SOCIAL_CONTENT_REJECTED);
    }
    const needsHuman = evaluation.decision.action === 'REQUIRE_MODERATION';
    const moderationReasons = [...evaluation.decision.reasons];

    const comment = await prisma.$transaction(async (tx) => {
      const row = await tx.socialComment.create({
        data: {
          contentId: content.id,
          authorUserId: userId,
          parentId: parent?.id ?? null,
          body: evaluation.sanitizedText,
          status: needsHuman ? 'PENDING_MODERATION' : 'PUBLISHED',
          moderationReasons: moderationReasons.length ? moderationReasons : Prisma.JsonNull,
          mentionedUserIds: needsHuman ? [] : mentions.userIds,
        },
      });
      const eventIds: string[] = [];
      if (!needsHuman) {
        await tx.socialContent.update({ where: { id: content.id }, data: { commentCount: { increment: 1 } } });
        if (parent) await tx.socialComment.update({ where: { id: parent.id }, data: { replyCount: { increment: 1 } } });
        eventIds.push(
          await SocialEvents.record(tx, 'CommentCreated', {
            actorUserId: userId,
            recipientUserId: content.authorUserId,
            contentId: content.publicId,
            contentType: content.kind,
            characterId: content.characterId,
            requestId,
            internal: { commentId: row.id, parentAuthorId: parent?.authorUserId ?? null },
          }),
        );
        for (const mentioned of mentions.userIds) {
          eventIds.push(await SocialEvents.record(tx, 'UserMentioned', { actorUserId: userId, recipientUserId: mentioned, contentId: content.publicId, surface: 'comment', internal: { commentId: row.id } }));
        }
      }
      return Object.assign(row, { __eventIds: eventIds });
    });

    if (needsHuman) {
      await SocialModerationService.openAutomatedCase({ targetType: 'COMMENT', targetId: comment.id, subjectUserId: userId, queue: 'COMMENTS', severity: 'MEDIUM', signals: evaluation.signals, reasons: evaluation.decision.reasons });
    } else {
      SocialEvents.kickAfterCommit(comment.__eventIds);
    }
    return (await this.toViews([comment], userId))[0]!;
  }

  public static async list(viewerId: string | null, publicId: string, params: { parentId?: string; cursor?: string; limit: number }): Promise<SocialCursorPage<SocialCommentView>> {
    const content = await SocialContentService.getAccessible(viewerId, publicId);
    const hidden = viewerId ? await RelationshipReader.blockedEitherWaySet(viewerId) : new Set<string>();
    const muted = viewerId ? (await RelationshipReader.mutedTargets(viewerId, 'COMMENTS')).users : new Set<string>();
    const excluded = [...new Set([...hidden, ...muted])];
    const c = decodeCursor(params.cursor);

    // Oldest-first reading order for threads.
    const rows = await prisma.socialComment.findMany({
      where: {
        contentId: content.id,
        parentId: params.parentId ?? null,
        ...(excluded.length ? { NOT: { authorUserId: { in: excluded } } } : {}),
        // Separate AND clauses: status visibility and keyset position must BOTH hold.
        AND: [
          { OR: [{ status: 'PUBLISHED' }, ...(viewerId ? [{ authorUserId: viewerId, status: 'PENDING_MODERATION' as const }] : [])] },
          ...(c ? [{ OR: [{ createdAt: { gt: new Date(c.t) } }, { createdAt: new Date(c.t), id: { gt: c.id } }] }] : []),
        ],
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: params.limit + 1,
    });
    const page = toPage(rows, params.limit, (r) => ({ at: r.createdAt, id: r.id }));
    return { items: await this.toViews(page.items, viewerId), nextCursor: page.nextCursor };
  }

  public static async edit(userId: string, commentId: string, body: string): Promise<SocialCommentView> {
    const config = await SocialPolicyService.getConfig();
    const comment = await prisma.socialComment.findUnique({ where: { id: commentId } });
    if (!comment || comment.authorUserId !== userId || comment.deletedAt) throw new NotFoundError('Comment not found', ErrorCode.SOCIAL_COMMENT_NOT_FOUND);
    if (comment.status !== 'PUBLISHED' && comment.status !== 'PENDING_MODERATION') throw new ForbiddenError('This comment can no longer be edited.');
    if (Date.now() - comment.createdAt.getTime() > config.comments.editWindowMinutes * 60_000) throw new ForbiddenError('The edit window for this comment has passed.');

    const evaluation = SocialContentSafetyService.evaluateText(body, { surface: 'COMMENT', maxLinks: config.comments.maxLinks });
    if (evaluation.decision.action === 'BLOCK') throw new AppError(evaluation.decision.userMessage ?? 'Not allowed', 422, ErrorCode.SOCIAL_CONTENT_REJECTED);
    const needsHuman = evaluation.decision.action === 'REQUIRE_MODERATION';

    const updated = await prisma.$transaction(async (tx) => {
      const wasVisible = comment.status === 'PUBLISHED';
      const row = await tx.socialComment.update({
        where: { id: commentId },
        data: {
          body: evaluation.sanitizedText,
          editedAt: new Date(),
          status: needsHuman ? 'PENDING_MODERATION' : comment.status,
          moderationReasons: evaluation.decision.reasons.length ? evaluation.decision.reasons : Prisma.JsonNull,
        },
      });
      if (wasVisible && needsHuman) {
        await tx.socialContent.update({ where: { id: comment.contentId }, data: { commentCount: { decrement: 1 } } });
        if (comment.parentId) await tx.socialComment.update({ where: { id: comment.parentId }, data: { replyCount: { decrement: 1 } } });
      }
      return row;
    });
    if (needsHuman) {
      await SocialModerationService.openAutomatedCase({ targetType: 'COMMENT', targetId: commentId, subjectUserId: userId, queue: 'COMMENTS', severity: 'MEDIUM', signals: { ...evaluation.signals, stage: 'edit' }, reasons: evaluation.decision.reasons });
    }
    return (await this.toViews([updated], userId))[0]!;
  }

  /** Author deletes own comment, or the content owner removes a comment from their content. */
  public static async delete(userId: string, commentId: string): Promise<{ deleted: boolean }> {
    const comment = await prisma.socialComment.findUnique({ where: { id: commentId }, include: { content: { select: { authorUserId: true } } } });
    if (!comment || comment.deletedAt) return { deleted: false };
    const isAuthor = comment.authorUserId === userId;
    const isContentOwner = comment.content.authorUserId === userId;
    if (!isAuthor && !isContentOwner) throw new NotFoundError('Comment not found', ErrorCode.SOCIAL_COMMENT_NOT_FOUND);

    await prisma.$transaction(async (tx) => {
      const res = await tx.socialComment.updateMany({ where: { id: commentId, deletedAt: null }, data: { status: isAuthor ? 'DELETED' : 'REMOVED', deletedAt: new Date() } });
      if (res.count === 1 && comment.status === 'PUBLISHED') {
        await tx.socialContent.update({ where: { id: comment.contentId }, data: { commentCount: { decrement: 1 } } });
        if (comment.parentId) await tx.socialComment.update({ where: { id: comment.parentId }, data: { replyCount: { decrement: 1 } } });
      }
    });
    if (!isAuthor) await AuditService.log({ actorType: 'USER', actorId: userId, action: 'SOCIAL_COMMENT_REMOVED_BY_OWNER', resourceType: 'social_comment', resourceId: commentId });
    return { deleted: true };
  }

  public static async toViews(rows: SocialComment[], viewerId: string | null): Promise<SocialCommentView[]> {
    const config = await SocialPolicyService.getConfig();
    const [cards, characters] = await Promise.all([
      SocialProfileService.cards(rows.map((r) => r.authorUserId)),
      prisma.character.findMany({ where: { id: { in: rows.map((r) => r.characterId).filter((x): x is string => !!x) } }, select: { id: true, slug: true, name: true, avatarUrl: true } }),
    ]);
    return rows.map((r) => {
      const ch = characters.find((c) => c.id === r.characterId);
      const isOwner = !!viewerId && r.authorUserId === viewerId;
      const visibleBody = r.status === 'PUBLISHED' || (isOwner && r.status === 'PENDING_MODERATION');
      return {
        id: r.id,
        author: r.authorUserId ? cards.get(r.authorUserId) ?? null : null,
        character: ch ? { slug: ch.slug, name: ch.name, avatarUrl: ch.avatarUrl, isAi: true as const } : null,
        attribution: r.authorType === 'AI_CHARACTER' ? 'AI_GENERATED' : r.authorType === 'CREATOR' ? 'CREATOR_WROTE_THIS' : 'USER_SHARED',
        parentId: r.parentId,
        body: visibleBody ? r.body : null,
        status: r.status,
        replyCount: r.replyCount,
        isOwner,
        canEdit: isOwner && Date.now() - r.createdAt.getTime() <= config.comments.editWindowMinutes * 60_000,
        isEdited: !!r.editedAt,
        createdAt: r.createdAt.toISOString(),
      };
    });
  }
}

