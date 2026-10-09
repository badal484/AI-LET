import { prisma } from '../../infrastructure/database/prisma.js';
import { NotFoundError } from '../../shared/errors/AppError.js';
import { AuditService } from '../audit/audit.service.js';
import { limitsEnforced } from '../billing/messageAllowance.js';
import { REAL_USERS } from './overview.service.js';
import { getSetting } from './appSettings.js';

/** Characters, Money and AI cost screens. Test/eval accounts are always left out. */

const INR = () => Number(process.env['INR_PER_USD'] ?? 88);
const SUB_ACTIVE = `s.current_period_end > now() AND s.status IN ('TRIALING','ACTIVE','GRACE_PERIOD','CANCELLED')`;

// ── Characters ───────────────────────────────────────────────────────────────

export async function listCharacters() {
  const rows = await prisma.$queryRawUnsafe<
    Array<{ id: string; slug: string; name: string; tagline: string; avatarUrl: string; category: string; status: string; featured: boolean; users7d: number; messages7d: number; usersTotal: number; payingUsers: number; usd7d: number }>
  >(
    `SELECT ch.id, ch.slug, ch.name, ch.tagline, ch.avatar_url "avatarUrl", ch.category, ch.status::text, ch.is_featured featured,
            coalesce(a.users7d, 0) "users7d", coalesce(a.messages7d, 0) "messages7d", coalesce(t.users, 0) "usersTotal",
            coalesce(p.paying, 0) "payingUsers", coalesce(cst.usd, 0)::float "usd7d"
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
      WHERE ch.status <> 'ARCHIVED'
      ORDER BY coalesce(a.messages7d, 0) DESC, ch.name`,
  );
  return rows.map(({ usd7d, ...r }) => ({ ...r, aiCost7d: usd7d * INR(), aiCostPerMessage: r.messages7d ? (usd7d * INR()) / r.messages7d : null }));
}

export async function updateCharacter(adminId: string, id: string, patch: { live?: boolean; featured?: boolean }) {
  const before = await prisma.character.findUnique({ where: { id }, select: { status: true, isFeatured: true, name: true } });
  if (!before) throw new NotFoundError('Character not found');
  const ch = await prisma.character.update({
    where: { id },
    data: {
      ...(patch.live !== undefined && { status: patch.live ? 'PUBLISHED' : 'UNPUBLISHED' }),
      ...(patch.featured !== undefined && { isFeatured: patch.featured }),
    },
    select: { id: true, status: true, isFeatured: true },
  });
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
    limits: {
      enforced: await limitsEnforced(),
      freeDaily: await getSetting('limits.freeDaily'),
      premiumDaily: await getSetting('limits.premiumDaily'),
    },
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
  };
}
