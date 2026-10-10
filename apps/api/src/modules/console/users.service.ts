import { randomUUID } from 'node:crypto';
import { prisma } from '../../infrastructure/database/prisma.js';
import { redis } from '../../infrastructure/redis/redis.js';
import { BadRequestError, NotFoundError } from '../../shared/errors/AppError.js';
import { AuditService } from '../audit/audit.service.js';
import { allowanceStatus } from '../billing/messageAllowance.js';
import { CreditWalletService } from '../billing/credits/CreditWalletService.js';
import { EntitlementService } from '../billing/entitlements/EntitlementService.js';
import { AccountDeletionService } from '../privacy/services/AccountDeletionService.js';
import { istMidnight, REAL_USERS, TEST_USERS } from './overview.service.js';
import { Realtime } from '../../infrastructure/realtime/realtime.js';

/** Users screen: find a user, see their plan and usage, and help them. Every change is audited. */

const INR = () => Number(process.env['INR_PER_USD'] ?? 88);

export interface UserRow {
  id: string;
  name: string | null;
  email: string;
  status: string;
  joined: string;
  lastActive: string | null;
  plan: 'premium' | 'trial' | 'free';
  gender: string | null;
  language: string | null;
  onboarded: boolean;
  signIn: string[];
  platform: string | null;
  appVersion: string | null;
  paid: number;
  characters: number;
  messagesToday: number;
  messagesTotal: number;
  test: boolean;
}

// No active subscription → NULL → 'free' (an empty set must not fall through to 'premium').
export const PLAN_SQL = `(SELECT CASE WHEN count(*) = 0 THEN NULL WHEN bool_or(s.status = 'TRIALING') THEN 'trial' ELSE 'premium' END
                     FROM billing_subscriptions s JOIN billing_plans p ON p.id = s.plan_id
                    WHERE s.user_id = u.id AND p.code <> 'FREE' AND s.current_period_end > now()
                      AND s.status IN ('TRIALING','ACTIVE','GRACE_PERIOD','CANCELLED'))`;

const FILTERS: Record<string, string> = {
  premium: `b.plan = 'premium'`,
  trial: `b.plan = 'trial'`,
  free: `b.plan = 'free'`,
  blocked: `b.status = 'SUSPENDED'`,
  new: `b.created_at >= now() - interval '7 days'`,
  paid: `b.paise > 0`,
  inactive: `coalesce(b.last_active_at, b.created_at) < now() - interval '7 days'`,
  onboarding: `NOT b.onboarded`,
};

const SORTS: Record<string, string> = {
  lastActive: 'b.last_active_at',
  joined: 'b.created_at',
  messages: '"messagesTotal"',
  today: '"messagesToday"',
  paid: 'b.paise',
  name: 'lower(b.name)',
};

export interface ListParams {
  search?: string;
  page?: number;
  filter?: string;
  sort?: string;
  dir?: string;
  showTest?: boolean;
  pageSize?: number;
}

async function queryUsers(params: ListParams) {
  const page = Math.max(1, params.page ?? 1);
  const size = Math.min(10_000, params.pageSize ?? 25);
  const search = params.search?.trim() ? `%${params.search.trim().toLowerCase()}%` : null;
  const filter = params.filter && FILTERS[params.filter] ? FILTERS[params.filter] : 'true';
  const sortCol = SORTS[params.sort ?? ''] ?? SORTS['lastActive'];
  const dir = params.dir === 'asc' ? 'ASC' : 'DESC';
  const where = `u.status <> 'DELETED' ${params.showTest ? '' : `AND ${REAL_USERS}`}
    ${search ? `AND (lower(u.email) LIKE $3 OR lower(coalesce(pr.display_name, '')) LIKE $3 OR u.id::text = $4 OR coalesce(u.phone_number, '') LIKE $3)` : ''}`;
  const args: unknown[] = [size, (page - 1) * size];
  if (search) args.push(search, params.search!.trim());
  const today = istMidnight(0).toISOString();

  const rows = await prisma.$queryRawUnsafe<Array<Omit<UserRow, 'paid'> & { paise: number; total: number; hasPassword: boolean }>>(
    `WITH base AS (
       SELECT u.id, pr.display_name AS name, u.email, u.status::text, u.created_at, u.last_active_at,
              coalesce(${PLAN_SQL}, 'free') AS plan,
              pr.user_gender gender, pr.preferred_language language, coalesce(pr.onboarding_completed, false) onboarded,
              coalesce((SELECT array_agg(DISTINCT ai.provider) FROM auth_identities ai WHERE ai.user_id = u.id), '{}') "signIn",
              u.password_hash IS NOT NULL "hasPassword",
              dv.platform, dv.app_version "appVersion",
              (SELECT coalesce(sum(t.amount_minor_units), 0)::int FROM purchase_transactions t
                WHERE t.user_id = u.id AND t.status = 'SUCCEEDED' AND t.currency = 'INR') paise,
              (SELECT count(DISTINCT c.character_id)::int FROM conversations c WHERE c.user_id = u.id) characters,
              (SELECT count(*)::int FROM messages m JOIN conversations c ON c.id = m.conversation_id
                WHERE c.user_id = u.id AND m.role = 'user' AND m.created_at >= '${today}') "messagesToday",
              (SELECT count(*)::int FROM messages m JOIN conversations c ON c.id = m.conversation_id
                WHERE c.user_id = u.id AND m.role = 'user') "messagesTotal",
              ${TEST_USERS} test
         FROM users u
         LEFT JOIN user_profiles pr ON pr.user_id = u.id
         LEFT JOIN LATERAL (
           SELECT d.platform, d.app_version FROM (
             SELECT platform, app_version, last_seen_at FROM devices WHERE user_id = u.id
             UNION ALL SELECT platform, app_version, last_seen_at FROM user_devices WHERE user_id = u.id
           ) d ORDER BY d.last_seen_at DESC LIMIT 1
         ) dv ON true
        WHERE ${where}
     )
     SELECT b.id, b.name, b.email, b.status, to_char(b.created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF') joined,
            to_char(b.last_active_at, 'YYYY-MM-DD"T"HH24:MI:SSOF') "lastActive", b.plan, b.gender, b.language, b.onboarded,
            b."signIn", b."hasPassword", b.platform, b."appVersion", b.paise, b.characters, b."messagesToday", b."messagesTotal", b.test,
            count(*) OVER ()::int total
       FROM base b
      WHERE ${filter}
      ORDER BY ${sortCol} ${dir} NULLS LAST, b.created_at DESC
      LIMIT $1 OFFSET $2`,
    ...args,
  );
  const users: UserRow[] = rows.map(({ total: _t, paise, hasPassword, signIn, ...r }) => ({
    ...r,
    signIn: signIn.length ? signIn : hasPassword ? ['email'] : [],
    paid: paise / 100,
  }));
  return { users, total: rows[0]?.total ?? 0, page, pageSize: size };
}

/** The numbers above the list (real users only). */
async function userStats() {
  const today = istMidnight(0);
  const [r] = await prisma.$queryRawUnsafe<Array<Record<string, number>>>(
    `SELECT count(*)::int total,
            count(*) FILTER (WHERE u.created_at >= $1)::int "newToday",
            count(*) FILTER (WHERE u.created_at >= now() - interval '7 days')::int "newWeek",
            count(*) FILTER (WHERE u.last_active_at >= $1)::int "activeToday",
            count(*) FILTER (WHERE u.status = 'SUSPENDED')::int blocked,
            count(*) FILTER (WHERE NOT coalesce(pr.onboarding_completed, false))::int "notOnboarded",
            count(*) FILTER (WHERE ${PLAN_SQL} = 'premium')::int premium,
            count(*) FILTER (WHERE ${PLAN_SQL} = 'trial')::int trial
       FROM users u LEFT JOIN user_profiles pr ON pr.user_id = u.id
      WHERE u.status <> 'DELETED' AND ${REAL_USERS}`,
    today,
  );
  return r ?? {};
}

export async function listUsers(params: ListParams) {
  const [list, stats] = await Promise.all([queryUsers(params), userStats()]);
  return { ...list, stats };
}

const csvCell = (v: unknown) => {
  const s = v == null ? '' : Array.isArray(v) ? v.join(' ') : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function usersCsv(params: ListParams) {
  const { users } = await queryUsers({ ...params, page: 1, pageSize: 10_000 });
  const head = ['id', 'name', 'email', 'status', 'plan', 'joined', 'last_active', 'gender', 'language', 'onboarded', 'sign_in', 'platform', 'app_version', 'paid_inr', 'characters', 'messages_today', 'messages_total'];
  const lines = users.map((u) =>
    [u.id, u.name, u.email, u.status, u.plan, u.joined, u.lastActive, u.gender, u.language, u.onboarded, u.signIn, u.platform, u.appVersion, u.paid, u.characters, u.messagesToday, u.messagesTotal]
      .map(csvCell)
      .join(','),
  );
  return [head.join(','), ...lines].join('\n');
}

interface DeviceSeen { platform: string; appVersion: string | null; os: string | null; name: string | null; lastSeen: Date; active: boolean }

/** Every sign-in records a device, so one phone shows up many times: group identical ones, newest first. */
function groupDevices(list: DeviceSeen[]) {
  const groups = new Map<string, DeviceSeen & { logins: number }>();
  for (const d of list.sort((a, b) => +b.lastSeen - +a.lastSeen)) {
    const key = [d.platform.toLowerCase(), d.name ?? '', d.appVersion ?? '', d.os ?? ''].join('|');
    const g = groups.get(key);
    if (g) {
      g.logins += 1;
      g.active ||= d.active;
    } else groups.set(key, { ...d, platform: d.platform.toLowerCase(), logins: 1 });
  }
  return [...groups.values()];
}

export async function getUser(id: string) {
  const user = await prisma.user.findUnique({ where: { id }, include: { profile: true, authIdentities: { select: { provider: true, providerEmail: true } } } });
  if (!user) throw new NotFoundError('User not found');
  const [subscriptions, allowance, characters, cost, purchases, today, devices, pushDevices, activeSessions, activity, wallet, feedback, support, safety, adminActions, deletion] =
    await Promise.all([
      prisma.billingSubscription.findMany({
        where: { userId: id },
        include: { plan: { select: { code: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      allowanceStatus(id),
      prisma.$queryRawUnsafe<
        Array<{ characterId: string; name: string; avatarUrl: string; messages: number; lastAt: string; stage: string | null; streak: number | null; since: string }>
      >(
        `SELECT ch.id "characterId", ch.name, ch.avatar_url "avatarUrl", count(m.id)::int messages,
                to_char(max(m.created_at), 'YYYY-MM-DD"T"HH24:MI:SSOF') "lastAt",
                r.stage::text stage, r.consecutive_days_active streak,
                to_char(min(c.created_at), 'YYYY-MM-DD"T"HH24:MI:SSOF') since
           FROM conversations c JOIN characters ch ON ch.id = c.character_id
           LEFT JOIN messages m ON m.conversation_id = c.id AND m.role = 'user'
           LEFT JOIN relationships r ON r.user_id = c.user_id AND r.character_id = ch.id
          WHERE c.user_id = $1::uuid GROUP BY ch.id, r.stage, r.consecutive_days_active ORDER BY max(m.created_at) DESC NULLS LAST`,
        id,
      ),
      prisma.$queryRawUnsafe<Array<{ usd: number }>>(
        `SELECT coalesce(sum(estimated_cost), 0)::float usd FROM ai_usage_events WHERE user_id = $1::uuid AND created_at >= now() - interval '30 days'`,
        id,
      ),
      prisma.purchaseTransaction.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 10 }),
      // Messages actually sent today (the allowance counter only counts while limits are on).
      prisma.message.count({ where: { role: 'user', createdAt: { gte: istMidnight(0) }, conversation: { userId: id } } }),
      prisma.device.findMany({ where: { userId: id }, orderBy: { lastSeenAt: 'desc' }, take: 10 }),
      prisma.userDevice.findMany({ where: { userId: id }, orderBy: { lastSeenAt: 'desc' }, take: 10 }),
      prisma.session.count({ where: { userId: id, revokedAt: null, expiresAt: { gt: new Date() } } }),
      prisma.$queryRawUnsafe<Array<{ day: string; messages: number }>>(
        `WITH days AS (
           SELECT generate_series((now() AT TIME ZONE 'Asia/Kolkata')::date - 29, (now() AT TIME ZONE 'Asia/Kolkata')::date, '1 day')::date AS dt
         ),
         msg AS (
           SELECT (m.created_at AT TIME ZONE 'Asia/Kolkata')::date dt, count(*)::int messages
             FROM messages m JOIN conversations c ON c.id = m.conversation_id
            WHERE c.user_id = $1::uuid AND m.role = 'user' AND m.created_at >= now() - interval '31 days' GROUP BY 1
         )
         SELECT to_char(d.dt, 'YYYY-MM-DD') AS "day", coalesce(msg.messages, 0) messages FROM days d LEFT JOIN msg USING (dt) ORDER BY d.dt`,
        id,
      ),
      prisma.creditTransaction.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 20 }),
      prisma.messageFeedback.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, messageId: true, rating: true, reasonCategory: true, feedbackText: true, createdAt: true, message: { select: { conversation: { select: { character: { select: { name: true } } } } } } },
      }),
      prisma.supportRequest.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 20 }),
      prisma.$queryRawUnsafe<Array<{ id: string; kind: string; character: string | null; at: string; resolved: boolean }>>(
        `SELECT sm.id, sm.kind, ch.name "character", to_char(sm.created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF') "at", sm.resolved_at IS NOT NULL resolved
           FROM safety_moments sm LEFT JOIN characters ch ON ch.id = sm.character_id
          WHERE sm.user_id = $1::uuid ORDER BY sm.created_at DESC LIMIT 20`,
        id,
      ),
      prisma.$queryRawUnsafe<Array<{ id: string; action: string; admin: string | null; metadata: unknown; at: string }>>(
        `SELECT a.id, a.action, coalesce(au.display_name, au.email) admin, a.metadata, to_char(a.created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF') "at"
           FROM audit_logs a LEFT JOIN admin_users au ON au.id = a.actor_id
          WHERE a.actor_type = 'ADMIN' AND a.resource_id = $1 ORDER BY a.created_at DESC LIMIT 30`,
        id,
      ),
      prisma.accountDeletionRequest.findFirst({ where: { userId: id, status: { in: ['PENDING', 'PROCESSING', 'FAILED'] } }, orderBy: { createdAt: 'desc' } }),
    ]);

  const p = user.profile as (typeof user.profile & { userGender?: string | null }) | null;
  const providers = [...new Set(user.authIdentities.map((a) => a.provider))];
  if (!providers.length && user.passwordHash) providers.push('email');
  return {
    id: user.id,
    email: user.email,
    phone: user.phoneNumber,
    emailVerified: Boolean(user.emailVerifiedAt),
    status: user.status,
    joined: user.createdAt,
    lastActive: user.lastActiveAt,
    lastLogin: user.lastLoginAt,
    signIn: providers,
    profile: p && {
      name: p.displayName,
      language: p.preferredLanguage,
      gender: p.userGender ?? null,
      timezone: p.timezone,
      birthday: p.dateOfBirth,
      onboardingCompleted: p.onboardingCompleted,
      onboardingStep: p.onboardingCurrentStep,
    },
    devices: groupDevices([
      ...devices.map((d) => ({ platform: d.platform, appVersion: d.appVersion, os: d.osVersion, name: d.deviceName, lastSeen: d.lastSeenAt, active: !d.revokedAt })),
      ...pushDevices.map((d) => ({ platform: d.platform, appVersion: d.appVersion, os: null, name: null, lastSeen: d.lastSeenAt, active: d.isActive })),
    ]),
    activeSessions,
    allowance: { ...allowance, used: today },
    activity,
    subscriptions: subscriptions.map((s) => ({
      id: s.id,
      plan: s.plan.name,
      planCode: s.plan.code,
      status: s.status,
      provider: s.provider,
      periodEnd: s.currentPeriodEnd,
      trialEnd: s.trialEnd,
      cancelAtPeriodEnd: s.cancelAtPeriodEnd,
      createdAt: s.createdAt,
    })),
    purchases: purchases.map((t) => ({ id: t.id, product: t.productId, amount: t.amountMinorUnits / 100, currency: t.currency, status: t.status, at: t.createdAt })),
    wallet: wallet.map((w) => ({ id: w.id, type: w.type, amount: w.amount, balance: w.balanceAfter, description: w.description, at: w.createdAt })),
    characters,
    feedback: feedback.map((f) => ({
      id: f.id,
      messageId: f.messageId,
      rating: f.rating,
      reason: f.reasonCategory,
      text: f.feedbackText,
      character: f.message?.conversation?.character?.name ?? null,
      at: f.createdAt,
    })),
    support: support.map((s) => ({ id: s.id, topic: s.topic, message: s.message, status: s.status, reply: s.reply, at: s.createdAt })),
    safety,
    adminActions,
    deletion: deletion && { status: deletion.status, scheduledFor: deletion.scheduledFor, reason: deletion.reason },
    aiCost30d: (cost[0]?.usd ?? 0) * INR(),
  };
}

const audit = (adminId: string, action: string, userId: string, metadata: Record<string, unknown>) =>
  AuditService.log({ actorType: 'ADMIN', actorId: adminId, action, resourceType: 'USER', resourceId: userId, metadata });

const mustExist = (userId: string) =>
  prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true } }).catch(() => {
    throw new NotFoundError('User not found');
  });

/** Premium for N days, free (support, influencers, apologies). Shown as provider MOCK, id admin_…. */
export async function grantPremium(adminId: string, userId: string, days: number, reason: string) {
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new BadRequestError('Days must be between 1 and 365.');
  const plan = await prisma.billingPlan.findUnique({ where: { code: 'PREMIUM' } });
  if (!plan) throw new BadRequestError('The PREMIUM plan is not set up yet (run scripts/billing/setupPlayPlans.ts --apply).');
  await mustExist(userId);
  const now = new Date();
  const sub = await prisma.billingSubscription.create({
    data: {
      userId,
      planId: plan.id,
      status: 'ACTIVE',
      provider: 'MOCK',
      providerSubscriptionId: `admin_${randomUUID()}`,
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + days * 86_400_000),
      cancelAtPeriodEnd: true,
    },
  });
  await EntitlementService.invalidateUserEntitlementsCache(userId);
  await audit(adminId, 'console.user.premium_granted', userId, { days, reason, subscriptionId: sub.id });
  return { ok: true, until: sub.currentPeriodEnd };
}

/**
 * Ends Premium that an admin gave (provider MOCK). Paid Google Play subscriptions can't be ended from
 * here — Google owns those; the user cancels in the Play Store (or refund it in the Play Console).
 */
export async function removePremium(adminId: string, userId: string, reason: string) {
  const now = new Date();
  const res = await prisma.billingSubscription.updateMany({
    where: { userId, provider: 'MOCK', currentPeriodEnd: { gt: now }, status: { in: ['ACTIVE', 'TRIALING', 'GRACE_PERIOD', 'CANCELLED'] } },
    data: { status: 'EXPIRED', currentPeriodEnd: now, cancelAtPeriodEnd: true },
  });
  if (!res.count) throw new BadRequestError('No admin-given Premium to remove. Paid Google Play subscriptions are cancelled by the user or refunded in the Play Console.');
  await EntitlementService.invalidateUserEntitlementsCache(userId);
  await audit(adminId, 'console.user.premium_removed', userId, { reason, ended: res.count });
  return { ok: true, ended: res.count };
}

export async function addMessages(adminId: string, userId: string, amount: number, reason: string) {
  if (!Number.isInteger(amount) || amount < 1 || amount > 10_000) throw new BadRequestError('Amount must be between 1 and 10,000.');
  await CreditWalletService.grantCredits({
    userId,
    amount,
    type: 'GRANT',
    idempotencyKey: `admin_grant_${randomUUID()}`,
    description: `Added by admin: ${reason}`.slice(0, 200),
    referenceType: 'ADMIN',
    referenceId: adminId,
  });
  await audit(adminId, 'console.user.messages_added', userId, { amount, reason });
  Realtime.publish(userId, { type: 'billing.updated' });
  return { ok: true };
}

/** Gives them today's free messages back (the counter is per IST day; see messageAllowance.ts). */
export async function resetToday(adminId: string, userId: string, reason: string) {
  await mustExist(userId);
  const key = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
  await redis.del(`msgs:${userId}:${key}`);
  await audit(adminId, 'console.user.limit_reset', userId, { reason });
  Realtime.publish(userId, { type: 'billing.updated' });
  return { ok: true };
}

export async function setBlocked(adminId: string, userId: string, blocked: boolean, reason: string) {
  const user = await prisma.user.update({ where: { id: userId }, data: { status: blocked ? 'SUSPENDED' : 'ACTIVE' } }).catch(() => null);
  if (!user) throw new NotFoundError('User not found');
  if (blocked) await prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: 'admin_block' } }).catch(() => undefined);
  await audit(adminId, blocked ? 'console.user.blocked' : 'console.user.unblocked', userId, { reason });
  // Blocked: their open app signs out now, not at the next request.
  if (blocked) Realtime.publish(userId, { type: 'session.revoked' });
  return { ok: true, status: user.status };
}

/** Signs them out on every phone (they can sign in again) — e.g. a lost phone. */
export async function signOutEverywhere(adminId: string, userId: string, reason: string) {
  await mustExist(userId);
  const res = await prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: 'admin_sign_out' } });
  await audit(adminId, 'console.user.signed_out', userId, { reason, sessions: res.count });
  Realtime.publish(userId, { type: 'session.revoked' });
  return { ok: true, sessions: res.count };
}

/**
 * Deletes the account through the normal deletion pipeline (AccountDeletionService): 24 hours to
 * change your mind, then their chats, memories and login are erased; payments are kept, anonymised.
 */
export async function requestDeletion(adminId: string, userId: string, reason: string) {
  await mustExist(userId);
  const existing = await prisma.accountDeletionRequest.findFirst({ where: { userId, status: { in: ['PENDING', 'PROCESSING', 'FAILED'] } } });
  if (existing) return { ok: true, scheduledFor: existing.scheduledFor };
  const req = await prisma.accountDeletionRequest.create({
    data: { userId, status: 'PENDING', reason: `Admin: ${reason}`.slice(0, 1000), scheduledFor: new Date(Date.now() + 24 * 3600_000), anonymizeFinancialRecords: true },
  });
  await audit(adminId, 'console.user.deletion_requested', userId, { reason, requestId: req.id });
  return { ok: true, scheduledFor: req.scheduledFor };
}

export async function cancelDeletion(adminId: string, userId: string) {
  const { cancelled } = await AccountDeletionService.cancel(userId);
  if (!cancelled) throw new BadRequestError('Too late to cancel — the deletion has already started.');
  await audit(adminId, 'console.user.deletion_cancelled', userId, {});
  return { ok: true };
}

// ── What the characters remember (private: every opening is audited) ────────────────────────────

export async function getMemories(adminId: string, userId: string, reason: string) {
  await mustExist(userId);
  const [cards, memories] = await Promise.all([
    prisma.userCharacterProfile.findMany({ where: { userId }, include: { character: { select: { name: true, avatarUrl: true } } }, orderBy: { updatedAt: 'desc' } }),
    prisma.memory.findMany({
      where: { userId, status: 'ACTIVE', deletedAt: null },
      orderBy: [{ importanceScore: 'desc' }, { createdAt: 'desc' }],
      take: 200,
      select: { id: true, content: true, category: true, sensitivity: true, createdAt: true, character: { select: { name: true } } },
    }),
  ]);
  await audit(adminId, 'console.user.memories_viewed', userId, { reason });
  return {
    cards: cards.map((c) => ({ characterId: c.characterId, character: c.character.name, avatarUrl: c.character.avatarUrl, data: c.data, updatedAt: c.updatedAt })),
    memories: memories.map((m) => ({ id: m.id, content: m.content, category: m.category, sensitive: m.sensitivity !== 'NORMAL', character: m.character?.name ?? 'All characters', at: m.createdAt })),
  };
}

export async function deleteMemory(adminId: string, userId: string, memoryId: string, reason: string) {
  const res = await prisma.memory.updateMany({ where: { id: memoryId, userId, deletedAt: null }, data: { status: 'DELETED', deletedAt: new Date() } });
  if (!res.count) throw new NotFoundError('Memory not found');
  await audit(adminId, 'console.user.memory_deleted', userId, { memoryId, reason });
  return { ok: true };
}
