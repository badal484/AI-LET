import { prisma } from '../../infrastructure/database/prisma.js';
import { logger } from '../../config/logger.js';
import { BadRequestError, NotFoundError } from '../../shared/errors/AppError.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationDeliveryEngine, appLink } from '../notifications/services/NotificationDeliveryEngine.js';
import { NotificationService } from '../notifications/services/notification.service.js';
import { InAppNotificationService } from '../notifications/services/InAppNotificationService.js';
import { PLAN_SQL } from './users.service.js';
import { REAL_USERS } from './overview.service.js';
import { processImage, storeImage } from './media.js';
import type { NotificationCategory } from '@ai-companion/types';

/**
 * Admin notification campaigns (console → Notifications).
 *
 * A campaign is written once and shown where the admin picks: a phone notification (with a big
 * picture), the in-app inbox, a banner at the top of the app, or a popup card with buttons. It goes to
 * an audience (plan, activity, characters, app version, emails), now / at a time / at an hour in each
 * person's own time zone, can wait out quiet hours, and can skip people who got one recently.
 *
 * Every person gets a campaign_recipients row (PENDING → SENT / SKIPPED / FAILED, then opened /
 * clicked / dismissed), so sending resumes after a restart and the results are exact.
 */

export type Surface = 'push' | 'inbox' | 'banner' | 'popup';
export type CampaignKind = 'news' | 'offer' | 'account';
export interface CampaignButton {
  label: string;
  link: string;
}
export interface Audience {
  /** Empty = everyone. trouble = a payment Google couldn't take (grace period / on hold). */
  plans?: Array<'free' | 'trial' | 'premium' | 'trouble'>;
  joinedWithinDays?: number | null;
  inactiveForDays?: number | null;
  activeWithinDays?: number | null;
  /** Chatted with any of these characters. */
  characterIds?: string[];
  /** Chatted with a character in any of these categories. */
  categoryIds?: string[];
  /** Only people on an app older than this version, e.g. "1.2.0". */
  appVersionBelow?: string | null;
  /** Only these accounts (one email per line in the composer). */
  emails?: string[];
}
export interface CampaignInput {
  name: string;
  kind: CampaignKind;
  title: string;
  body: string;
  imageUrl?: string | null;
  senderCharacterId?: string | null;
  postInChat?: boolean;
  link?: string | null;
  buttons?: CampaignButton[];
  surfaces: Surface[];
  sound?: boolean;
  audience: Audience;
  schedule: { mode: 'now' | 'at' | 'local'; at?: string | null; localHour?: number | null };
  respectQuietHours?: boolean;
  skipRecentDays?: number;
  expiresInDays?: number | null;
  isTemplate?: boolean;
}

/** Which user preference governs each kind (users choose in the app's notification settings). */
const CATEGORY: Record<CampaignKind, NotificationCategory> = { news: 'product_update', offer: 'campaign', account: 'system' };
const PREF_COLUMN: Record<CampaignKind, string> = {
  news: 'product_updates_category_enabled',
  offer: 'marketing_category_enabled',
  account: 'system_category_enabled',
};
const PREF_DEFAULT: Record<CampaignKind, boolean> = { news: true, offer: false, account: true };
const SURFACES: Surface[] = ['push', 'inbox', 'banner', 'popup'];
const BATCH = 200;
/** A local-hour campaign waits at most this long for everyone's hour to come round. */
const LOCAL_WINDOW_MS = 26 * 3600_000;

const audit = (adminId: string, action: string, resourceId: string, metadata?: Record<string, unknown>) =>
  AuditService.log({ actorType: 'ADMIN', actorId: adminId, action, resourceType: 'NOTIFICATION_CAMPAIGN', resourceId, metadata });

// ── Audience ─────────────────────────────────────────────────────────────────

const VERSION_RE = /^\d+(\.\d+){0,2}$/;

/** SQL selecting the audience's user ids (real, active, not deleted accounts only). */
function audienceSql(a: Audience, kind: CampaignKind) {
  const args: unknown[] = [];
  const arg = (v: unknown) => {
    args.push(v);
    return `$${args.length}`;
  };
  const where: string[] = [`u.status = 'ACTIVE'`, REAL_USERS];

  const plans = (a.plans ?? []).filter((p) => ['free', 'trial', 'premium', 'trouble'].includes(p));
  if (plans.length) {
    const parts: string[] = [];
    const named = plans.filter((p) => p !== 'trouble');
    if (named.length) parts.push(`coalesce(${PLAN_SQL}, 'free') = ANY(${arg(named)}::text[])`);
    if (plans.includes('trouble')) {
      parts.push(`EXISTS (SELECT 1 FROM billing_subscriptions s WHERE s.user_id = u.id AND s.status::text IN ('GRACE_PERIOD','PAST_DUE','ON_HOLD','PAYMENT_FAILED'))`);
    }
    where.push(`(${parts.join(' OR ')})`);
  }
  if (a.joinedWithinDays) where.push(`u.created_at >= now() - make_interval(days => ${arg(Math.floor(a.joinedWithinDays))}::int)`);
  if (a.inactiveForDays) where.push(`coalesce(u.last_active_at, u.created_at) < now() - make_interval(days => ${arg(Math.floor(a.inactiveForDays))}::int)`);
  if (a.activeWithinDays) where.push(`u.last_active_at >= now() - make_interval(days => ${arg(Math.floor(a.activeWithinDays))}::int)`);
  if (a.characterIds?.length) {
    where.push(`EXISTS (SELECT 1 FROM conversations c WHERE c.user_id = u.id AND c.character_id = ANY(${arg(a.characterIds)}::uuid[]))`);
  }
  if (a.categoryIds?.length) {
    where.push(`EXISTS (SELECT 1 FROM conversations c JOIN characters ch ON ch.id = c.character_id
                         WHERE c.user_id = u.id AND ch.category_id = ANY(${arg(a.categoryIds)}::uuid[]))`);
  }
  if (a.appVersionBelow && VERSION_RE.test(a.appVersionBelow)) {
    where.push(`EXISTS (SELECT 1 FROM user_devices d WHERE d.user_id = u.id AND d.is_active
                         AND d.app_version ~ '^\\d+(\\.\\d+){0,2}$'
                         AND string_to_array(d.app_version, '.')::int[] < string_to_array(${arg(a.appVersionBelow)}, '.')::int[])`);
  }
  const emails = (a.emails ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (emails.length) where.push(`lower(u.email) = ANY(${arg(emails)}::text[])`);

  const optedIn = `coalesce((SELECT np.push_enabled AND np.${PREF_COLUMN[kind]} FROM user_notification_preferences np WHERE np.user_id = u.id), ${PREF_DEFAULT[kind]})`;
  const canPush = `EXISTS (SELECT 1 FROM user_devices d WHERE d.user_id = u.id AND d.is_active AND d.push_token IS NOT NULL
                            AND d.push_permission_status IN ('AUTHORIZED','PROVISIONAL'))`;
  return { where: where.join(' AND '), args, optedIn, canPush };
}

function cleanAudience(a: Audience | undefined): Audience {
  const n = (v: unknown) => (typeof v === 'number' && v > 0 ? Math.min(3650, Math.floor(v)) : null);
  const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x)) : []);
  return {
    plans: Array.isArray(a?.plans) ? a.plans : [],
    joinedWithinDays: n(a?.joinedWithinDays),
    inactiveForDays: n(a?.inactiveForDays),
    activeWithinDays: n(a?.activeWithinDays),
    characterIds: ids(a?.characterIds),
    categoryIds: ids(a?.categoryIds),
    appVersionBelow: a?.appVersionBelow && VERSION_RE.test(a.appVersionBelow) ? a.appVersionBelow : null,
    emails: Array.isArray(a?.emails) ? a.emails.filter((e) => typeof e === 'string' && e.includes('@')).slice(0, 5000) : [],
  };
}

/** Live numbers for the composer: who matches, who has said yes to this kind, who can get a phone notification. */
export async function audienceSize(input: { audience: Audience; kind: CampaignKind; skipRecentDays?: number }) {
  const kind = input.kind in CATEGORY ? input.kind : 'news';
  const q = audienceSql(cleanAudience(input.audience), kind);
  const recent = input.skipRecentDays && input.skipRecentDays > 0
    ? `EXISTS (SELECT 1 FROM campaign_recipients r WHERE r.user_id = u.id AND r.status = 'SENT' AND r.sent_at >= now() - make_interval(days => ${Math.floor(input.skipRecentDays)}))`
    : 'false';
  const [r] = await prisma.$queryRawUnsafe<Array<{ matched: number; optedIn: number; canPush: number; recent: number }>>(
    `SELECT count(*)::int matched,
            count(*) FILTER (WHERE ${q.optedIn} AND NOT ${recent})::int "optedIn",
            count(*) FILTER (WHERE ${q.optedIn} AND ${q.canPush} AND NOT ${recent})::int "canPush",
            count(*) FILTER (WHERE ${recent})::int recent
       FROM users u WHERE ${q.where}`,
    ...q.args,
  );
  return {
    matched: r?.matched ?? 0,
    willReceive: r?.optedIn ?? 0,
    phoneNotifications: r?.canPush ?? 0,
    optedOut: (r?.matched ?? 0) - (r?.optedIn ?? 0) - (r?.recent ?? 0),
    skippedRecent: r?.recent ?? 0,
  };
}

// ── Create / edit ────────────────────────────────────────────────────────────

function validate(input: CampaignInput) {
  const title = input.title?.trim() ?? '';
  const body = input.body?.trim() ?? '';
  if (!input.name?.trim()) throw new BadRequestError('Give the campaign a name (only you see it).');
  if (!title && !body) throw new BadRequestError('Write a title or a message.');
  if (title.length > 65) throw new BadRequestError('Keep the title under 65 characters — phones cut longer ones.');
  if (body.length > 400) throw new BadRequestError('Keep the message under 400 characters.');
  const surfaces = (input.surfaces ?? []).filter((s) => SURFACES.includes(s));
  if (!surfaces.length) throw new BadRequestError('Pick at least one place to show it.');
  const buttons = (input.buttons ?? []).filter((b) => b?.label?.trim() && b?.link?.trim()).slice(0, 2);
  for (const l of [input.link, ...buttons.map((b) => b.link)]) {
    if (l && !/^(companion:\/\/|https:\/\/)/.test(l)) throw new BadRequestError('Links must start with companion:// (inside the app) or https://');
  }
  const { schedule } = input;
  if (schedule?.mode === 'at' && !(schedule.at && new Date(schedule.at).getTime() > Date.now() - 60_000)) {
    throw new BadRequestError('Pick a date and time in the future.');
  }
  if (schedule?.mode === 'local' && !(Number.isInteger(schedule.localHour) && schedule.localHour! >= 0 && schedule.localHour! <= 23)) {
    throw new BadRequestError('Pick the hour (0–23) to send in each person’s own time.');
  }
  return { title, body, surfaces, buttons };
}

function toRow(input: CampaignInput) {
  const { title, body, surfaces, buttons } = validate(input);
  const kind: CampaignKind = input.kind in CATEGORY ? input.kind : 'news';
  const days = input.expiresInDays && input.expiresInDays > 0 ? Math.min(60, input.expiresInDays) : null;
  return {
    title: input.name.trim().slice(0, 150),
    description: kind,
    category: CATEGORY[kind],
    targetAudience: 'CUSTOM',
    targetCriteria: cleanAudience(input.audience) as object,
    messageTitle: title,
    messageBody: body,
    deepLink: input.link?.trim() || null,
    imageUrl: input.imageUrl?.trim() || null,
    senderCharacterId: input.senderCharacterId || null,
    postInChat: Boolean(input.senderCharacterId && input.postInChat),
    buttons: buttons as object,
    surfaces: surfaces as object,
    sound: input.sound !== false,
    localHour: input.schedule?.mode === 'local' ? input.schedule.localHour! : null,
    scheduledFor: input.schedule?.mode === 'at' && input.schedule.at ? new Date(input.schedule.at) : null,
    respectQuietHours: input.respectQuietHours !== false,
    skipRecentDays: Math.max(0, Math.min(30, Math.floor(input.skipRecentDays ?? 0))),
    expiresAt: days ? new Date(Date.now() + days * 86_400_000) : null,
    isTemplate: Boolean(input.isTemplate),
  };
}

export async function saveCampaign(adminId: string, input: CampaignInput, id?: string) {
  const data = toRow(input);
  if (id) {
    const existing = await prisma.notificationCampaign.findUnique({ where: { id }, select: { status: true } });
    if (!existing) throw new NotFoundError('Campaign not found');
    if (existing.status !== 'DRAFT') throw new BadRequestError('Only drafts can be edited. Duplicate it to change and send again.');
    await prisma.notificationCampaign.update({ where: { id }, data });
    void audit(adminId, 'console.campaign.edit', id);
    return getCampaign(id);
  }
  const created = await prisma.notificationCampaign.create({ data: { ...data, status: 'DRAFT', createdByAdminId: adminId } });
  void audit(adminId, 'console.campaign.create', created.id, { name: data.title });
  return getCampaign(created.id);
}

export async function duplicateCampaign(adminId: string, id: string, asTemplate = false) {
  const c = await prisma.notificationCampaign.findUnique({ where: { id } });
  if (!c) throw new NotFoundError('Campaign not found');
  const {
    id: _id, createdAt: _c, updatedAt: _u, status: _s, sentCount: _sc, deliveredCount: _dc, openedCount: _oc, failedCount: _fc,
    clickedCount: _cc, estimatedAudience: _ea, startedAt: _sa, completedAt: _ca, isTemplate: _t, ...rest
  } = c;
  const copy = await prisma.notificationCampaign.create({
    data: {
      ...rest,
      targetCriteria: (rest.targetCriteria ?? {}) as object,
      buttons: rest.buttons as object,
      surfaces: rest.surfaces as object,
      title: asTemplate ? c.title : c.isTemplate ? c.title : `${c.title} (copy)`,
      status: 'DRAFT',
      isTemplate: asTemplate,
      scheduledFor: null,
      createdByAdminId: adminId,
    },
  });
  void audit(adminId, asTemplate ? 'console.campaign.template' : 'console.campaign.duplicate', copy.id, { from: id });
  return getCampaign(copy.id);
}

export async function deleteDraft(adminId: string, id: string) {
  const c = await prisma.notificationCampaign.findUnique({ where: { id }, select: { status: true } });
  if (!c) throw new NotFoundError('Campaign not found');
  if (c.status !== 'DRAFT') throw new BadRequestError('Only drafts and templates can be deleted.');
  await prisma.notificationCampaign.delete({ where: { id } });
  void audit(adminId, 'console.campaign.delete', id);
  return { ok: true };
}

export async function uploadCampaignImage(body: Buffer) {
  const url = await storeImage(await processImage(body, 'banner'), 'campaigns', 'banner');
  return { url };
}

// ── Read ─────────────────────────────────────────────────────────────────────

type CampaignRow = Awaited<ReturnType<typeof prisma.notificationCampaign.findUniqueOrThrow>>;

function present(c: CampaignRow, stats?: Record<string, number>) {
  const sent = stats?.['sent'] ?? 0;
  return {
    id: c.id,
    name: c.title,
    kind: (c.description as CampaignKind) || 'news',
    title: c.messageTitle,
    body: c.messageBody,
    imageUrl: c.imageUrl,
    senderCharacterId: c.senderCharacterId,
    postInChat: c.postInChat,
    link: c.deepLink,
    buttons: c.buttons as unknown as CampaignButton[],
    surfaces: c.surfaces as unknown as Surface[],
    sound: c.sound,
    audience: (c.targetCriteria ?? {}) as Audience,
    schedule: c.localHour != null ? { mode: 'local', localHour: c.localHour } : c.scheduledFor ? { mode: 'at', at: c.scheduledFor.toISOString() } : { mode: 'now' },
    respectQuietHours: c.respectQuietHours,
    skipRecentDays: c.skipRecentDays,
    expiresAt: c.expiresAt?.toISOString() ?? null,
    isTemplate: c.isTemplate,
    status: c.status,
    createdAt: c.createdAt.toISOString(),
    startedAt: c.startedAt?.toISOString() ?? null,
    completedAt: c.completedAt?.toISOString() ?? null,
    stats: {
      audience: c.estimatedAudience,
      waiting: stats?.['pending'] ?? 0,
      sent,
      phones: stats?.['phones'] ?? 0,
      opened: stats?.['opened'] ?? 0,
      clicked: stats?.['clicked'] ?? 0,
      dismissed: stats?.['dismissed'] ?? 0,
      skipped: stats?.['skipped'] ?? 0,
      failed: stats?.['failed'] ?? 0,
      deadPhones: stats?.['dead'] ?? 0,
      openRate: sent ? (stats?.['opened'] ?? 0) / sent : null,
    },
  };
}

async function statsFor(ids: string[]) {
  if (!ids.length) return new Map<string, Record<string, number>>();
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, number> & { id: string }>>(
    `SELECT campaign_id::text id,
            count(*) FILTER (WHERE status = 'PENDING')::int pending,
            count(*) FILTER (WHERE status = 'SENT')::int sent,
            count(*) FILTER (WHERE status = 'SENT' AND devices_sent > 0)::int phones,
            count(*) FILTER (WHERE opened_at IS NOT NULL)::int opened,
            count(*) FILTER (WHERE clicked_at IS NOT NULL)::int clicked,
            count(*) FILTER (WHERE dismissed_at IS NOT NULL)::int dismissed,
            count(*) FILTER (WHERE status = 'SKIPPED')::int skipped,
            count(*) FILTER (WHERE status = 'FAILED')::int failed,
            count(*) FILTER (WHERE skip_reason = 'dead_phone')::int dead
       FROM campaign_recipients WHERE campaign_id = ANY($1::uuid[]) GROUP BY campaign_id`,
    ids,
  );
  return new Map(rows.map((r) => [r.id, r]));
}

export async function listCampaigns() {
  const rows = await prisma.notificationCampaign.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  const stats = await statsFor(rows.map((r) => r.id));
  return rows.map((r) => present(r, stats.get(r.id)));
}

export async function getCampaign(id: string) {
  const c = await prisma.notificationCampaign.findUnique({ where: { id } });
  if (!c) throw new NotFoundError('Campaign not found');
  const stats = await statsFor([id]);
  const reasons = await prisma.$queryRawUnsafe<Array<{ reason: string; n: number }>>(
    `SELECT coalesce(skip_reason, 'other') reason, count(*)::int n FROM campaign_recipients
      WHERE campaign_id = $1::uuid AND status IN ('SKIPPED','FAILED') GROUP BY 1 ORDER BY 2 DESC`,
    id,
  );
  return { ...present(c, stats.get(id)), skipReasons: reasons };
}

/** Characters and categories for the composer's pickers. */
export async function composerOptions() {
  const [characters, categories] = await Promise.all([
    prisma.character.findMany({
      where: { status: 'PUBLISHED', deletedAt: null },
      select: { id: true, name: true, avatarUrl: true, categoryId: true },
      orderBy: { name: 'asc' },
    }),
    prisma.characterCategory.findMany({ select: { id: true, displayName: true }, orderBy: { displayName: 'asc' } }),
  ]);
  return { characters, categories: categories.map((c) => ({ id: c.id, name: c.displayName })) };
}

// ── Send ─────────────────────────────────────────────────────────────────────

/** Starts a draft: everyone in the audience gets a waiting row now; delivery follows the schedule. */
export async function launchCampaign(adminId: string, id: string) {
  const c = await prisma.notificationCampaign.findUnique({ where: { id } });
  if (!c) throw new NotFoundError('Campaign not found');
  if (c.isTemplate) throw new BadRequestError('This is a template. Use it to make a campaign first.');
  if (c.status !== 'DRAFT') throw new BadRequestError('This campaign was already sent.');
  if (c.scheduledFor && c.scheduledFor.getTime() < Date.now() - 5 * 60_000) throw new BadRequestError('The send time has passed. Pick a new time.');

  const kind = (c.description as CampaignKind) || 'news';
  const q = audienceSql(cleanAudience(c.targetCriteria as Audience), kind);
  const recent = c.skipRecentDays > 0
    ? `AND NOT EXISTS (SELECT 1 FROM campaign_recipients r WHERE r.user_id = u.id AND r.status = 'SENT' AND r.sent_at >= now() - make_interval(days => ${c.skipRecentDays}))`
    : '';
  const idArg = `$${q.args.length + 1}`;
  const inserted = await prisma.$executeRawUnsafe(
    `INSERT INTO campaign_recipients (campaign_id, user_id)
     SELECT ${idArg}::uuid, u.id FROM users u WHERE ${q.where} AND ${q.optedIn} ${recent}
     ON CONFLICT (campaign_id, user_id) DO NOTHING`,
    ...q.args,
    id,
  );
  await prisma.notificationCampaign.update({
    where: { id },
    data: { status: c.scheduledFor && c.scheduledFor > new Date() ? 'SCHEDULED' : 'SENDING', estimatedAudience: inserted, startedAt: new Date() },
  });
  void audit(adminId, 'console.campaign.send', id, { recipients: inserted, schedule: c.localHour != null ? `local ${c.localHour}:00` : c.scheduledFor ?? 'now' });
  // Start right away for "now" (the worker keeps it going and handles scheduled / local-time ones).
  if (!c.scheduledFor) void processCampaign(id).catch((err) => logger.error('Campaign send failed', { id, error: err instanceof Error ? err.message : err }));
  return getCampaign(id);
}

export async function cancelCampaign(adminId: string, id: string) {
  const c = await prisma.notificationCampaign.findUnique({ where: { id }, select: { status: true } });
  if (!c) throw new NotFoundError('Campaign not found');
  if (!['SCHEDULED', 'SENDING'].includes(c.status)) throw new BadRequestError('Only a scheduled or sending campaign can be stopped.');
  await prisma.$transaction([
    prisma.notificationCampaign.update({ where: { id }, data: { status: 'CANCELLED', completedAt: new Date() } }),
    prisma.campaignRecipient.updateMany({ where: { campaignId: id, status: 'PENDING' }, data: { status: 'SKIPPED', skipReason: 'stopped' } }),
  ]);
  void audit(adminId, 'console.campaign.stop', id);
  return getCampaign(id);
}

/** Hour (0–23) and minutes now in a time zone. */
function localClock(tz: string): { hour: number; minutes: number } {
  try {
    const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: tz || 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false })
      .format(new Date())
      .split(':')
      .map(Number);
    return { hour: (h ?? 0) % 24, minutes: m ?? 0 };
  } catch {
    return localClock('Asia/Kolkata');
  }
}

const personalize = (text: string, vars: { name: string; character: string }) =>
  text.replace(/\{name\}/gi, vars.name).replace(/\{character\}/gi, vars.character).replace(/\s{2,}/g, ' ').trim();

type Campaign = CampaignRow;
type Sender = { id: string; name: string; avatarUrl: string | null } | null;

/** Delivers one campaign to one person (also used for test sends). Returns phones reached. */
async function deliver(c: Campaign, userId: string, sender: Sender, opts: { test?: boolean } = {}) {
  const profile = await prisma.userProfile.findUnique({ where: { userId }, select: { displayName: true } });
  const vars = { name: profile?.displayName?.split(' ')[0] || 'there', character: sender?.name.split(' ')[0] ?? 'Lovira' };
  const title = personalize(c.messageTitle || sender?.name || 'Lovira', vars);
  const body = personalize(c.messageBody, vars);
  const surfaces = c.surfaces as unknown as Surface[];
  const link = c.deepLink || (sender ? appLink({ characterId: sender.id }) : undefined);
  const kind = (c.description as CampaignKind) || 'news';
  const category = CATEGORY[kind];

  if (surfaces.includes('inbox')) {
    await InAppNotificationService.createNotification({
      userId,
      category,
      title,
      body,
      deepLink: link ?? null,
      data: { campaignId: c.id, imageUrl: c.imageUrl, buttons: c.buttons },
      sourceType: 'campaign',
      sourceId: c.id,
      expiresAt: c.expiresAt,
    });
  }

  if (c.postInChat && sender) {
    const conv = await prisma.conversation.findFirst({ where: { userId, characterId: sender.id, deletedAt: null }, select: { id: true } });
    if (conv) {
      const last = await prisma.message.findFirst({ where: { conversationId: conv.id }, orderBy: { sequenceNumber: 'desc' }, select: { sequenceNumber: true } });
      await prisma.message.create({
        data: {
          conversationId: conv.id,
          senderType: 'CHARACTER',
          role: 'assistant',
          content: body,
          status: 'SENT',
          sequenceNumber: (last?.sequenceNumber ?? 0) + 1,
          isProactive: true,
          source: 'campaign',
        },
      });
      await prisma.conversation.update({
        where: { id: conv.id },
        data: { lastMessageAt: new Date(), lastMessageSnippet: body.slice(0, 100), unreadCount: { increment: 1 }, hiddenAt: null },
      });
    }
  }

  if (!surfaces.includes('push')) return { phones: 0, dead: 0 };
  const result = await NotificationDeliveryEngine.dispatchNotification({
    userId,
    category,
    title,
    body,
    imageUrl: c.imageUrl ?? undefined,
    sound: c.sound,
    characterId: sender?.id,
    characterName: sender?.name,
    deepLink: link,
    inbox: false,
    bypassQuietHours: true, // waiting out quiet hours is decided per person below
    idempotencyKey: opts.test ? `camptest_${c.id}_${userId}_${Date.now()}` : `camp_${c.id}_${userId}`,
    data: { campaignId: c.id, kind: 'campaign' },
  });
  return { phones: result.sentDevicesCount, dead: result.invalidatedDevicesCount ?? 0 };
}

async function senderOf(c: Campaign): Promise<Sender> {
  if (!c.senderCharacterId) return null;
  return prisma.character.findUnique({ where: { id: c.senderCharacterId }, select: { id: true, name: true, avatarUrl: true } });
}

/** Sends one batch of a campaign's waiting people whose moment has come. Returns how many were handled. */
export async function processCampaign(id: string): Promise<number> {
  const c = await prisma.notificationCampaign.findUnique({ where: { id } });
  if (!c || !['SENDING', 'SCHEDULED'].includes(c.status)) return 0;
  if (c.status === 'SCHEDULED') {
    if (c.scheduledFor && c.scheduledFor > new Date()) return 0;
    await prisma.notificationCampaign.update({ where: { id }, data: { status: 'SENDING' } });
  }
  const sender = await senderOf(c);
  const surfaces = c.surfaces as unknown as Surface[];
  const kind = (c.description as CampaignKind) || 'news';
  const started = (c.scheduledFor ?? c.startedAt ?? c.createdAt).getTime();
  const windowOver = c.localHour != null ? Date.now() > started + LOCAL_WINDOW_MS : false;
  const expired = (c.expiresAt && c.expiresAt < new Date()) || windowOver;
  let handled = 0;

  const waiting = await prisma.campaignRecipient.findMany({ where: { campaignId: id, status: 'PENDING' }, take: BATCH, orderBy: { createdAt: 'asc' } });
  for (const r of waiting) {
    if (expired) {
      await prisma.campaignRecipient.update({ where: { id: r.id }, data: { status: 'SKIPPED', skipReason: c.localHour != null ? 'missed_their_hour' : 'expired' } });
      handled++;
      continue;
    }
    const prefs = await NotificationService.getUserPreferences(r.userId);
    // They switched this kind off after the campaign started.
    if (!NotificationDeliveryEngine.checkCategoryPermission(CATEGORY[kind], prefs) || (kind !== 'account' && !prefs.pushEnabled && surfaces.every((s) => s === 'push'))) {
      await prisma.campaignRecipient.update({ where: { id: r.id }, data: { status: 'SKIPPED', skipReason: 'opted_out' } });
      handled++;
      continue;
    }
    const tz = prefs.timezone || 'Asia/Kolkata';
    // Local hour: wait until it is that hour where they are.
    if (c.localHour != null && localClock(tz).hour !== c.localHour) continue;
    // Quiet hours: wait until they're over (only matters for a phone notification).
    if (
      c.respectQuietHours &&
      surfaces.includes('push') &&
      prefs.quietHoursEnabled &&
      NotificationDeliveryEngine.isWithinQuietHours(tz, prefs.quietHoursStart || '22:30', prefs.quietHoursEnd || '08:00')
    ) {
      continue;
    }
    try {
      const { phones, dead } = await deliver(c, r.userId, sender);
      await prisma.campaignRecipient.update({
        where: { id: r.id },
        data: { status: 'SENT', sentAt: new Date(), devicesSent: phones, skipReason: dead && !phones ? 'dead_phone' : null },
      });
    } catch (err) {
      await prisma.campaignRecipient.update({ where: { id: r.id }, data: { status: 'FAILED', skipReason: 'error' } });
      logger.warn('Campaign delivery failed', { campaignId: id, userId: r.userId, error: err instanceof Error ? err.message : err });
    }
    handled++;
  }

  const left = await prisma.campaignRecipient.count({ where: { campaignId: id, status: 'PENDING' } });
  const counts = await statsFor([id]);
  const s = counts.get(id);
  await prisma.notificationCampaign.update({
    where: { id },
    data: {
      sentCount: s?.['sent'] ?? 0,
      deliveredCount: s?.['phones'] ?? 0,
      openedCount: s?.['opened'] ?? 0,
      clickedCount: s?.['clicked'] ?? 0,
      failedCount: s?.['failed'] ?? 0,
      ...(left === 0 && { status: 'COMPLETED', completedAt: new Date() }),
    },
  });
  // More waiting people whose moment is now: keep going (local-hour / quiet-hour ones wait for the worker).
  if (left > 0 && handled === BATCH) return handled + (await processCampaign(id));
  return handled;
}

/** Worker tick (every minute): scheduled campaigns whose time came, and sending ones with people still waiting. */
export async function processDueCampaigns(): Promise<{ campaigns: number; handled: number }> {
  const due = await prisma.notificationCampaign.findMany({
    where: { OR: [{ status: 'SENDING' }, { status: 'SCHEDULED', scheduledFor: { lte: new Date() } }] },
    select: { id: true },
    take: 20,
  });
  let handled = 0;
  for (const c of due) handled += await processCampaign(c.id);
  return { campaigns: due.length, handled };
}

/** "Send to me first": one person, now, ignoring audience, caps and quiet hours. Not counted in results. */
export async function testSend(adminId: string, id: string, email: string) {
  const c = await prisma.notificationCampaign.findUnique({ where: { id } });
  if (!c) throw new NotFoundError('Campaign not found');
  const user = await prisma.user.findFirst({ where: { email: { equals: email.trim(), mode: 'insensitive' }, status: 'ACTIVE' }, select: { id: true } });
  if (!user) throw new BadRequestError('No app account with that email. Use the email you sign in to the app with.');
  const devices = await prisma.userDevice.count({ where: { userId: user.id, isActive: true, pushToken: { not: null }, pushPermissionStatus: { in: ['AUTHORIZED', 'PROVISIONAL'] } } });
  const { phones } = await deliver(c, user.id, await senderOf(c), { test: true });
  void audit(adminId, 'console.campaign.test', id, { to: email });
  const surfaces = c.surfaces as unknown as Surface[];
  return {
    phones,
    note: !surfaces.includes('push')
      ? 'Sent to the inbox / in-app only (phone notification is off for this campaign).'
      : phones
        ? `Sent to ${phones} phone${phones === 1 ? '' : 's'}.`
        : devices
          ? 'Their phone did not accept it — check notifications are allowed for the app.'
          : 'That account has no phone with notifications allowed yet. Open the app and allow notifications first.',
  };
}

// ── App side: popups, banners, opens ─────────────────────────────────────────

/** Popups and banners from campaigns this person got and hasn't closed yet. */
export async function inAppMessagesFor(userId: string) {
  const rows = await prisma.$queryRawUnsafe<
    Array<{ id: string; campaignId: string; title: string; body: string; imageUrl: string | null; link: string | null; buttons: CampaignButton[]; surfaces: Surface[]; senderId: string | null; senderName: string | null; senderAvatar: string | null }>
  >(
    `SELECT r.id::text, c.id::text "campaignId", c.message_title title, c.message_body body, c.image_url "imageUrl", c.deep_link link,
            c.buttons, c.surfaces, ch.id::text "senderId", ch.name "senderName", ch.avatar_url "senderAvatar"
       FROM campaign_recipients r
       JOIN notification_campaigns c ON c.id = r.campaign_id
       LEFT JOIN characters ch ON ch.id = c.sender_character_id
      WHERE r.user_id = $1::uuid AND r.status = 'SENT' AND r.dismissed_at IS NULL
        AND (c.surfaces ? 'popup' OR c.surfaces ? 'banner')
        AND (c.expires_at IS NULL OR c.expires_at > now())
        AND r.sent_at > now() - interval '30 days'
      ORDER BY r.sent_at DESC LIMIT 5`,
    userId,
  );
  const profile = await prisma.userProfile.findUnique({ where: { userId }, select: { displayName: true } });
  return rows.map((r) => {
    const vars = { name: profile?.displayName?.split(' ')[0] || 'there', character: r.senderName?.split(' ')[0] ?? 'Lovira' };
    return {
      id: r.id,
      campaignId: r.campaignId,
      kind: r.surfaces.includes('popup') ? 'popup' : 'banner',
      title: personalize(r.title || r.senderName || 'Lovira', vars),
      body: personalize(r.body, vars),
      imageUrl: r.imageUrl,
      link: r.link || (r.senderId ? appLink({ characterId: r.senderId }) : null),
      buttons: r.buttons,
      sender: r.senderId ? { id: r.senderId, name: r.senderName, avatarUrl: r.senderAvatar } : null,
    };
  });
}

/** The app reports what the person did: opened (tapped the notification / saw the popup), clicked a button, or closed it. */
export async function recordCampaignAction(userId: string, campaignId: string, action: 'open' | 'click' | 'dismiss') {
  const now = new Date();
  const data =
    action === 'open' ? { openedAt: now } : action === 'click' ? { clickedAt: now, dismissedAt: now } : { dismissedAt: now };
  // First time only for each action.
  const field = action === 'open' ? 'openedAt' : action === 'click' ? 'clickedAt' : 'dismissedAt';
  await prisma.campaignRecipient.updateMany({ where: { campaignId, userId, [field]: null }, data });
  if (action === 'click') await prisma.campaignRecipient.updateMany({ where: { campaignId, userId, openedAt: null }, data: { openedAt: now } });
  return { ok: true };
}
