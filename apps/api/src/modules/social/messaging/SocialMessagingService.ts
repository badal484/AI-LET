import { Prisma, type SocialDirectMessage } from '@prisma/client';
import { ErrorCode } from '@ai-companion/config';
import type { SocialCursorPage, SocialDirectMessageView, SocialMessageRequestView, SocialThreadView } from '@ai-companion/types';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { redis } from '../../../infrastructure/redis/redis.js';
import { AuditService } from '../../audit/audit.service.js';
import { AppError, BadRequestError, ForbiddenError, NotFoundError } from '../../../shared/errors/AppError.js';
import { SocialAccessService } from '../access/SocialAccessService.js';
import { SocialProfileService } from '../identity/SocialProfileService.js';
import { SocialPolicyService } from '../policy/SocialPolicyService.js';
import { SocialAbuseService } from '../safety/SocialAbuseService.js';
import { SocialRateLimiter } from '../safety/SocialRateLimiter.js';
import { SocialContentSafetyService } from '../safety/SocialContentSafetyService.js';
import { SocialGraphService } from '../graph/SocialGraphService.js';
import { RelationshipReader } from '../graph/RelationshipReader.js';
import { SocialEvents } from '../shared/SocialEvents.js';
import { decodeCursor, keysetAfter, pairKey, toPage } from '../shared/ids.js';

const THREAD_NOT_FOUND = () => new NotFoundError('Conversation not found');

/**
 * Human-to-human messaging. Separate from the AI Conversation model: different privacy,
 * moderation and retention rules. AI never sends messages here on a user's behalf.
 */
export class SocialMessagingService {
  private static async assertMessagingEnabled(userId: string): Promise<void> {
    await SocialPolicyService.assertFeature('messaging', { userId });
    await SocialProfileService.requireOwnProfile(userId);
    await SocialAbuseService.assertCapability(userId, 'DIRECT_MESSAGE');
  }

  private static async participant(threadId: string, userId: string) {
    const p = await prisma.socialDirectParticipant.findUnique({ where: { threadId_userId: { threadId, userId } }, include: { thread: true } });
    // Non-participants always get not-found (no IDOR, no thread enumeration).
    if (!p) throw THREAD_NOT_FOUND();
    return p;
  }

  private static async counterpartId(threadId: string, userId: string): Promise<string> {
    const other = await prisma.socialDirectParticipant.findFirst({ where: { threadId, userId: { not: userId } }, select: { userId: true } });
    if (!other) throw THREAD_NOT_FOUND();
    return other.userId;
  }

  private static assertNoAttachments(attachments?: Array<{ uploadId: string }>): void {
    if (attachments && attachments.length > 0) {
      // Attachments must flow through the media pipeline (MIME sniffing, malware scan, EXIF strip,
      // moderation, signed URLs) before they can be enabled for DMs.
      throw new AppError("Attachments aren't available in messages yet.", 400, ErrorCode.SOCIAL_FEATURE_DISABLED);
    }
  }

  // ---------------------------------------------------------------------------
  // Starting conversations (direct for mutuals, request otherwise)
  // ---------------------------------------------------------------------------

  public static async startConversation(
    senderId: string,
    input: { to: string; message: string; clientMessageId: string },
    requestId?: string,
  ): Promise<{ mode: 'DIRECT' | 'REQUEST'; threadId: string; requestId: string | null }> {
    await this.assertMessagingEnabled(senderId);
    const recipient = await SocialProfileService.resolveOrThrow(input.to);
    const access = await SocialAccessService.canStartConversation(senderId, recipient.userId);
    if (!access.allowed) {
      if (access.reason === 'BLOCKED' || access.reason === 'NO_PROFILE') throw new NotFoundError('Profile not found', ErrorCode.SOCIAL_USER_NOT_FOUND);
      throw new ForbiddenError(access.userMessage ?? "You can't message this person.", ErrorCode.SOCIAL_MESSAGE_NOT_PERMITTED);
    }

    const key = pairKey(senderId, recipient.userId);
    const existing = await prisma.socialDirectThread.findUnique({ where: { pairKey: key } });
    if (existing && existing.status === 'ACTIVE') {
      await this.send(senderId, existing.id, { body: input.message, clientMessageId: input.clientMessageId }, requestId);
      return { mode: 'DIRECT', threadId: existing.id, requestId: null };
    }

    if (!access.direct) {
      await SocialPolicyService.assertFeature('message_requests', { userId: senderId });
      const config = await SocialPolicyService.getConfig();
      const account = await prisma.user.findUnique({ where: { id: senderId }, select: { createdAt: true } });
      await SocialRateLimiter.enforce('message_request', senderId, { accountCreatedAt: account?.createdAt });
      const pendingOutgoing = await prisma.socialMessageRequest.count({ where: { senderUserId: senderId, status: 'PENDING' } });
      if (pendingOutgoing >= config.messaging.maxPendingOutgoingRequests) {
        throw new AppError('You have too many pending message requests. Wait for replies before sending more.', 429, ErrorCode.SOCIAL_RATE_LIMITED);
      }
      const declinedRecently = await prisma.socialMessageRequest.count({
        where: { senderUserId: senderId, recipientUserId: recipient.userId, status: { in: ['DECLINED', 'BLOCKED'] }, respondedAt: { gt: new Date(Date.now() - 30 * 86_400_000) } },
      });
      if (declinedRecently > 0) throw new ForbiddenError("You can't send another request to this person right now.", ErrorCode.SOCIAL_MESSAGE_NOT_PERMITTED);
    }

    const evaluation = SocialContentSafetyService.evaluateText(input.message, { surface: access.direct ? 'DIRECT_MESSAGE' : 'MESSAGE_REQUEST', maxLinks: access.direct ? undefined : 0 });
    if (evaluation.decision.action === 'BLOCK') throw new AppError(evaluation.decision.userMessage ?? 'Message not allowed', 422, ErrorCode.SOCIAL_CONTENT_REJECTED);
    const flagged = evaluation.decision.action === 'REQUIRE_MODERATION';
    const config = await SocialPolicyService.getConfig();

    try {
      const result = await prisma.$transaction(async (tx) => {
        const thread =
          existing ??
          (await tx.socialDirectThread.create({
            data: {
              pairKey: key,
              status: access.direct ? 'ACTIVE' : 'REQUESTED',
              participants: { create: [{ userId: senderId }, { userId: recipient.userId }] },
            },
          }));
        if (existing && access.direct) await tx.socialDirectThread.update({ where: { id: existing.id }, data: { status: 'ACTIVE' } });
        if (existing && !access.direct && existing.status === 'CLOSED') await tx.socialDirectThread.update({ where: { id: existing.id }, data: { status: 'REQUESTED' } });

        let reqId: string | null = null;
        if (!access.direct) {
          const req = await tx.socialMessageRequest.create({
            data: {
              senderUserId: senderId,
              recipientUserId: recipient.userId,
              threadId: thread.id,
              pendingKey: `${senderId}:${recipient.userId}`,
              expiresAt: new Date(Date.now() + config.messaging.requestExpiryDays * 86_400_000),
            },
          });
          reqId = req.id;
        }
        await tx.socialDirectMessage.create({
          data: {
            threadId: thread.id,
            senderUserId: senderId,
            clientMessageId: input.clientMessageId,
            body: evaluation.sanitizedText,
            moderationStatus: flagged ? 'FLAGGED' : 'APPROVED',
          },
        });
        await tx.socialDirectThread.update({ where: { id: thread.id }, data: { lastMessageAt: new Date() } });
        if (access.direct) {
          await tx.socialDirectParticipant.update({ where: { threadId_userId: { threadId: thread.id, userId: recipient.userId } }, data: { unreadCount: { increment: 1 } } });
        }
        const eventId = await SocialEvents.record(tx, access.direct ? 'DirectMessageSent' : 'MessageRequestSent', { actorUserId: senderId, recipientUserId: recipient.userId, requestId });
        return { threadId: thread.id, requestId: reqId, eventId };
      });

      SocialEvents.kickAfterCommit([result.eventId]);
      return { mode: access.direct ? 'DIRECT' : 'REQUEST', threadId: result.threadId, requestId: result.requestId };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        // Either a duplicate clientMessageId (retry) or an already-pending request: both are idempotent.
        const thread = await prisma.socialDirectThread.findUnique({ where: { pairKey: key }, select: { id: true } });
        const pending = await prisma.socialMessageRequest.findUnique({ where: { pendingKey: `${senderId}:${recipient.userId}` }, select: { id: true } });
        if (thread) return { mode: pending ? 'REQUEST' : 'DIRECT', threadId: thread.id, requestId: pending?.id ?? null };
      }
      throw err;
    }
  }

  public static async listRequests(userId: string, direction: 'incoming' | 'outgoing', cursor: string | undefined, limit: number): Promise<SocialCursorPage<SocialMessageRequestView>> {
    await this.expireStaleRequests();
    const rows = await prisma.socialMessageRequest.findMany({
      where: { ...(direction === 'incoming' ? { recipientUserId: userId } : { senderUserId: userId }), status: 'PENDING', ...keysetAfter(decodeCursor(cursor)) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const page = toPage(rows, limit, (r) => ({ at: r.createdAt, id: r.id }));
    const hidden = await RelationshipReader.blockedEitherWaySet(userId);
    const visible = page.items.filter((r) => !hidden.has(direction === 'incoming' ? r.senderUserId : r.recipientUserId));
    const cards = await SocialProfileService.cards(visible.flatMap((r) => [r.senderUserId, r.recipientUserId]));
    const firstMessages = await prisma.socialDirectMessage.findMany({
      where: { threadId: { in: visible.map((r) => r.threadId) }, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      distinct: ['threadId'],
      select: { threadId: true, body: true, moderationStatus: true },
    });
    return {
      items: visible
        .filter((r) => cards.get(r.senderUserId) && cards.get(r.recipientUserId))
        .map((r) => {
          const m = firstMessages.find((x) => x.threadId === r.threadId);
          return {
            id: r.id,
            from: cards.get(r.senderUserId)!,
            to: cards.get(r.recipientUserId)!,
            // Flagged requests are collapsed: recipients opt in to view them.
            preview: m && m.moderationStatus !== 'FLAGGED' ? m.body.slice(0, 200) : null,
            status: r.status,
            expiresAt: r.expiresAt.toISOString(),
            createdAt: r.createdAt.toISOString(),
          };
        }),
      nextCursor: page.nextCursor,
    };
  }

  public static async respondToRequest(recipientId: string, requestId: string, action: 'ACCEPT' | 'DECLINE' | 'BLOCK'): Promise<{ status: string; threadId: string | null }> {
    const req = await prisma.socialMessageRequest.findUnique({ where: { id: requestId } });
    if (!req || req.recipientUserId !== recipientId || req.status !== 'PENDING') throw new NotFoundError('Request not found');
    if (req.expiresAt < new Date()) {
      await prisma.socialMessageRequest.update({ where: { id: req.id }, data: { status: 'EXPIRED', pendingKey: null } });
      throw new AppError('This request has expired.', 410, ErrorCode.SOCIAL_SHARE_EXPIRED);
    }

    if (action === 'BLOCK') {
      const sender = await prisma.socialProfile.findUnique({ where: { userId: req.senderUserId }, select: { publicId: true } });
      if (sender) await SocialGraphService.block(recipientId, sender.publicId, 'message_request');
      await prisma.socialDirectThread.update({ where: { id: req.threadId }, data: { status: 'CLOSED' } });
      return { status: 'BLOCKED', threadId: null };
    }
    if (action === 'DECLINE') {
      await prisma.$transaction([
        prisma.socialMessageRequest.update({ where: { id: req.id }, data: { status: 'DECLINED', pendingKey: null, respondedAt: new Date() } }),
        prisma.socialDirectThread.update({ where: { id: req.threadId }, data: { status: 'CLOSED' } }),
      ]);
      return { status: 'DECLINED', threadId: null };
    }

    if (await RelationshipReader.hasBlockEitherWay(recipientId, req.senderUserId)) throw new NotFoundError('Request not found');
    await prisma.$transaction(async (tx) => {
      await tx.socialMessageRequest.update({ where: { id: req.id }, data: { status: 'ACCEPTED', pendingKey: null, respondedAt: new Date() } });
      await tx.socialDirectThread.update({ where: { id: req.threadId }, data: { status: 'ACTIVE' } });
      const pendingForRecipient = await tx.socialDirectMessage.count({ where: { threadId: req.threadId, senderUserId: req.senderUserId, deletedAt: null } });
      await tx.socialDirectParticipant.update({ where: { threadId_userId: { threadId: req.threadId, userId: recipientId } }, data: { unreadCount: pendingForRecipient } });
    });
    SocialEvents.emit('MessageRequestAccepted', { actorUserId: recipientId, recipientUserId: req.senderUserId });
    return { status: 'ACCEPTED', threadId: req.threadId };
  }

  public static async expireStaleRequests(): Promise<number> {
    const res = await prisma.socialMessageRequest.updateMany({ where: { status: 'PENDING', expiresAt: { lt: new Date() } }, data: { status: 'EXPIRED', pendingKey: null } });
    return res.count;
  }

  // ---------------------------------------------------------------------------
  // Threads & messages
  // ---------------------------------------------------------------------------

  public static async listThreads(userId: string, cursor: string | undefined, limit: number): Promise<SocialCursorPage<SocialThreadView>> {
    const c = decodeCursor(cursor);
    const rows = await prisma.socialDirectParticipant.findMany({
      where: {
        userId,
        isArchived: false,
        thread: {
          lastMessageAt: { not: null },
          AND: [
            // A requester sees their pending thread; a recipient only sees it once accepted (requests live in the requests inbox).
            { OR: [{ status: 'ACTIVE' }, { status: 'REQUESTED', requests: { some: { senderUserId: userId, status: 'PENDING' } } }] },
            ...(c ? [{ OR: [{ lastMessageAt: { lt: new Date(c.t) } }, { lastMessageAt: new Date(c.t), id: { lt: c.id } }] }] : []),
          ],
        },
      },
      include: { thread: true },
      orderBy: [{ thread: { lastMessageAt: 'desc' } }, { threadId: 'desc' }],
      take: limit + 1,
    });
    const page = toPage(rows, limit, (r) => ({ at: r.thread.lastMessageAt!, id: r.threadId }));
    const others = await prisma.socialDirectParticipant.findMany({ where: { threadId: { in: page.items.map((r) => r.threadId) }, userId: { not: userId } }, select: { threadId: true, userId: true } });
    const hidden = await RelationshipReader.blockedEitherWaySet(userId);
    const cards = await SocialProfileService.cards(others.map((o) => o.userId));
    const lastMessages = await prisma.socialDirectMessage.findMany({
      where: { threadId: { in: page.items.map((r) => r.threadId) }, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      distinct: ['threadId'],
      select: { threadId: true, body: true, moderationStatus: true },
    });
    const items: SocialThreadView[] = [];
    for (const r of page.items) {
      const other = others.find((o) => o.threadId === r.threadId);
      if (!other || hidden.has(other.userId)) continue;
      const card = cards.get(other.userId);
      if (!card) continue;
      const last = lastMessages.find((m) => m.threadId === r.threadId);
      items.push({
        id: r.threadId,
        status: r.thread.status,
        counterpart: card,
        unreadCount: r.unreadCount,
        lastMessageAt: r.thread.lastMessageAt?.toISOString() ?? null,
        lastMessagePreview: last && last.moderationStatus !== 'FLAGGED' ? last.body.slice(0, 120) : null,
      });
    }
    return { items, nextCursor: page.nextCursor };
  }

  public static async listMessages(userId: string, threadId: string, cursor: string | undefined, limit: number): Promise<SocialCursorPage<SocialDirectMessageView> & { counterpartTyping: boolean }> {
    const p = await this.participant(threadId, userId);
    const other = await this.counterpartId(threadId, userId);
    if (p.thread.status === 'REQUESTED') {
      const isRequester = await prisma.socialMessageRequest.count({ where: { threadId, senderUserId: userId, status: 'PENDING' } });
      const isRecipient = await prisma.socialMessageRequest.count({ where: { threadId, recipientUserId: userId, status: 'PENDING' } });
      if (!isRequester && !isRecipient) throw THREAD_NOT_FOUND();
    }
    if (await RelationshipReader.hasBlockEitherWay(userId, other)) throw THREAD_NOT_FOUND();

    const rows = await prisma.socialDirectMessage.findMany({
      where: { threadId, ...keysetAfter(decodeCursor(cursor)) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const page = toPage(rows, limit, (r) => ({ at: r.createdAt, id: r.id }));
    // Delivery receipts: everything the viewer can now see from the counterpart is delivered.
    await prisma.socialDirectMessage.updateMany({ where: { threadId, senderUserId: other, status: 'SENT' }, data: { status: 'DELIVERED', deliveredAt: new Date() } });
    let counterpartTyping = false;
    try {
      counterpartTyping = (await redis.get(`social:typing:${threadId}:${other}`)) === '1';
    } catch {
      counterpartTyping = false;
    }
    return { items: page.items.map((m) => this.toView(m, userId)), nextCursor: page.nextCursor, counterpartTyping };
  }

  public static async send(senderId: string, threadId: string, input: { body: string; clientMessageId: string; attachments?: Array<{ uploadId: string }> }, requestId?: string): Promise<SocialDirectMessageView> {
    await this.assertMessagingEnabled(senderId);
    this.assertNoAttachments(input.attachments);
    const p = await this.participant(threadId, senderId);
    const recipientId = await this.counterpartId(threadId, senderId);

    // Idempotent retry: same clientMessageId returns the original message.
    const dup = await prisma.socialDirectMessage.findUnique({ where: { senderUserId_clientMessageId: { senderUserId: senderId, clientMessageId: input.clientMessageId } } });
    if (dup) {
      if (dup.threadId !== threadId) throw new BadRequestError('clientMessageId already used');
      return this.toView(dup, senderId);
    }

    const config = await SocialPolicyService.getConfig();
    if (p.thread.status === 'CLOSED') throw new ForbiddenError("You can't send messages in this conversation.", ErrorCode.SOCIAL_MESSAGE_NOT_PERMITTED);
    if (p.thread.status === 'REQUESTED') {
      const isRequester = await prisma.socialMessageRequest.count({ where: { threadId, senderUserId: senderId, status: 'PENDING' } });
      if (!isRequester) throw new ForbiddenError('Accept the request to reply.', ErrorCode.SOCIAL_MESSAGE_REQUEST_PENDING);
      const sent = await prisma.socialDirectMessage.count({ where: { threadId, senderUserId: senderId } });
      if (sent >= config.messaging.maxMessagesBeforeAccept) throw new ForbiddenError('Wait for them to accept your request before sending more.', ErrorCode.SOCIAL_MESSAGE_REQUEST_PENDING);
    }
    const access = await SocialAccessService.canMessage(senderId, recipientId);
    if (!access.allowed) throw new ForbiddenError(access.userMessage ?? "You can't message this person.", ErrorCode.SOCIAL_MESSAGE_NOT_PERMITTED);
    await SocialRateLimiter.enforce('message_send', senderId);
    if (input.body.length > config.messaging.maxLength) throw new BadRequestError(`Messages can be at most ${config.messaging.maxLength} characters.`);

    const isDuplicate = await SocialAbuseService.isDuplicateContent(senderId, 'dm_fanout', input.body);
    const evaluation = SocialContentSafetyService.evaluateText(input.body, { surface: 'DIRECT_MESSAGE', isDuplicate });
    if (evaluation.decision.action === 'BLOCK') throw new AppError(evaluation.decision.userMessage ?? 'Message not allowed', 422, ErrorCode.SOCIAL_CONTENT_REJECTED);
    // Repeated identical messages across threads is a spam signal, not a block (friends repeat themselves).
    if (isDuplicate) await SocialAbuseService.escalateIfNeeded(senderId, 'DM_REPETITION');

    try {
      const msg = await prisma.$transaction(async (tx) => {
        const row = await tx.socialDirectMessage.create({
          data: {
            threadId,
            senderUserId: senderId,
            clientMessageId: input.clientMessageId,
            body: evaluation.sanitizedText,
            // Flagged DMs are delivered behind a warning instead of being read by moderators (privacy-first).
            moderationStatus: evaluation.decision.action === 'REQUIRE_MODERATION' ? 'FLAGGED' : 'APPROVED',
          },
        });
        await tx.socialDirectThread.update({ where: { id: threadId }, data: { lastMessageAt: row.createdAt } });
        if (p.thread.status === 'ACTIVE') {
          await tx.socialDirectParticipant.update({ where: { threadId_userId: { threadId, userId: recipientId } }, data: { unreadCount: { increment: 1 }, isArchived: false } });
        }
        return row;
      });
      SocialEvents.emit('DirectMessageSent', { actorUserId: senderId, recipientUserId: recipientId, requestId });
      return this.toView(msg, senderId);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const existing = await prisma.socialDirectMessage.findUniqueOrThrow({ where: { senderUserId_clientMessageId: { senderUserId: senderId, clientMessageId: input.clientMessageId } } });
        return this.toView(existing, senderId);
      }
      throw err;
    }
  }

  public static async markRead(userId: string, threadId: string): Promise<{ unreadCount: 0 }> {
    await this.participant(threadId, userId);
    const other = await this.counterpartId(threadId, userId);
    const now = new Date();
    await prisma.$transaction([
      prisma.socialDirectParticipant.update({ where: { threadId_userId: { threadId, userId } }, data: { unreadCount: 0, lastReadAt: now } }),
      prisma.socialDirectMessage.updateMany({ where: { threadId, senderUserId: other, status: { in: ['SENT', 'DELIVERED'] } }, data: { status: 'READ', readAt: now } }),
    ]);
    return { unreadCount: 0 };
  }

  /** Ephemeral typing indicator: short-lived Redis key, no persistent socket required. */
  public static async setTyping(userId: string, threadId: string): Promise<void> {
    const p = await this.participant(threadId, userId);
    if (p.thread.status !== 'ACTIVE') return;
    await redis.set(`social:typing:${threadId}:${userId}`, '1', 'EX', 6).catch(() => undefined);
  }

  public static async deleteMessage(userId: string, messageId: string): Promise<{ deleted: boolean }> {
    const m = await prisma.socialDirectMessage.findUnique({ where: { id: messageId } });
    if (!m || m.senderUserId !== userId) throw new NotFoundError('Message not found');
    if (m.deletedAt) return { deleted: true };
    // If the message is part of an open safety case, the body is retained for investigators (legal/safety hold).
    const underReview = await prisma.socialModerationCase.count({ where: { targetType: 'DIRECT_MESSAGE', targetId: messageId, openKey: { not: null } } });
    await prisma.socialDirectMessage.update({
      where: { id: messageId },
      data: { status: 'DELETED', deletedAt: new Date(), ...(underReview ? {} : { body: '' }) },
    });
    return { deleted: true };
  }

  public static async unreadTotal(userId: string): Promise<number> {
    const agg = await prisma.socialDirectParticipant.aggregate({ where: { userId, isArchived: false, thread: { status: 'ACTIVE' } }, _sum: { unreadCount: true } });
    return agg._sum.unreadCount ?? 0;
  }

  public static toView(m: SocialDirectMessage, viewerId: string): SocialDirectMessageView {
    return {
      id: m.id,
      clientMessageId: m.clientMessageId,
      isMine: m.senderUserId === viewerId,
      body: m.deletedAt || m.status === 'MODERATED' ? null : m.body,
      isFlagged: m.moderationStatus === 'FLAGGED' && m.senderUserId !== viewerId,
      attachments: [],
      status: m.status,
      createdAt: m.createdAt.toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // Break-glass (admin) — metadata by default, content only with purpose + audit
  // ---------------------------------------------------------------------------

  public static async breakGlassRead(adminId: string, input: { caseId: string; purpose: string; justification: string }) {
    const kase = await prisma.socialModerationCase.findUnique({ where: { id: input.caseId } });
    if (!kase || kase.targetType !== 'DIRECT_MESSAGE') throw new NotFoundError('A direct-message case is required for private content access.');
    const reported = await prisma.socialDirectMessage.findUnique({ where: { id: kase.targetId } });
    if (!reported) throw new NotFoundError('Message not found');
    // Minimum necessary: the reported message and a small window of surrounding context.
    const [before, after] = await Promise.all([
      prisma.socialDirectMessage.findMany({ where: { threadId: reported.threadId, createdAt: { lt: reported.createdAt } }, orderBy: { createdAt: 'desc' }, take: 5 }),
      prisma.socialDirectMessage.findMany({ where: { threadId: reported.threadId, createdAt: { gt: reported.createdAt } }, orderBy: { createdAt: 'asc' }, take: 5 }),
    ]);
    await AuditService.log({
      actorType: 'ADMIN',
      actorId: adminId,
      action: 'SOCIAL_PRIVATE_CONTENT_ACCESSED',
      resourceType: 'social_direct_message',
      resourceId: reported.id,
      metadata: { caseId: kase.id, purpose: input.purpose, justification: input.justification, messagesDisclosed: before.length + after.length + 1 },
    });
    const label = (m: SocialDirectMessage) => (m.senderUserId === reported.senderUserId ? 'REPORTED_USER' : 'REPORTER_SIDE');
    return {
      caseId: kase.id,
      messages: [...before.reverse(), reported, ...after].map((m) => ({
        id: m.id,
        sender: label(m),
        body: m.body,
        isReported: m.id === reported.id,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  }
}
