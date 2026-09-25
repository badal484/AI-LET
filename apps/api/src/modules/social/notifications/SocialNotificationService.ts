import { prisma } from '../../../infrastructure/database/prisma.js';
import { redis } from '../../../infrastructure/redis/redis.js';
import { QueueManager } from '../../../infrastructure/queues/QueueManager.js';
import { logger } from '../../../config/logger.js';
import { InAppNotificationService } from '../../notifications/services/InAppNotificationService.js';
import { SocialAccessService } from '../access/SocialAccessService.js';
import { SocialConsentService } from '../consent/SocialConsentService.js';
import { SocialPolicyService } from '../policy/SocialPolicyService.js';
import { SocialProfileService } from '../identity/SocialProfileService.js';
import { RelationshipReader } from '../graph/RelationshipReader.js';
import { type SocialDomainEvent, SocialEvents, type SocialEventPayload } from '../shared/SocialEvents.js';

export type SocialNotificationType =
  | 'new_follower'
  | 'follow_request'
  | 'follow_accepted'
  | 'reaction'
  | 'comment'
  | 'comment_reply'
  | 'mention'
  | 'community'
  | 'message_request'
  | 'creator_update'
  | 'character_update'
  | 'moderation';

/** Category used for per-category mutes (`UserMute.NOTIFICATION_CATEGORY`). */
const CATEGORY: Record<SocialNotificationType, string> = {
  new_follower: 'new_follower',
  follow_request: 'follow_request',
  follow_accepted: 'new_follower',
  reaction: 'reaction',
  comment: 'comment',
  comment_reply: 'comment',
  mention: 'mention',
  community: 'community',
  message_request: 'message_request',
  creator_update: 'creator_update',
  character_update: 'character_update',
  moderation: 'moderation',
};

/** Types that are aggregated inside the window (bursty, low individual value). */
const AGGREGATED: ReadonlySet<SocialNotificationType> = new Set(['reaction', 'new_follower', 'comment']);

export interface SocialNotifyInput {
  recipientId: string;
  actorId: string | null;
  type: SocialNotificationType;
  /** Stable key for aggregation, e.g. `reaction:{contentPublicId}`. */
  aggregateKey: string;
  deepLink: string;
  /** Template params for the client (i18n) and the English fallback. */
  params?: Record<string, string | number>;
}

function englishCopy(type: SocialNotificationType, count: number, actor: string | null, params: Record<string, string | number>): { title: string; body: string } {
  const who = actor ?? 'Someone';
  const others = count > 1 ? `${who} and ${count - 1} other${count - 1 === 1 ? '' : 's'}` : who;
  switch (type) {
    case 'new_follower':
      return { title: 'New follower', body: `${others} started following you.` };
    case 'follow_request':
      return { title: 'Follow request', body: `${who} wants to follow you.` };
    case 'follow_accepted':
      return { title: 'Request accepted', body: `${who} accepted your follow request.` };
    case 'reaction':
      return { title: 'New reactions', body: count > 1 ? `${count} people reacted to your post.` : `${who} reacted to your post.` };
    case 'comment':
      return { title: 'New comments', body: count > 1 ? `${count} new comments on your post.` : `${who} commented on your post.` };
    case 'comment_reply':
      return { title: 'New reply', body: `${who} replied to your comment.` };
    case 'mention':
      return { title: 'You were mentioned', body: `${who} mentioned you.` };
    case 'community':
      return { title: 'Community invitation', body: `${who} invited you to ${params['community'] ?? 'a community'}.` };
    case 'message_request':
      return { title: 'Message request', body: `${who} wants to send you a message.` };
    case 'creator_update':
      return { title: 'New from a creator you follow', body: `${who} posted an update.` };
    case 'character_update':
      return { title: 'Character update', body: `${params['character'] ?? 'A character you follow'} has an update.` };
    case 'moderation':
      return { title: 'Account notice', body: String(params['message'] ?? 'A moderation decision affects your content.') };
  }
}

export class SocialNotificationService {
  /**
   * Delivers (or aggregates) one social notification after every recipient-side check:
   * feature → consent → block/mute → category mute → daily cap → aggregation window.
   * Returns false when suppressed. Never throws into the caller.
   */
  public static async notify(input: SocialNotifyInput): Promise<boolean> {
    try {
      if (!(await SocialPolicyService.isFeatureEnabled('social_notifications', { userId: input.recipientId }))) return false;
      if (input.type !== 'moderation') {
        if (!(await SocialConsentService.isGranted(input.recipientId, 'SOCIAL_NOTIFICATIONS'))) return false;
        const access = await SocialAccessService.canReceiveNotificationFrom(input.recipientId, input.actorId);
        if (!access.allowed) return false;
        const mutes = await RelationshipReader.mutedTargets(input.recipientId, 'NOTIFICATIONS');
        if (mutes.categories.has(CATEGORY[input.type])) return false;
      }

      const config = await SocialPolicyService.getConfig();
      const actorCard = input.actorId ? (await SocialProfileService.cards([input.actorId])).get(input.actorId) ?? null : null;
      const actorName = actorCard ? actorCard.displayName : null;
      const params = input.params ?? {};

      if (AGGREGATED.has(input.type)) {
        const aggregated = await this.tryAggregate(input, actorCard?.publicId ?? null, actorName, params, config.notifications.aggregationWindowSeconds);
        if (aggregated) return true;
      }

      if (input.type !== 'moderation' && !(await this.withinDailyCap(input.recipientId, config.notifications.maxSocialPerRecipientPerDay))) return false;

      const copy = englishCopy(input.type, 1, actorName, params);
      const created = await InAppNotificationService.createNotification({
        userId: input.recipientId,
        category: 'social',
        title: copy.title,
        body: copy.body,
        deepLink: input.deepLink,
        data: { socialType: input.type, i18nKey: `social.notification.${input.type}`, count: 1, actors: actorCard ? [actorCard.publicId] : [], params },
        sourceType: 'social',
        sourceId: input.aggregateKey.slice(0, 100),
      });
      if (AGGREGATED.has(input.type)) {
        await redis.set(this.aggKey(input), created.id, 'EX', config.notifications.aggregationWindowSeconds).catch(() => undefined);
      }
      return true;
    } catch (err) {
      logger.warn('[SocialNotifications] delivery failed (non-fatal)', { error: err instanceof Error ? err.message : err, type: input.type });
      return false;
    }
  }

  private static aggKey(input: SocialNotifyInput): string {
    return `social:notif:agg:${input.recipientId}:${input.aggregateKey}`;
  }

  private static async tryAggregate(
    input: SocialNotifyInput,
    actorPublicId: string | null,
    actorName: string | null,
    params: Record<string, string | number>,
    windowSeconds: number,
  ): Promise<boolean> {
    let notificationId: string | null = null;
    try {
      notificationId = await redis.get(this.aggKey(input));
    } catch {
      notificationId = null;
    }
    if (!notificationId) return false;
    const existing = await prisma.inAppNotification.findFirst({ where: { id: notificationId, userId: input.recipientId, isRead: false } });
    if (!existing) return false;

    const data = (existing.data as { count?: number; actors?: string[] } | null) ?? {};
    const actors = new Set(data.actors ?? []);
    if (actorPublicId) {
      if (actors.has(actorPublicId) && input.type !== 'comment') return true; // same actor again: nothing new to say
      actors.add(actorPublicId);
    }
    const count = (data.count ?? 1) + 1;
    const copy = englishCopy(input.type, count, actorName, params);
    await prisma.inAppNotification.update({
      where: { id: existing.id },
      data: { title: copy.title, body: copy.body, data: { ...(existing.data as object), count, actors: [...actors].slice(-5) } },
    });
    await redis.expire(this.aggKey(input), windowSeconds).catch(() => undefined);
    return true;
  }

  private static async withinDailyCap(recipientId: string, cap: number): Promise<boolean> {
    const key = `social:notif:cap:${recipientId}:${new Date().toISOString().slice(0, 10)}`;
    try {
      const n = await redis.incr(key);
      if (n === 1) await redis.expire(key, 90_000);
      return n <= cap;
    } catch {
      return true;
    }
  }

  // ---------------------------------------------------------------------------
  // Fanout (never synchronous in the request path)
  // ---------------------------------------------------------------------------

  public static async enqueueFanout(job: { kind: 'creator_update' | 'character_update'; actorId: string; contentPublicId: string; characterId?: string | null }): Promise<void> {
    await QueueManager.addJob('social-fanout', job.kind, { ...job, cursor: null }, { priority: 'LOW', idempotencyKey: `fanout.${job.kind}.${job.contentPublicId}` }).catch((err) =>
      logger.warn('[SocialNotifications] failed to enqueue fanout', { error: err }),
    );
  }

  /** Processes one batch and re-enqueues itself with a cursor, so huge audiences never block a worker. */
  public static async processFanoutBatch(job: { kind: 'creator_update' | 'character_update'; actorId: string; contentPublicId: string; characterId?: string | null; cursor: string | null }): Promise<{ processed: number; nextCursor: string | null }> {
    const config = await SocialPolicyService.getConfig();
    const batch = config.notifications.fanoutBatchSize;
    let recipients: Array<{ id: string; userId: string }> = [];
    if (job.kind === 'creator_update') {
      const creator = await prisma.creatorProfile.findUnique({ where: { userId: job.actorId }, select: { id: true } });
      if (!creator) return { processed: 0, nextCursor: null };
      recipients = await prisma.creatorFollow.findMany({
        where: { creatorProfileId: creator.id, notificationsEnabled: true, ...(job.cursor ? { id: { gt: job.cursor } } : {}) },
        orderBy: { id: 'asc' },
        take: batch,
        select: { id: true, userId: true },
      });
    } else if (job.characterId) {
      recipients = await prisma.characterFollow.findMany({
        where: { characterId: job.characterId, notificationsEnabled: true, ...(job.cursor ? { id: { gt: job.cursor } } : {}) },
        orderBy: { id: 'asc' },
        take: batch,
        select: { id: true, userId: true },
      });
    }
    for (const r of recipients) {
      await this.notify({
        recipientId: r.userId,
        actorId: job.kind === 'creator_update' ? job.actorId : null,
        type: job.kind,
        aggregateKey: `${job.kind}:${job.contentPublicId}`,
        deepLink: `/p/${job.contentPublicId}`,
      });
    }
    const nextCursor = recipients.length === batch ? recipients[recipients.length - 1]!.id : null;
    if (nextCursor) {
      await QueueManager.addJob('social-fanout', job.kind, { ...job, cursor: nextCursor }, { priority: 'LOW', idempotencyKey: `fanout.${job.kind}.${job.contentPublicId}.${nextCursor}` });
    }
    return { processed: recipients.length, nextCursor };
  }

  // ---------------------------------------------------------------------------
  // Domain event wiring
  // ---------------------------------------------------------------------------

  private static registered = false;

  /** Idempotent: safe to call from both the API and the worker process. */
  public static registerHandlers(): void {
    const onEvent = (event: SocialDomainEvent, handler: Parameters<typeof SocialEvents.on>[1]) => SocialEvents.on(event, handler, `notifications:${event}`);
    if (this.registered) return;
    this.registered = true;

    const profileLink = async (userId: string | null | undefined) => {
      if (!userId) return '/social';
      const card = (await SocialProfileService.cards([userId])).get(userId);
      return card ? `/u/${card.username ?? card.publicId}` : '/social';
    };

    onEvent('UserFollowed', async (p: SocialEventPayload) => {
      if (!p.recipientUserId) return;
      await this.notify({ recipientId: p.recipientUserId, actorId: p.actorUserId ?? null, type: 'new_follower', aggregateKey: 'new_follower', deepLink: await profileLink(p.actorUserId) });
    });
    onEvent('FollowRequested', async (p) => {
      if (!p.recipientUserId) return;
      await this.notify({ recipientId: p.recipientUserId, actorId: p.actorUserId ?? null, type: 'follow_request', aggregateKey: `follow_request:${p.actorUserId}`, deepLink: '/social/follow-requests' });
    });
    onEvent('FollowAccepted', async (p) => {
      if (!p.recipientUserId) return;
      await this.notify({ recipientId: p.recipientUserId, actorId: p.actorUserId ?? null, type: 'follow_accepted', aggregateKey: `follow_accepted:${p.actorUserId}`, deepLink: await profileLink(p.actorUserId) });
    });
    onEvent('ReactionCreated', async (p) => {
      if (!p.recipientUserId || !p.contentId) return;
      await this.notify({ recipientId: p.recipientUserId, actorId: p.actorUserId ?? null, type: 'reaction', aggregateKey: `reaction:${p.contentId}`, deepLink: `/p/${p.contentId}` });
    });
    onEvent('CommentCreated', async (p) => {
      const internal = p.internal as { parentAuthorId?: string | null; commentId?: string } | undefined;
      if (p.recipientUserId && p.contentId) {
        await this.notify({ recipientId: p.recipientUserId, actorId: p.actorUserId ?? null, type: 'comment', aggregateKey: `comment:${p.contentId}`, deepLink: `/p/${p.contentId}?comment=${internal?.commentId ?? ''}` });
      }
      if (internal?.parentAuthorId && internal.parentAuthorId !== p.recipientUserId) {
        await this.notify({ recipientId: internal.parentAuthorId, actorId: p.actorUserId ?? null, type: 'comment_reply', aggregateKey: `reply:${internal.commentId}`, deepLink: `/p/${p.contentId}?comment=${internal.commentId ?? ''}` });
      }
    });
    onEvent('UserMentioned', async (p) => {
      if (!p.recipientUserId) return;
      await this.notify({ recipientId: p.recipientUserId, actorId: p.actorUserId ?? null, type: 'mention', aggregateKey: `mention:${p.contentId}:${p.actorUserId}`, deepLink: p.contentId ? `/p/${p.contentId}` : '/social' });
    });
    onEvent('MessageRequestSent', async (p) => {
      if (!p.recipientUserId) return;
      await this.notify({ recipientId: p.recipientUserId, actorId: p.actorUserId ?? null, type: 'message_request', aggregateKey: `message_request:${p.actorUserId}`, deepLink: '/messages/requests' });
    });
    onEvent('CommunityInvited', async (p) => {
      if (!p.recipientUserId) return;
      const internal = p.internal as { slug?: string; name?: string } | undefined;
      await this.notify({ recipientId: p.recipientUserId, actorId: p.actorUserId ?? null, type: 'community', aggregateKey: `community_invite:${internal?.slug}`, deepLink: `/community/${internal?.slug ?? ''}`, params: { community: internal?.name ?? 'a community' } });
    });
    onEvent('ModerationActioned', async (p) => {
      const internal = p.internal as { message?: string | null; caseId?: string } | undefined;
      if (!p.recipientUserId || !internal?.message) return;
      await this.notify({ recipientId: p.recipientUserId, actorId: null, type: 'moderation', aggregateKey: `moderation:${internal.caseId}`, deepLink: '/settings/social/enforcement', params: { message: internal.message } });
    });
    onEvent('ContentPublished', async (p) => {
      if (!p.actorUserId || !p.contentId || p.visibility !== 'PUBLIC') return;
      if (p.contentType === 'CREATOR_POST') await this.enqueueFanout({ kind: 'creator_update', actorId: p.actorUserId, contentPublicId: p.contentId, characterId: p.characterId });
      if (p.contentType === 'CHARACTER_POST' && p.characterId) await this.enqueueFanout({ kind: 'character_update', actorId: p.actorUserId, contentPublicId: p.contentId, characterId: p.characterId });
    });
  }
}
