import { prisma } from '../../infrastructure/database/prisma.js';
import { BadRequestError, NotFoundError } from '../../shared/errors/AppError.js';
import { processImage, storageMode, storeImage, type ImageKind } from './media.js';
import { CharacterService } from '../characters/services/character.service.js';
import { AuditService } from '../audit/audit.service.js';
import { limitsEnforced } from '../billing/messageAllowance.js';
import { istMidnight, REAL_USERS } from './overview.service.js';
import { getSetting } from './appSettings.js';

/** Characters, Money and AI cost screens. Test/eval accounts are always left out. */

const INR = () => Number(process.env['INR_PER_USD'] ?? 88);
const SUB_ACTIVE = `s.current_period_end > now() AND s.status IN ('TRIALING','ACTIVE','GRACE_PERIOD','CANCELLED')`;

// ── Characters ───────────────────────────────────────────────────────────────

export async function listCharacters() {
  const rows = await prisma.$queryRawUnsafe<
    Array<{ id: string; slug: string; name: string; tagline: string; avatarUrl: string; coverImageUrl: string; gallery: string[]; category: string; status: string; featured: boolean; users7d: number; messages7d: number; usersTotal: number; payingUsers: number; usd7d: number; likes: number; dislikes: number; samePhoto: number }>
  >(
    `SELECT ch.id, ch.slug, ch.name, ch.tagline, ch.avatar_url "avatarUrl", ch.cover_image_url "coverImageUrl",
            coalesce((SELECT d.localized_profiles->'galleryImages' FROM character_discovery_configs d WHERE d.character_id = ch.id), '[]'::jsonb) gallery, ch.category, ch.status::text, ch.is_featured featured,
            coalesce(a.users7d, 0) "users7d", coalesce(a.messages7d, 0) "messages7d", coalesce(t.users, 0) "usersTotal",
            coalesce(p.paying, 0) "payingUsers", coalesce(cst.usd, 0)::float "usd7d",
            coalesce(f.likes, 0) likes, coalesce(f.dislikes, 0) dislikes,
            (SELECT count(*)::int FROM characters o WHERE o.id <> ch.id AND o.status <> 'ARCHIVED' AND split_part(o.avatar_url, '?', 1) = split_part(ch.avatar_url, '?', 1)) "samePhoto"
       FROM characters ch
       LEFT JOIN (
         SELECT c.character_id, count(DISTINCT c.user_id)::int users7d, count(m.id)::int messages7d
           FROM messages m JOIN conversations c ON c.id = m.conversation_id JOIN users u ON u.id = c.user_id
          WHERE m.role = 'user' AND m.created_at >= now() - interval '7 days' AND ${REAL_USERS} GROUP BY 1
       ) a ON a.character_id = ch.id
       LEFT JOIN (
         SELECT c.character_id, count(DISTINCT c.user_id)::int users FROM conversations c JOIN users u ON u.id = c.user_id WHERE ${REAL_USERS} GROUP BY 1
       ) t ON t.character_id = ch.id
       LEFT JOIN (
         SELECT c.character_id, count(DISTINCT c.user_id)::int paying
           FROM conversations c JOIN users u ON u.id = c.user_id
           JOIN billing_subscriptions s ON s.user_id = u.id JOIN billing_plans pl ON pl.id = s.plan_id
          WHERE pl.code <> 'FREE' AND ${SUB_ACTIVE} AND ${REAL_USERS} GROUP BY 1
       ) p ON p.character_id = ch.id
       LEFT JOIN (
         SELECT e.character_id, sum(e.estimated_cost) usd FROM ai_usage_events e LEFT JOIN users u ON u.id = e.user_id
          WHERE e.created_at >= now() - interval '7 days' AND (e.user_id IS NULL OR ${REAL_USERS}) GROUP BY 1
       ) cst ON cst.character_id = ch.id
       LEFT JOIN (
         SELECT c.character_id, count(*) FILTER (WHERE mf.rating = 'THUMBS_UP')::int likes, count(*) FILTER (WHERE mf.rating = 'THUMBS_DOWN')::int dislikes
           FROM message_feedback mf JOIN messages m ON m.id = mf.message_id JOIN conversations c ON c.id = m.conversation_id JOIN users u ON u.id = mf.user_id
          WHERE mf.created_at >= now() - interval '30 days' AND ${REAL_USERS} GROUP BY 1
       ) f ON f.character_id = ch.id
      WHERE ch.status <> 'ARCHIVED'
      ORDER BY coalesce(a.messages7d, 0) DESC, ch.name`,
  );
  return rows.map(({ usd7d, ...r }) => ({ ...r, aiCost7d: usd7d * INR(), aiCostPerMessage: r.messages7d ? (usd7d * INR()) / r.messages7d : null }));
}

/** One character's page: usage over 30 days, who comes back, ratings, relationship stages, cost. */
export async function getCharacter(id: string) {
  const ch = await prisma.character.findUnique({
    where: { id },
    select: { id: true, name: true, tagline: true, avatarUrl: true, category: true, status: true, isFeatured: true, createdAt: true },
  });
  if (!ch) throw new NotFoundError('Character not found');
  const one = async <T>(sql: string) => ((await prisma.$queryRawUnsafe<T[]>(sql, id))[0] ?? {}) as T;
  const [series, totals, ret, stages, ratings, disliked, topUsers, cost] = await Promise.all([
    prisma.$queryRawUnsafe<Array<{ day: string; messages: number; users: number }>>(
      `WITH d AS (SELECT generate_series((now() AT TIME ZONE 'Asia/Kolkata')::date - 29, (now() AT TIME ZONE 'Asia/Kolkata')::date, '1 day')::date dt),
       m AS (SELECT (m.created_at AT TIME ZONE 'Asia/Kolkata')::date dt, count(*)::int messages, count(DISTINCT c.user_id)::int users
               FROM messages m JOIN conversations c ON c.id = m.conversation_id JOIN users u ON u.id = c.user_id
              WHERE c.character_id = $1::uuid AND m.role = 'user' AND m.created_at >= now() - interval '31 days' AND ${REAL_USERS} GROUP BY 1)
       SELECT to_char(d.dt, 'YYYY-MM-DD') AS "day", coalesce(m.messages, 0) messages, coalesce(m.users, 0) users FROM d LEFT JOIN m USING (dt) ORDER BY d.dt`,
      id,
    ),
    one<{ users: number; messages: number; users7d: number }>(
      `SELECT count(DISTINCT c.user_id)::int users, count(m.id)::int messages,
              count(DISTINCT c.user_id) FILTER (WHERE m.created_at >= now() - interval '7 days')::int users7d
         FROM conversations c JOIN users u ON u.id = c.user_id LEFT JOIN messages m ON m.conversation_id = c.id AND m.role = 'user'
        WHERE c.character_id = $1::uuid AND ${REAL_USERS}`,
    ),
    // People who talked to them on 2+ different days, of everyone who talked to them.
    one<{ talked: number; returned: number }>(
      `SELECT count(*)::int talked, count(*) FILTER (WHERE days >= 2)::int returned FROM (
         SELECT c.user_id, count(DISTINCT (m.created_at AT TIME ZONE 'Asia/Kolkata')::date) days
           FROM conversations c JOIN users u ON u.id = c.user_id JOIN messages m ON m.conversation_id = c.id AND m.role = 'user'
          WHERE c.character_id = $1::uuid AND ${REAL_USERS} GROUP BY 1) x`,
    ),
    prisma.$queryRawUnsafe<Array<{ stage: string; n: number }>>(
      `SELECT r.stage::text, count(*)::int n FROM relationships r JOIN users u ON u.id = r.user_id WHERE r.character_id = $1::uuid AND ${REAL_USERS} GROUP BY 1`,
      id,
    ),
    one<{ likes: number; dislikes: number }>(
      `SELECT count(*) FILTER (WHERE mf.rating = 'THUMBS_UP')::int likes, count(*) FILTER (WHERE mf.rating = 'THUMBS_DOWN')::int dislikes
         FROM message_feedback mf JOIN messages m ON m.id = mf.message_id JOIN conversations c ON c.id = m.conversation_id JOIN users u ON u.id = mf.user_id
        WHERE c.character_id = $1::uuid AND ${REAL_USERS}`,
    ),
    prisma.$queryRawUnsafe<Array<{ messageId: string; reason: string | null; text: string | null; at: string }>>(
      `SELECT mf.message_id "messageId", mf.reason_category reason, mf.feedback_text text, to_char(mf.created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF') "at"
         FROM message_feedback mf JOIN messages m ON m.id = mf.message_id JOIN conversations c ON c.id = m.conversation_id JOIN users u ON u.id = mf.user_id
        WHERE c.character_id = $1::uuid AND mf.rating = 'THUMBS_DOWN' AND ${REAL_USERS} ORDER BY mf.created_at DESC LIMIT 20`,
      id,
    ),
    prisma.$queryRawUnsafe<Array<{ userId: string; name: string | null; email: string; messages: number; lastAt: string }>>(
      `SELECT u.id "userId", pr.display_name name, u.email, count(m.id)::int messages, to_char(max(m.created_at), 'YYYY-MM-DD"T"HH24:MI:SSOF') "lastAt"
         FROM conversations c JOIN users u ON u.id = c.user_id LEFT JOIN user_profiles pr ON pr.user_id = u.id
         JOIN messages m ON m.conversation_id = c.id AND m.role = 'user'
        WHERE c.character_id = $1::uuid AND ${REAL_USERS} GROUP BY u.id, pr.display_name ORDER BY 4 DESC LIMIT 10`,
      id,
    ),
    one<{ usd: number; messages: number }>(
      `SELECT coalesce((SELECT sum(e.estimated_cost) FROM ai_usage_events e WHERE e.character_id = $1::uuid AND e.created_at >= now() - interval '30 days'), 0)::float usd,
              (SELECT count(*)::int FROM messages m JOIN conversations c ON c.id = m.conversation_id
                WHERE c.character_id = $1::uuid AND m.role = 'user' AND m.created_at >= now() - interval '30 days') messages`,
    ),
  ]);
  const cost30d = (cost.usd ?? 0) * INR();
  return {
    ...ch,
    totals: { users: totals.users ?? 0, users7d: totals.users7d ?? 0, messages: totals.messages ?? 0, perUser: totals.users ? (totals.messages ?? 0) / totals.users : null },
    returning: { talked: ret.talked ?? 0, returned: ret.returned ?? 0 },
    stages,
    ratings: { likes: ratings.likes ?? 0, dislikes: ratings.dislikes ?? 0 },
    disliked,
    topUsers,
    cost: { last30d: cost30d, perMessage: cost.messages ? cost30d / cost.messages : null },
    series,
  };
}

export async function updateCharacter(adminId: string, id: string, patch: { live?: boolean; featured?: boolean; name?: string; tagline?: string }) {
  const before = await prisma.character.findUnique({ where: { id }, select: { status: true, isFeatured: true, name: true, tagline: true } });
  if (!before) throw new NotFoundError('Character not found');
  const name = patch.name?.trim();
  const tagline = patch.tagline?.trim();
  if (name !== undefined && (name.length < 2 || name.length > 100)) throw new BadRequestError('Name must be 2–100 characters.');
  if (tagline !== undefined && (tagline.length < 2 || tagline.length > 255)) throw new BadRequestError('Tagline must be 2–255 characters.');
  const ch = await prisma.character.update({
    where: { id },
    data: {
      ...(patch.live !== undefined && { status: patch.live ? 'PUBLISHED' : 'UNPUBLISHED' }),
      ...(patch.featured !== undefined && { isFeatured: patch.featured }),
      ...(name !== undefined && { name }),
      ...(tagline !== undefined && { tagline }),
    },
    select: { id: true, slug: true, status: true, isFeatured: true, name: true, tagline: true },
  });
  await CharacterService.invalidateCharacterCache(id, ch.slug).catch(() => undefined);
  await AuditService.log({
    actorType: 'ADMIN',
    actorId: adminId,
    action: 'console.character.updated',
    resourceType: 'CHARACTER',
    resourceId: id,
    metadata: { name: before.name, before: { status: before.status, featured: before.isFeatured }, after: { status: ch.status, featured: ch.isFeatured } },
  });
  return ch;
}

// ── Money ────────────────────────────────────────────────────────────────────

export async function getMoney() {
  const one = async <T>(sql: string) => ((await prisma.$queryRawUnsafe<T[]>(sql))[0] ?? {}) as T;
  const [totals, series, subs, trials, packs, recent] = await Promise.all([
    one<{ today: number; d7: number; d30: number; all: number }>(
      `SELECT coalesce(sum(t.amount_minor_units) FILTER (WHERE t.created_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')), 0)::int today,
              coalesce(sum(t.amount_minor_units) FILTER (WHERE t.created_at >= now() - interval '7 days'), 0)::int d7,
              coalesce(sum(t.amount_minor_units) FILTER (WHERE t.created_at >= now() - interval '30 days'), 0)::int d30,
              coalesce(sum(t.amount_minor_units), 0)::int "all"
         FROM purchase_transactions t JOIN users u ON u.id = t.user_id
        WHERE t.status = 'SUCCEEDED' AND t.currency = 'INR' AND ${REAL_USERS}`,
    ),
    prisma.$queryRawUnsafe<Array<{ day: string; paise: number; subs: number; packs: number }>>(
      `WITH d AS (SELECT generate_series((now() AT TIME ZONE 'Asia/Kolkata')::date - 29, (now() AT TIME ZONE 'Asia/Kolkata')::date, '1 day')::date dt),
       r AS (SELECT (t.created_at AT TIME ZONE 'Asia/Kolkata')::date dt, sum(t.amount_minor_units)::int paise,
                    count(*) FILTER (WHERE t.product_id NOT LIKE 'messages%')::int subs, count(*) FILTER (WHERE t.product_id LIKE 'messages%')::int packs
               FROM purchase_transactions t JOIN users u ON u.id = t.user_id
              WHERE t.status = 'SUCCEEDED' AND t.currency = 'INR' AND t.created_at >= now() - interval '31 days' AND ${REAL_USERS} GROUP BY 1)
       SELECT to_char(d.dt, 'YYYY-MM-DD') AS "day", coalesce(r.paise, 0) paise, coalesce(r.subs, 0) subs, coalesce(r.packs, 0) packs
         FROM d LEFT JOIN r USING (dt) ORDER BY d.dt`,
    ),
    prisma.$queryRawUnsafe<Array<{ status: string; manual: boolean; n: number }>>(
      `SELECT s.status::text, (s.provider = 'MOCK') manual, count(*)::int n
         FROM billing_subscriptions s JOIN billing_plans pl ON pl.id = s.plan_id JOIN users u ON u.id = s.user_id
        WHERE pl.code <> 'FREE' AND ${SUB_ACTIVE} AND ${REAL_USERS} GROUP BY 1, 2`,
    ),
    one<{ started: number; converted: number; cancelled: number }>(
      `SELECT count(*) FILTER (WHERE s.trial_start >= now() - interval '30 days')::int started,
              count(*) FILTER (WHERE s.trial_start BETWEEN now() - interval '30 days' AND now() - interval '4 days' AND s.status IN ('ACTIVE','GRACE_PERIOD'))::int converted,
              count(*) FILTER (WHERE s.cancelled_at >= now() - interval '30 days')::int cancelled
         FROM billing_subscriptions s JOIN users u ON u.id = s.user_id WHERE ${REAL_USERS}`,
    ),
    one<{ sold: number }>(
      `SELECT count(*)::int sold FROM purchase_transactions t JOIN users u ON u.id = t.user_id
        WHERE t.status = 'SUCCEEDED' AND t.product_id LIKE 'messages%' AND t.created_at >= now() - interval '30 days' AND ${REAL_USERS}`,
    ),
    prisma.$queryRawUnsafe<Array<{ id: string; userId: string; email: string; product: string; paise: number; status: string; at: string }>>(
      `SELECT t.id, u.id "userId", u.email, t.product_id product, t.amount_minor_units paise, t.status::text, to_char(t.created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF') at
         FROM purchase_transactions t JOIN users u ON u.id = t.user_id WHERE ${REAL_USERS} ORDER BY t.created_at DESC LIMIT 25`,
    ),
  ]);
  const extras = await moneyExtras();
  const bySubStatus = (s: string, manual = false) => subs.filter((x) => x.status === s && x.manual === manual).reduce((a, x) => a + x.n, 0);
  return {
    revenue: { today: (totals.today ?? 0) / 100, week: (totals.d7 ?? 0) / 100, month: (totals.d30 ?? 0) / 100, allTime: (totals.all ?? 0) / 100 },
    series: series.map((r) => ({ day: r.day, revenue: r.paise / 100, subscriptions: r.subs, packs: r.packs })),
    subscribers: {
      paying: bySubStatus('ACTIVE') + bySubStatus('GRACE_PERIOD'),
      trialing: bySubStatus('TRIALING'),
      cancelling: bySubStatus('CANCELLED'),
      freeByAdmin: subs.filter((x) => x.manual).reduce((a, x) => a + x.n, 0),
    },
    trials: { started30d: trials.started ?? 0, converted: trials.converted ?? 0, cancelled30d: trials.cancelled ?? 0 },
    packsSold30d: packs.sold ?? 0,
    recent: recent.map((r) => ({ ...r, amount: r.paise / 100 })),
    ...extras,
    // Prices include 18% GST; Google keeps 15% of what's left (small-developer rate). An estimate.
    keep30d: ((totals.d30 ?? 0) / 100 / 1.18) * 0.85,
    limits: {
      enforced: await limitsEnforced(),
      freeDaily: await getSetting('limits.freeDaily'),
      premiumDaily: await getSetting('limits.premiumDaily'),
    },
  };
}

const PEOPLE = `u.id "userId", coalesce(pr.display_name, u.email) "user"`;
const PEOPLE_JOIN = `JOIN users u ON u.id = s.user_id LEFT JOIN user_profiles pr ON pr.user_id = u.id JOIN billing_plans pl ON pl.id = s.plan_id LEFT JOIN billing_prices bp ON bp.id = s.price_id`;
const AT = (col: string) => `to_char(${col}, 'YYYY-MM-DD"T"HH24:MI:SSOF')`;

/** Recurring revenue, revenue by product, and the people behind it: renewals, payment trouble, cancellations, refunds. */
async function moneyExtras() {
  type Person = { userId: string; user: string; plan: string; interval: string | null; amount: number | null; at: string };
  const people = (sql: string) => prisma.$queryRawUnsafe<Person[]>(sql);
  const [mrr, byProduct, renewals, trouble, cancellations, refunds] = await Promise.all([
    prisma.$queryRawUnsafe<Array<{ monthly: number; subs: number }>>(
      `SELECT coalesce(sum(CASE bp.billing_interval WHEN 'WEEK' THEN bp.amount_minor_units * 52 / 12.0 WHEN 'YEAR' THEN bp.amount_minor_units / 12.0
                                                    WHEN 'MONTH' THEN bp.amount_minor_units ELSE 39900 END), 0)::float / 100 monthly, count(*)::int subs
         FROM billing_subscriptions s ${PEOPLE_JOIN}
        WHERE s.provider <> 'MOCK' AND pl.code <> 'FREE' AND s.status IN ('ACTIVE','GRACE_PERIOD') AND s.current_period_end > now() AND NOT s.cancel_at_period_end AND ${REAL_USERS}`,
    ),
    prisma.$queryRawUnsafe<Array<{ product: string; sales: number; paise: number }>>(
      `SELECT t.product_id product, count(*)::int sales, sum(t.amount_minor_units)::int paise
         FROM purchase_transactions t JOIN users u ON u.id = t.user_id
        WHERE t.status = 'SUCCEEDED' AND t.currency = 'INR' AND t.created_at >= now() - interval '30 days' AND ${REAL_USERS}
        GROUP BY 1 ORDER BY 3 DESC`,
    ),
    people(
      `SELECT ${PEOPLE}, pl.name plan, bp.billing_interval::text "interval", bp.amount_minor_units / 100.0 amount, ${AT('s.current_period_end')} "at"
         FROM billing_subscriptions s ${PEOPLE_JOIN}
        WHERE s.provider <> 'MOCK' AND s.status IN ('ACTIVE','TRIALING') AND NOT s.cancel_at_period_end
          AND s.current_period_end BETWEEN now() AND now() + interval '7 days' AND ${REAL_USERS}
        ORDER BY s.current_period_end LIMIT 50`,
    ),
    people(
      `SELECT ${PEOPLE}, pl.name plan, s.status::text "interval", bp.amount_minor_units / 100.0 amount, ${AT('coalesce(s.grace_period_end, s.current_period_end)')} "at"
         FROM billing_subscriptions s ${PEOPLE_JOIN}
        WHERE s.provider <> 'MOCK' AND s.status IN ('GRACE_PERIOD','PAST_DUE','PAYMENT_FAILED','PAUSED')
          AND coalesce(s.grace_period_end, s.current_period_end) > now() - interval '30 days' AND ${REAL_USERS}
        ORDER BY 6 DESC LIMIT 50`,
    ),
    people(
      `SELECT ${PEOPLE}, pl.name plan, bp.billing_interval::text "interval", bp.amount_minor_units / 100.0 amount, ${AT('coalesce(s.cancelled_at, s.updated_at)')} "at"
         FROM billing_subscriptions s ${PEOPLE_JOIN}
        WHERE s.provider <> 'MOCK' AND (s.cancelled_at >= now() - interval '30 days' OR (s.cancel_at_period_end AND s.current_period_end > now())) AND ${REAL_USERS}
        ORDER BY 6 DESC LIMIT 50`,
    ),
    prisma.$queryRawUnsafe<Array<{ userId: string; user: string; product: string; amount: number; reason: string | null; at: string }>>(
      `SELECT u.id "userId", coalesce(pr.display_name, u.email) "user", t.product_id product, t.amount_minor_units / 100.0 amount, t.refund_reason reason,
              ${AT('coalesce(t.refunded_at, t.updated_at)')} "at"
         FROM purchase_transactions t JOIN users u ON u.id = t.user_id LEFT JOIN user_profiles pr ON pr.user_id = u.id
        WHERE t.status IN ('REFUNDED','DISPUTED') AND t.updated_at >= now() - interval '90 days' AND ${REAL_USERS}
        ORDER BY 6 DESC LIMIT 50`,
    ),
  ]);
  const num = <T extends { amount: number | null }>(rows: T[]) => rows.map((r) => ({ ...r, amount: r.amount == null ? null : Number(r.amount) }));
  return {
    mrr: { monthly: mrr[0]?.monthly ?? 0, subscriptions: mrr[0]?.subs ?? 0 },
    byProduct: byProduct.map((r) => ({ product: r.product, sales: r.sales, revenue: r.paise / 100 })),
    renewals: num(renewals),
    trouble: num(trouble),
    cancellations: num(cancellations),
    refunds: num(refunds),
  };
}

/** Every transaction as CSV, for the accountant / GST filing. */
export async function transactionsCsv(from?: string, to?: string): Promise<string> {
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, string | number>>>(
    `SELECT to_char(t.created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') "date_ist", t.provider_transaction_id "order_id",
            t.product_id product, (t.amount_minor_units / 100.0)::numeric(12,2) amount, t.currency::text currency, t.status::text status,
            t.provider::text provider, u.email
       FROM purchase_transactions t JOIN users u ON u.id = t.user_id
      WHERE ${REAL_USERS} AND t.created_at >= coalesce($1::date, '2000-01-01') AND t.created_at < coalesce($2::date, '2999-01-01') + interval '1 day'
      ORDER BY t.created_at`,
    from ?? null,
    to ?? null,
  );
  const cols = ['date_ist', 'order_id', 'product', 'amount', 'currency', 'status', 'provider', 'email'];
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

// ── AI cost ──────────────────────────────────────────────────────────────────

export async function getAiCost(days = 30) {
  const since = `now() - interval '${Math.min(Math.max(days, 1), 90)} days'`;
  const filt = `e.created_at >= ${since} AND (e.user_id IS NULL OR ${REAL_USERS})`;
  const [byTask, byModel, byCharacter, series, msgs] = await Promise.all([
    prisma.$queryRawUnsafe<Array<{ key: string; calls: number; usd: number; input: number; cached: number; output: number }>>(
      `SELECT e.task key, count(*)::int calls, sum(e.estimated_cost)::float usd, sum(e.input_tokens)::bigint::float input, sum(e.cached_tokens)::bigint::float cached, sum(e.output_tokens)::bigint::float output
         FROM ai_usage_events e LEFT JOIN users u ON u.id = e.user_id WHERE ${filt} GROUP BY 1 ORDER BY 3 DESC`,
    ),
    prisma.$queryRawUnsafe<Array<{ key: string; calls: number; usd: number }>>(
      `SELECT e.model key, count(*)::int calls, sum(e.estimated_cost)::float usd FROM ai_usage_events e LEFT JOIN users u ON u.id = e.user_id WHERE ${filt} GROUP BY 1 ORDER BY 3 DESC`,
    ),
    prisma.$queryRawUnsafe<Array<{ key: string; calls: number; usd: number }>>(
      `SELECT coalesce(ch.name, 'Background / other') key, count(*)::int calls, sum(e.estimated_cost)::float usd
         FROM ai_usage_events e LEFT JOIN users u ON u.id = e.user_id LEFT JOIN characters ch ON ch.id = e.character_id
        WHERE ${filt} GROUP BY 1 ORDER BY 3 DESC LIMIT 40`,
    ),
    prisma.$queryRawUnsafe<Array<{ day: string; usd: number; messages: number }>>(
      `WITH d AS (SELECT generate_series((now() AT TIME ZONE 'Asia/Kolkata')::date - ${Math.min(Math.max(days, 1), 90) - 1}, (now() AT TIME ZONE 'Asia/Kolkata')::date, '1 day')::date dt),
       c AS (SELECT (e.created_at AT TIME ZONE 'Asia/Kolkata')::date dt, sum(e.estimated_cost)::float usd FROM ai_usage_events e LEFT JOIN users u ON u.id = e.user_id WHERE ${filt} GROUP BY 1),
       m AS (SELECT (m.created_at AT TIME ZONE 'Asia/Kolkata')::date dt, count(*)::int messages FROM messages m JOIN conversations cv ON cv.id = m.conversation_id JOIN users u ON u.id = cv.user_id
              WHERE m.role = 'user' AND m.created_at >= ${since} AND ${REAL_USERS} GROUP BY 1)
       SELECT to_char(d.dt, 'YYYY-MM-DD') AS "day", coalesce(c.usd, 0) usd, coalesce(m.messages, 0) messages FROM d LEFT JOIN c USING (dt) LEFT JOIN m USING (dt) ORDER BY d.dt`,
    ),
    prisma.$queryRawUnsafe<Array<{ n: number }>>(
      `SELECT count(*)::int n FROM messages m JOIN conversations c ON c.id = m.conversation_id JOIN users u ON u.id = c.user_id
        WHERE m.role = 'user' AND m.created_at >= ${since} AND ${REAL_USERS}`,
    ),
  ]);
  const extra = await aiCostExtras(filt);
  const total = byTask.reduce((a, r) => a + r.usd, 0) * INR();
  const input = byTask.reduce((a, r) => a + r.input, 0);
  const toInr = (rows: Array<{ key: string; calls: number; usd: number }>) => rows.map((r) => ({ key: r.key, calls: r.calls, cost: r.usd * INR() }));
  return {
    days,
    total,
    messages: msgs[0]?.n ?? 0,
    perMessage: msgs[0]?.n ? total / msgs[0].n : null,
    cachedShare: input ? byTask.reduce((a, r) => a + r.cached, 0) / input : 0,
    byTask: toInr(byTask),
    byModel: toInr(byModel),
    byCharacter: toInr(byCharacter),
    series: series.map((r) => ({ day: r.day, cost: r.usd * INR(), messages: r.messages, perMessage: r.messages ? (r.usd * INR()) / r.messages : null })),
    ...extra,
  };
}

/** Month-end projection, today's spend vs the daily budget, the costliest users, and failed AI calls. */
async function aiCostExtras(filt: string) {
  const one = async <T>(sql: string) => ((await prisma.$queryRawUnsafe<T[]>(sql))[0] ?? {}) as T;
  const ist = `(now() AT TIME ZONE 'Asia/Kolkata')`;
  const [month, today, topUsers, failed, recentFailures, budget] = await Promise.all([
    one<{ mtd: number; last7: number; day: number; days: number }>(
      `SELECT coalesce(sum(estimated_cost) FILTER (WHERE (created_at AT TIME ZONE 'Asia/Kolkata') >= date_trunc('month', ${ist})), 0)::float mtd,
              coalesce(sum(estimated_cost) FILTER (WHERE created_at >= now() - interval '7 days'), 0)::float last7,
              extract(day FROM ${ist})::int "day",
              extract(day FROM date_trunc('month', ${ist}) + interval '1 month' - interval '1 day')::int days
         FROM ai_usage_events WHERE created_at >= now() - interval '40 days'`,
    ),
    one<{ usd: number }>(`SELECT coalesce(sum(estimated_cost), 0)::float usd FROM ai_usage_events WHERE created_at >= '${istMidnight(0).toISOString()}'`),
    prisma.$queryRawUnsafe<Array<{ userId: string; user: string; calls: number; usd: number; messages: number }>>(
      `SELECT u.id "userId", coalesce(pr.display_name, u.email) "user", count(*)::int calls, sum(e.estimated_cost)::float usd,
              (SELECT count(*)::int FROM messages m JOIN conversations c ON c.id = m.conversation_id
                WHERE c.user_id = u.id AND m.role = 'user' AND m.created_at >= now() - interval '30 days') messages
         FROM ai_usage_events e JOIN users u ON u.id = e.user_id LEFT JOIN user_profiles pr ON pr.user_id = u.id
        WHERE ${filt} GROUP BY u.id, pr.display_name ORDER BY 4 DESC LIMIT 10`,
    ),
    one<{ failed: number; calls: number }>(
      `SELECT count(*) FILTER (WHERE e.status = 'FAILED')::int failed, count(*)::int calls FROM ai_usage_events e LEFT JOIN users u ON u.id = e.user_id WHERE ${filt}`,
    ),
    prisma.$queryRawUnsafe<Array<{ at: string; model: string; task: string; cause: string | null }>>(
      `SELECT to_char(e.created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF') "at", e.model, e.task, e.breakdown->>'cause' cause
         FROM ai_usage_events e LEFT JOIN users u ON u.id = e.user_id WHERE ${filt} AND e.status = 'FAILED' ORDER BY e.created_at DESC LIMIT 10`,
    ),
    getSetting('ai.dailyBudget'),
  ]);
  const mtd = (month.mtd ?? 0) * INR();
  const perDay = ((month.last7 ?? 0) * INR()) / 7;
  return {
    projection: { monthToDate: mtd, perDay, monthEnd: mtd + perDay * Math.max(0, (month.days ?? 30) - (month.day ?? 1)) },
    today: { cost: (today.usd ?? 0) * INR(), budget: budget || null },
    topUsers: topUsers.map((r) => ({ userId: r.userId, user: r.user, calls: r.calls, messages: r.messages, cost: r.usd * INR(), perMessage: r.messages ? (r.usd * INR()) / r.messages : null })),
    failures: { failed: failed.failed ?? 0, calls: failed.calls ?? 0, recent: recentFailures },
  };
}

/** A new profile or cover photo, uploaded from the admin console (processed and stored by media.ts). */
export async function setCharacterImage(adminId: string, id: string, kind: ImageKind, body: Buffer) {
  const ch = await prisma.character.findUnique({ where: { id }, select: { slug: true, avatarUrl: true, coverImageUrl: true } });
  if (!ch) throw new NotFoundError('Character not found');
  const url = await storeImage(await processImage(body, kind), `characters/${ch.slug}`, kind);
  await prisma.character.update({ where: { id }, data: kind === 'avatar' ? { avatarUrl: url } : { coverImageUrl: url } });
  await CharacterService.invalidateCharacterCache(id, ch.slug).catch(() => undefined);
  await AuditService.log({
    actorType: 'ADMIN',
    actorId: adminId,
    action: 'console.character.image',
    resourceType: 'CHARACTER',
    resourceId: id,
    metadata: { kind, before: kind === 'avatar' ? ch.avatarUrl : ch.coverImageUrl, after: url, storage: storageMode() },
  });
  return { url, storage: storageMode() };
}

// ── Character gallery (the photo grid on the character's profile in the app) ────

const MAX_GALLERY = 12;

async function readGallery(characterId: string): Promise<{ images: string[]; profiles: Record<string, unknown> }> {
  const cfg = await prisma.characterDiscoveryConfig.findUnique({ where: { characterId }, select: { localizedProfiles: true } });
  const profiles = (cfg?.localizedProfiles ?? {}) as Record<string, unknown>;
  const images = Array.isArray(profiles['galleryImages']) ? (profiles['galleryImages'] as unknown[]).filter((x): x is string => typeof x === 'string') : [];
  return { images, profiles };
}

async function writeGallery(characterId: string, profiles: Record<string, unknown>, images: string[]) {
  const localizedProfiles = { ...profiles, galleryImages: images } as never;
  await prisma.characterDiscoveryConfig.upsert({ where: { characterId }, create: { characterId, localizedProfiles }, update: { localizedProfiles } });
}

/** Adds one photo to the end of the gallery. */
export async function addGalleryImage(adminId: string, id: string, body: Buffer) {
  const ch = await prisma.character.findUnique({ where: { id }, select: { slug: true } });
  if (!ch) throw new NotFoundError('Character not found');
  const { images, profiles } = await readGallery(id);
  if (images.length >= MAX_GALLERY) throw new BadRequestError(`A gallery can have up to ${MAX_GALLERY} photos — remove one first.`);
  const url = await storeImage(await processImage(body, 'gallery'), `characters/${ch.slug}`, 'gallery');
  const next = [...images, url];
  await writeGallery(id, profiles, next);
  await CharacterService.invalidateCharacterCache(id, ch.slug).catch(() => undefined);
  await AuditService.log({ actorType: 'ADMIN', actorId: adminId, action: 'console.character.gallery_added', resourceType: 'CHARACTER', resourceId: id, metadata: { url, count: next.length } });
  return { gallery: next, storage: storageMode() };
}

/** Reorders or removes photos: the new list must only contain photos already in the gallery. */
export async function setGallery(adminId: string, id: string, list: unknown) {
  const ch = await prisma.character.findUnique({ where: { id }, select: { slug: true } });
  if (!ch) throw new NotFoundError('Character not found');
  if (!Array.isArray(list) || list.some((x) => typeof x !== 'string')) throw new BadRequestError('Send the photo list.');
  const { images, profiles } = await readGallery(id);
  const next = [...new Set(list as string[])];
  if (next.some((u) => !images.includes(u))) throw new BadRequestError('Only photos already in the gallery can be kept or reordered.');
  await writeGallery(id, profiles, next);
  await CharacterService.invalidateCharacterCache(id, ch.slug).catch(() => undefined);
  await AuditService.log({ actorType: 'ADMIN', actorId: adminId, action: 'console.character.gallery_changed', resourceType: 'CHARACTER', resourceId: id, metadata: { before: images.length, after: next.length, removed: images.filter((u) => !next.includes(u)) } });
  return { gallery: next };
}
