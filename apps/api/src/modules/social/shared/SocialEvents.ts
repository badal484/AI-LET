import crypto from 'crypto';
import { Prisma, type SocialEventOutbox } from '@prisma/client';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../config/logger.js';
import { EventIngestionService } from '../../analytics/services/EventIngestionService.js';

/**
 * Social domain events with a transactional outbox.
 *
 * Producers either
 *   - `record(tx, …)` inside the SAME transaction as the state change (critical events: the event
 *     exists iff the change committed), then `kickAfterCommit(ids)`, or
 *   - `emit(…)` right after a change (best-effort events; persisted before dispatch).
 * Every event is persisted to `social_event_outbox` and dispatched from there. Consumers record a
 * receipt per (event, consumer), so redelivery, relay retries and duplicate dispatch are no-ops.
 * Delivery is at-least-once with no global ordering guarantee: consumers are idempotent and
 * order-insensitive (they re-read current state from PostgreSQL rather than trusting event order).
 */
export type SocialDomainEvent =
  | 'SocialProfileCreated'
  | 'SocialProfileViewed'
  | 'UserFollowed'
  | 'UserUnfollowed'
  | 'FollowRequested'
  | 'FollowAccepted'
  | 'UserBlocked'
  | 'UserUnblocked'
  | 'UserMuted'
  | 'CharacterFollowed'
  | 'ContentShared'
  | 'ContentPublished'
  | 'ContentViewed'
  | 'ContentRemoved'
  | 'ReactionCreated'
  | 'CommentCreated'
  | 'UserMentioned'
  | 'MessageRequestSent'
  | 'MessageRequestAccepted'
  | 'DirectMessageSent'
  | 'CommunityCreated'
  | 'CommunityJoined'
  | 'CommunityInvited'
  | 'ReportCreated'
  | 'ModerationActioned'
  | 'FeedItemImpression'
  | 'FeedItemDismissed'
  | 'CharacterSocialActionExecuted'
  | 'ConsentChanged'
  | 'PrivacySettingsChanged'
  | 'AccountDeleted';

/** Payload schema version for every event. Bump an entry when its payload changes incompatibly. */
export const SOCIAL_EVENT_VERSION = 1;

export interface SocialEventPayload {
  actorUserId?: string | null;
  recipientUserId?: string | null;
  /** Public identifiers / enums only. Never raw user-generated text. */
  contentId?: string | null;
  contentType?: string | null;
  characterId?: string | null;
  creatorId?: string | null;
  communityId?: string | null;
  visibility?: string | null;
  surface?: string | null;
  source?: string | null;
  position?: number | null;
  experimentId?: string | null;
  requestId?: string | null;
  sessionId?: string | null;
  /** Handler-only context (NOT forwarded to analytics). Must not contain user-generated text. */
  internal?: Record<string, unknown>;
}

export interface SocialEventMeta {
  eventId: string;
  eventName: SocialDomainEvent;
  eventVersion: number;
  occurredAt: Date;
}

type Handler = (payload: SocialEventPayload, meta: SocialEventMeta) => Promise<void> | void;

interface Consumer {
  name: string;
  handler: Handler;
}

/** Versioned analytics names (taxonomy is part of the public contract with the data team). */
const ANALYTICS_NAMES: Partial<Record<SocialDomainEvent, string>> = {
  SocialProfileViewed: 'social_profile_viewed',
  UserFollowed: 'social_follow_created',
  UserUnfollowed: 'social_follow_removed',
  UserBlocked: 'social_block_created',
  UserMuted: 'social_mute_created',
  CharacterFollowed: 'social_character_follow_created',
  ContentShared: 'social_content_shared',
  ContentViewed: 'social_content_viewed',
  ReactionCreated: 'social_reaction_created',
  CommentCreated: 'social_comment_created',
  MessageRequestSent: 'social_message_request_sent',
  MessageRequestAccepted: 'social_message_started',
  CommunityJoined: 'social_community_joined',
  ReportCreated: 'social_report_created',
  FeedItemImpression: 'social_feed_item_impression',
  FeedItemDismissed: 'social_feed_item_dismissed',
};

/** High-volume, low-value events go to analytics only and are not persisted to the outbox. */
const ANALYTICS_ONLY: ReadonlySet<SocialDomainEvent> = new Set(['SocialProfileViewed', 'ContentViewed', 'FeedItemImpression']);

const SAFE_PROPERTY_KEYS: Array<keyof SocialEventPayload> = [
  'contentId',
  'contentType',
  'characterId',
  'creatorId',
  'communityId',
  'visibility',
  'surface',
  'source',
  'position',
  'experimentId',
  'requestId',
];

export const MAX_EVENT_ATTEMPTS = 8;
const LEASE_SECONDS = 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class SocialEvents {
  private static consumers = new Map<SocialDomainEvent, Consumer[]>();
  private static pending = new Set<Promise<unknown>>();

  /** Registers a named consumer. The name is the idempotency scope for receipts — keep it stable. */
  public static on(event: SocialDomainEvent, handler: Handler, name?: string): void {
    const list = this.consumers.get(event) ?? [];
    const consumerName = name ?? `${event}:${list.length}`;
    if (list.some((c) => c.name === consumerName)) return;
    list.push({ name: consumerName, handler });
    this.consumers.set(event, list);
  }

  /**
   * Writes the event inside the caller's transaction. Dispatch happens only after commit
   * (via `kickAfterCommit` or the relay) — handlers never observe uncommitted state.
   */
  public static async record(tx: Prisma.TransactionClient, event: SocialDomainEvent, payload: SocialEventPayload): Promise<string> {
    const row = await tx.socialEventOutbox.create({ data: this.toRow(event, payload) });
    return row.id;
  }

  /** Dispatches committed events immediately (best-effort; the relay retries anything missed). */
  public static kickAfterCommit(eventIds: Array<string | null | undefined>): void {
    for (const id of eventIds) if (id) this.track(this.dispatchById(id));
  }

  /** Persist-then-dispatch for events emitted after a change. Fire-and-forget for the caller. */
  public static emit(event: SocialDomainEvent, payload: SocialEventPayload): void {
    if (ANALYTICS_ONLY.has(event)) {
      this.track(this.sendAnalytics(crypto.randomUUID(), event, payload));
      return;
    }
    this.track(
      prisma.socialEventOutbox
        .create({ data: this.toRow(event, payload) })
        .then((row) => this.dispatchRow(row))
        .catch((err) => logger.error(`[SocialEvents] failed to persist ${event}`, { error: err instanceof Error ? err.message : err })),
    );
  }

  /** Awaits in-flight dispatches (tests, graceful shutdown). */
  public static async flush(): Promise<void> {
    while (this.pending.size > 0) await Promise.allSettled([...this.pending]);
  }

  /**
   * Relay: claims due PENDING rows with a lease (SKIP LOCKED, so parallel relays never double-claim)
   * and dispatches them. Returns the number processed.
   */
  public static async relayPending(batchSize = 100): Promise<number> {
    const claimed = await prisma.$queryRaw<Array<{ id: string }>>`
      UPDATE social_event_outbox SET available_at = now() + make_interval(secs => ${LEASE_SECONDS})
      WHERE id IN (
        SELECT id FROM social_event_outbox
        WHERE status = 'PENDING' AND available_at <= now()
        ORDER BY created_at
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id`;
    if (claimed.length === 0) return 0;
    const rows = await prisma.socialEventOutbox.findMany({ where: { id: { in: claimed.map((c) => c.id) } }, orderBy: { createdAt: 'asc' } });
    for (const row of rows) await this.dispatchRow(row);
    return rows.length;
  }

  public static async stats(): Promise<{ pending: number; dead: number; oldestPendingSeconds: number | null }> {
    const [pending, dead, oldest] = await Promise.all([
      prisma.socialEventOutbox.count({ where: { status: 'PENDING' } }),
      prisma.socialEventOutbox.count({ where: { status: 'DEAD' } }),
      prisma.socialEventOutbox.findFirst({ where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
    ]);
    return { pending, dead, oldestPendingSeconds: oldest ? Math.round((Date.now() - oldest.createdAt.getTime()) / 1000) : null };
  }

  /** Re-queues dead-lettered events once the cause is fixed (consumers remain idempotent). */
  public static async requeueDead(limit = 1000): Promise<number> {
    return prisma.$executeRaw`
      UPDATE social_event_outbox SET status = 'PENDING', attempts = 0, available_at = now()
      WHERE id IN (SELECT id FROM social_event_outbox WHERE status = 'DEAD' ORDER BY created_at LIMIT ${limit})`;
  }

  /** Retention: dispatched events 14 days, receipts 30 days; DEAD rows are kept until handled. */
  public static async purgeExpired(): Promise<{ events: number; receipts: number }> {
    const [events, receipts] = await Promise.all([
      prisma.socialEventOutbox.deleteMany({ where: { status: 'DISPATCHED', dispatchedAt: { lt: new Date(Date.now() - 14 * 86_400_000) } } }),
      prisma.socialEventReceipt.deleteMany({ where: { processedAt: { lt: new Date(Date.now() - 30 * 86_400_000) } } }),
    ]);
    return { events: events.count, receipts: receipts.count };
  }

  public static toAnalyticsProperties(payload: SocialEventPayload): Record<string, unknown> {
    const props: Record<string, unknown> = {};
    for (const key of SAFE_PROPERTY_KEYS) {
      const v = payload[key];
      if (v !== undefined && v !== null) props[key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)] = v;
    }
    return props;
  }

  // ---------------------------------------------------------------------------

  private static toRow(event: SocialDomainEvent, payload: SocialEventPayload): Prisma.SocialEventOutboxCreateInput {
    const targetId = payload.recipientUserId ?? payload.contentId ?? payload.communityId ?? payload.characterId ?? null;
    return {
      eventName: event,
      eventVersion: SOCIAL_EVENT_VERSION,
      actorId: payload.actorUserId && UUID.test(payload.actorUserId) ? payload.actorUserId : null,
      targetId: targetId ? String(targetId).slice(0, 100) : null,
      privacy: payload.recipientUserId || payload.actorUserId ? 'PERSONAL' : 'PUBLIC_METADATA',
      payload: payload as Prisma.InputJsonValue,
      requestId: payload.requestId ?? null,
    };
  }

  private static track(p: Promise<unknown>): void {
    const tracked: Promise<unknown> = p.finally(() => this.pending.delete(tracked));
    this.pending.add(tracked);
  }

  private static async dispatchById(id: string): Promise<void> {
    const row = await prisma.socialEventOutbox.findUnique({ where: { id } });
    if (row && row.status === 'PENDING') await this.dispatchRow(row);
  }

  private static async sendAnalytics(eventId: string, event: SocialDomainEvent, payload: SocialEventPayload): Promise<void> {
    const analyticsName = ANALYTICS_NAMES[event];
    if (!analyticsName) return;
    // Analytics is never a hard dependency: failures are logged, not propagated.
    try {
      await EventIngestionService.ingestBatch(
        [
          {
            id: eventId, // outbox id → analytics dedupe makes redelivery a no-op
            eventName: analyticsName,
            eventVersion: SOCIAL_EVENT_VERSION,
            userId: payload.actorUserId ?? undefined,
            characterId: payload.characterId ?? undefined,
            sessionId: payload.sessionId ?? undefined,
            timestamp: new Date().toISOString(),
            properties: this.toAnalyticsProperties(payload),
            source: 'server',
            requestId: payload.requestId ?? undefined,
          },
        ],
        {},
      );
    } catch (err) {
      logger.warn('[SocialEvents] analytics ingest failed (non-fatal)', { error: err instanceof Error ? err.message : err });
    }
  }

  private static async dispatchRow(row: SocialEventOutbox): Promise<void> {
    const event = row.eventName as SocialDomainEvent;
    const payload = row.payload as SocialEventPayload;
    const meta: SocialEventMeta = { eventId: row.id, eventName: event, eventVersion: row.eventVersion, occurredAt: row.createdAt };
    const failures: string[] = [];

    await this.sendAnalytics(row.id, event, payload);

    for (const consumer of this.consumers.get(event) ?? []) {
      const done = await prisma.socialEventReceipt.findUnique({ where: { eventId_consumer: { eventId: row.id, consumer: consumer.name } } });
      if (done) continue; // duplicate delivery: this consumer already processed the event
      try {
        await consumer.handler(payload, meta);
        await prisma.socialEventReceipt.create({ data: { eventId: row.id, consumer: consumer.name } }).catch((err) => {
          if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
        });
      } catch (err) {
        failures.push(`${consumer.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (failures.length === 0) {
      await prisma.socialEventOutbox.updateMany({ where: { id: row.id, status: 'PENDING' }, data: { status: 'DISPATCHED', dispatchedAt: new Date(), lastError: null } });
      return;
    }
    const attempts = row.attempts + 1;
    const dead = attempts >= MAX_EVENT_ATTEMPTS;
    const backoffSeconds = Math.min(3600, 2 ** attempts * 5);
    await prisma.socialEventOutbox.update({
      where: { id: row.id },
      data: {
        attempts,
        status: dead ? 'DEAD' : 'PENDING',
        availableAt: new Date(Date.now() + backoffSeconds * 1000),
        lastError: failures.join(' | ').slice(0, 1000),
      },
    });
    logger[dead ? 'error' : 'warn'](`[SocialEvents] ${event} ${dead ? 'dead-lettered' : 'will retry'}`, { eventId: row.id, attempts, failures });
  }
}
