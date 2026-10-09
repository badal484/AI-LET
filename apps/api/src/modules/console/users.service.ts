import { randomUUID } from 'node:crypto';
import { prisma } from '../../infrastructure/database/prisma.js';
import { BadRequestError, NotFoundError } from '../../shared/errors/AppError.js';
import { AuditService } from '../audit/audit.service.js';
import { allowanceStatus } from '../billing/messageAllowance.js';
import { CreditWalletService } from '../billing/credits/CreditWalletService.js';
import { EntitlementService } from '../billing/entitlements/EntitlementService.js';
import { istMidnight, REAL_USERS } from './overview.service.js';

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
  messagesToday: number;
  messagesTotal: number;
}

// No active subscription → NULL → 'free' (an empty set must not fall through to 'premium').
const PLAN_SQL = `(SELECT CASE WHEN count(*) = 0 THEN NULL WHEN bool_or(s.status = 'TRIALING') THEN 'trial' ELSE 'premium' END
                     FROM billing_subscriptions s JOIN billing_plans p ON p.id = s.plan_id
                    WHERE s.user_id = u.id AND p.code <> 'FREE' AND s.current_period_end > now()
                      AND s.status IN ('TRIALING','ACTIVE','GRACE_PERIOD','CANCELLED'))`;

export async function listUsers(params: { search?: string; page?: number; filter?: string }) {
  const page = Math.max(1, params.page ?? 1);
  const size = 25;
  const search = params.search?.trim() ? `%${params.search.trim().toLowerCase()}%` : null;
  const filter = params.filter === 'premium' || params.filter === 'trial' || params.filter === 'free' || params.filter === 'blocked' ? params.filter : null;
  const where = `${REAL_USERS} AND u.status <> 'DELETED'
    ${search ? `AND (lower(u.email) LIKE $3 OR lower(coalesce(pr.display_name, '')) LIKE $3 OR u.id::text = $4)` : ''}
    ${filter === 'blocked' ? `AND u.status = 'SUSPENDED'` : ''}`;
  const args: unknown[] = [size, (page - 1) * size];
  if (search) args.push(search, params.search!.trim());

  const rows = await prisma.$queryRawUnsafe<Array<UserRow & { total: number }>>(
    `WITH base AS (
       SELECT u.id, pr.display_name AS name, u.email, u.status::text, u.created_at, u.last_active_at,
              coalesce(${PLAN_SQL}, 'free') AS plan
         FROM users u LEFT JOIN user_profiles pr ON pr.user_id = u.id
        WHERE ${where}
     )
     SELECT b.id, b.name, b.email, b.status, to_char(b.created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF') joined,
            to_char(b.last_active_at, 'YYYY-MM-DD"T"HH24:MI:SSOF') "lastActive", b.plan,
            (SELECT count(*)::int FROM messages m JOIN conversations c ON c.id = m.conversation_id
              WHERE c.user_id = b.id AND m.role = 'user' AND m.created_at >= '${istMidnight(0).toISOString()}') "messagesToday",
            (SELECT count(*)::int FROM messages m JOIN conversations c ON c.id = m.conversation_id
              WHERE c.user_id = b.id AND m.role = 'user') "messagesTotal",
            count(*) OVER ()::int total
       FROM base b
      WHERE ${filter && filter !== 'blocked' ? `b.plan = '${filter}'` : 'true'}
      ORDER BY b.last_active_at DESC NULLS LAST, b.created_at DESC
      LIMIT $1 OFFSET $2`,
    ...args,
  );
  return { users: rows.map(({ total: _t, ...r }) => r), total: rows[0]?.total ?? 0, page, pageSize: size };
}

export async function getUser(id: string) {
  const user = await prisma.user.findUnique({ where: { id }, include: { profile: true } });
  if (!user) throw new NotFoundError('User not found');
  const [subscriptions, allowance, characters, cost, purchases, today] = await Promise.all([
    prisma.billingSubscription.findMany({
      where: { userId: id },
      include: { plan: { select: { code: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    allowanceStatus(id),
    prisma.$queryRawUnsafe<Array<{ characterId: string; name: string; avatarUrl: string; messages: number; lastAt: string }>>(
      `SELECT ch.id "characterId", ch.name, ch.avatar_url "avatarUrl", count(m.id)::int messages,
              to_char(max(m.created_at), 'YYYY-MM-DD"T"HH24:MI:SSOF') "lastAt"
         FROM conversations c JOIN characters ch ON ch.id = c.character_id
         LEFT JOIN messages m ON m.conversation_id = c.id AND m.role = 'user'
        WHERE c.user_id = $1::uuid GROUP BY ch.id ORDER BY max(m.created_at) DESC NULLS LAST`,
      id,
    ),
    prisma.$queryRawUnsafe<Array<{ usd: number }>>(
      `SELECT coalesce(sum(estimated_cost), 0)::float usd FROM ai_usage_events WHERE user_id = $1::uuid AND created_at >= now() - interval '30 days'`,
      id,
    ),
    prisma.purchaseTransaction.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 10 }),
    // Messages actually sent today (the allowance counter only counts while limits are on).
    prisma.message.count({ where: { role: 'user', createdAt: { gte: istMidnight(0) }, conversation: { userId: id } } }),
  ]);
  const p = user.profile as (typeof user.profile & { userGender?: string | null }) | null;
  return {
    id: user.id,
    email: user.email,
    status: user.status,
    joined: user.createdAt,
    lastActive: user.lastActiveAt,
    profile: p && {
      name: p.displayName,
      language: p.preferredLanguage,
      gender: p.userGender ?? null,
      timezone: p.timezone,
      onboardingCompleted: p.onboardingCompleted,
    },
    allowance: { ...allowance, used: today },
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
    characters,
    aiCost30d: (cost[0]?.usd ?? 0) * INR(),
  };
}

const audit = (adminId: string, action: string, userId: string, metadata: Record<string, unknown>) =>
  AuditService.log({ actorType: 'ADMIN', actorId: adminId, action, resourceType: 'USER', resourceId: userId, metadata });

/** Premium for N days, free (support, influencers, apologies). Shown as provider MOCK, id admin_…. */
export async function grantPremium(adminId: string, userId: string, days: number, reason: string) {
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new BadRequestError('Days must be between 1 and 365.');
  const plan = await prisma.billingPlan.findUnique({ where: { code: 'PREMIUM' } });
  if (!plan) throw new BadRequestError('The PREMIUM plan is not set up yet (run scripts/billing/setupPlayPlans.ts --apply).');
  await prisma.user.findUniqueOrThrow({ where: { id: userId } }).catch(() => {
    throw new NotFoundError('User not found');
  });
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
  return { ok: true };
}

export async function setBlocked(adminId: string, userId: string, blocked: boolean, reason: string) {
  const user = await prisma.user.update({ where: { id: userId }, data: { status: blocked ? 'SUSPENDED' : 'ACTIVE' } }).catch(() => null);
  if (!user) throw new NotFoundError('User not found');
  if (blocked) await prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }).catch(() => undefined);
  await audit(adminId, blocked ? 'console.user.blocked' : 'console.user.unblocked', userId, { reason });
  return { ok: true, status: user.status };
}
