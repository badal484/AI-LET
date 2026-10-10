import { prisma } from '../../infrastructure/database/prisma.js';
import { getSetting } from './appSettings.js';

/**
 * The admin console's Overview: today / last 7 days at a glance, and 14-day trends.
 * Test and eval accounts (eval_*, *@test.local, *@example.com) are always left out.
 * Money is in rupees; AI cost is converted from USD at INR_PER_USD (default 88).
 */

export const TEST_USERS = `(u.email LIKE 'eval\\_%' OR u.email LIKE '%@test.local' OR u.email LIKE '%@example.com')`;
export const REAL_USERS = `(NOT ${TEST_USERS})`;
const INR = () => Number(process.env['INR_PER_USD'] ?? 88);

const one = async <T>(sql: string, ...args: unknown[]) => ((await prisma.$queryRawUnsafe<T[]>(sql, ...args))[0] ?? {}) as T;

export interface Overview {
  today: Kpis;
  week: Kpis;
  subscribers: { trialing: number; paying: number; cancelling: number };
  trialToPaid: { started: number; converted: number; rate: number | null };
  series: Array<{ day: string; messages: number; activeUsers: number; revenue: number; aiCost: number }>;
  funnel: { signedUp: number; onboarded: number; firstMessage: number; cameBack: number };
  returning: Array<{ after: number; eligible: number; returned: number }>;
  topCharacters: Array<{ id: string; name: string; avatarUrl: string; messages: number; users: number }>;
  newest: Array<{ id: string; name: string | null; email: string; joined: string; onboarded: boolean; messages: number }>;
  attention: { support: number; safety: number; failedReplies: number; aiOverBudget: boolean };
}

interface Kpis {
  activeUsers: number;
  newUsers: number;
  messages: number;
  revenue: number;
  aiCost: number;
  aiCostPerMessage: number | null;
}

async function kpis(since: Date): Promise<Kpis> {
  const [act, sign, rev, cost] = await Promise.all([
    one<{ users: number; messages: number }>(
      `SELECT count(DISTINCT c.user_id)::int users, count(*)::int messages
         FROM messages m JOIN conversations c ON c.id = m.conversation_id JOIN users u ON u.id = c.user_id
        WHERE m.role = 'user' AND m.created_at >= $1 AND ${REAL_USERS}`,
      since,
    ),
    one<{ n: number }>(`SELECT count(*)::int n FROM users u WHERE u.created_at >= $1 AND ${REAL_USERS}`, since),
    one<{ paise: number }>(
      `SELECT coalesce(sum(t.amount_minor_units), 0)::int paise
         FROM purchase_transactions t JOIN users u ON u.id = t.user_id
        WHERE t.status = 'SUCCEEDED' AND t.currency = 'INR' AND t.created_at >= $1 AND ${REAL_USERS}`,
      since,
    ),
    one<{ usd: number }>(
      `SELECT coalesce(sum(e.estimated_cost), 0)::float usd
         FROM ai_usage_events e LEFT JOIN users u ON u.id = e.user_id
        WHERE e.created_at >= $1 AND (e.user_id IS NULL OR ${REAL_USERS})`,
      since,
    ),
  ]);
  const aiCost = (cost.usd ?? 0) * INR();
  return {
    activeUsers: act.users ?? 0,
    newUsers: sign.n ?? 0,
    messages: act.messages ?? 0,
    revenue: (rev.paise ?? 0) / 100,
    aiCost,
    aiCostPerMessage: act.messages ? aiCost / act.messages : null,
  };
}

/** Midnight in India (the business day), as a UTC Date. */
export function istMidnight(daysAgo = 0): Date {
  const ist = new Date(Date.now() + 330 * 60_000);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() - daysAgo) - 330 * 60_000);
}

/**
 * Sign-ups of the last 30 days, step by step: finished onboarding → sent a first message → came back
 * on a later day (any message on a later India day than the day they joined).
 */
async function funnel() {
  return one<Overview['funnel']>(
    `WITH s AS (
       SELECT u.id, (u.created_at AT TIME ZONE 'Asia/Kolkata')::date joined, coalesce(pr.onboarding_completed, false) onboarded
         FROM users u LEFT JOIN user_profiles pr ON pr.user_id = u.id
        WHERE u.created_at >= now() - interval '30 days' AND u.status <> 'DELETED' AND ${REAL_USERS}
     ), a AS (
       SELECT s.id, count(m.id) > 0 talked, bool_or((m.created_at AT TIME ZONE 'Asia/Kolkata')::date > s.joined) back
         FROM s LEFT JOIN conversations c ON c.user_id = s.id LEFT JOIN messages m ON m.conversation_id = c.id AND m.role = 'user'
        GROUP BY s.id
     )
     SELECT count(*)::int "signedUp", count(*) FILTER (WHERE s.onboarded)::int onboarded,
            count(*) FILTER (WHERE a.talked)::int "firstMessage", count(*) FILTER (WHERE a.back)::int "cameBack"
       FROM s JOIN a USING (id)`,
  );
}

/** Of the people who joined in the last 90 days (and at least N days ago), how many chatted again N+ days after joining. */
async function returning() {
  const rows = await prisma.$queryRawUnsafe<Array<{ after: number; eligible: number; returned: number }>>(
    `WITH s AS (
       SELECT u.id, u.created_at,
              (SELECT max(m.created_at) FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE c.user_id = u.id AND m.role = 'user') last_msg
         FROM users u WHERE u.created_at >= now() - interval '90 days' AND u.status <> 'DELETED' AND ${REAL_USERS}
     )
     SELECT n.after, count(*) FILTER (WHERE s.created_at <= now() - make_interval(days => n.after))::int eligible,
            count(*) FILTER (WHERE s.created_at <= now() - make_interval(days => n.after) AND s.last_msg >= s.created_at + make_interval(days => n.after))::int returned
       FROM (VALUES (1), (7), (30)) n(after) CROSS JOIN s GROUP BY n.after ORDER BY n.after`,
  );
  return [1, 7, 30].map((after) => rows.find((r) => r.after === after) ?? { after, eligible: 0, returned: 0 });
}

export async function getOverview(): Promise<Overview> {
  const today0 = istMidnight(0);
  const [fun, ret, top, newest, attention] = await Promise.all([
    funnel(),
    returning(),
    prisma.$queryRawUnsafe<Overview['topCharacters']>(
      `SELECT ch.id, ch.name, ch.avatar_url "avatarUrl", count(*)::int messages, count(DISTINCT c.user_id)::int users
         FROM messages m JOIN conversations c ON c.id = m.conversation_id JOIN users u ON u.id = c.user_id JOIN characters ch ON ch.id = c.character_id
        WHERE m.role = 'user' AND m.created_at >= $1 AND ${REAL_USERS} GROUP BY ch.id ORDER BY 4 DESC LIMIT 5`,
      today0,
    ),
    prisma.$queryRawUnsafe<Overview['newest']>(
      `SELECT u.id, pr.display_name name, u.email, to_char(u.created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF') joined, coalesce(pr.onboarding_completed, false) onboarded,
              (SELECT count(*)::int FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE c.user_id = u.id AND m.role = 'user') messages
         FROM users u LEFT JOIN user_profiles pr ON pr.user_id = u.id
        WHERE u.status <> 'DELETED' AND ${REAL_USERS} ORDER BY u.created_at DESC LIMIT 6`,
    ),
    attentionCounts(),
  ]);
  return { ...(await core()), funnel: { signedUp: fun.signedUp ?? 0, onboarded: fun.onboarded ?? 0, firstMessage: fun.firstMessage ?? 0, cameBack: fun.cameBack ?? 0 }, returning: ret, topCharacters: top, newest, attention };
}

/** What needs a human: open support, unreviewed safety moments, failed replies (24 h), AI spend over the daily budget. */
export async function attentionCounts(): Promise<Overview['attention']> {
  const [support, safety, failed, spend, budget] = await Promise.all([
    prisma.supportRequest.count({ where: { status: 'open' } }),
    prisma.safetyMoment.count({ where: { resolvedAt: null } }),
    one<{ n: number }>(`SELECT count(*)::int n FROM messages WHERE role = 'assistant' AND status = 'FAILED' AND created_at >= now() - interval '24 hours'`),
    one<{ usd: number }>(`SELECT coalesce(sum(estimated_cost), 0)::float usd FROM ai_usage_events WHERE created_at >= $1`, istMidnight(0)),
    getSetting('ai.dailyBudget'),
  ]);
  return { support, safety, failedReplies: failed.n ?? 0, aiOverBudget: budget > 0 && (spend.usd ?? 0) * INR() > budget };
}

async function core(): Promise<Omit<Overview, 'funnel' | 'returning' | 'topCharacters' | 'newest' | 'attention'>> {
  const [today, week, subs, trial, series] = await Promise.all([
    kpis(istMidnight(0)),
    kpis(istMidnight(6)),
    one<{ trialing: number; paying: number; cancelling: number }>(
      `SELECT count(*) FILTER (WHERE s.status = 'TRIALING')::int trialing,
              count(*) FILTER (WHERE s.status IN ('ACTIVE','GRACE_PERIOD'))::int paying,
              count(*) FILTER (WHERE s.cancel_at_period_end AND s.status IN ('ACTIVE','TRIALING','GRACE_PERIOD','CANCELLED'))::int cancelling
         FROM billing_subscriptions s JOIN billing_plans p ON p.id = s.plan_id JOIN users u ON u.id = s.user_id
        WHERE p.code <> 'FREE' AND s.current_period_end > now() AND ${REAL_USERS}`,
    ),
    // Trials that started 30–4 days ago (finished, so the outcome is known) and how many became paid.
    one<{ started: number; converted: number }>(
      `SELECT count(*)::int started, count(*) FILTER (WHERE s.status IN ('ACTIVE','GRACE_PERIOD'))::int converted
         FROM billing_subscriptions s JOIN users u ON u.id = s.user_id
        WHERE s.trial_start BETWEEN now() - interval '30 days' AND now() - interval '4 days' AND ${REAL_USERS}`,
    ),
    prisma.$queryRawUnsafe<Array<{ day: string; messages: number; active: number; paise: number; usd: number }>>(
      `WITH days AS (
         SELECT generate_series((now() AT TIME ZONE 'Asia/Kolkata')::date - 13, (now() AT TIME ZONE 'Asia/Kolkata')::date, '1 day')::date AS dt
       ),
       msg AS (
         SELECT (m.created_at AT TIME ZONE 'Asia/Kolkata')::date dt, count(*)::int messages, count(DISTINCT c.user_id)::int active
           FROM messages m JOIN conversations c ON c.id = m.conversation_id JOIN users u ON u.id = c.user_id
          WHERE m.role = 'user' AND m.created_at >= now() - interval '15 days' AND ${REAL_USERS} GROUP BY 1
       ),
       rev AS (
         SELECT (t.created_at AT TIME ZONE 'Asia/Kolkata')::date dt, sum(t.amount_minor_units)::int paise
           FROM purchase_transactions t JOIN users u ON u.id = t.user_id
          WHERE t.status = 'SUCCEEDED' AND t.currency = 'INR' AND t.created_at >= now() - interval '15 days' AND ${REAL_USERS} GROUP BY 1
       ),
       cost AS (
         SELECT (e.created_at AT TIME ZONE 'Asia/Kolkata')::date dt, sum(e.estimated_cost)::float usd
           FROM ai_usage_events e LEFT JOIN users u ON u.id = e.user_id
          WHERE e.created_at >= now() - interval '15 days' AND (e.user_id IS NULL OR ${REAL_USERS}) GROUP BY 1
       )
       SELECT to_char(d.dt, 'YYYY-MM-DD') AS "day", coalesce(msg.messages, 0) messages, coalesce(msg.active, 0) active,
              coalesce(rev.paise, 0) paise, coalesce(cost.usd, 0) usd
         FROM days d LEFT JOIN msg USING (dt) LEFT JOIN rev USING (dt) LEFT JOIN cost USING (dt) ORDER BY d.dt`,
    ),
  ]);
  return {
    today,
    week,
    subscribers: { trialing: subs.trialing ?? 0, paying: subs.paying ?? 0, cancelling: subs.cancelling ?? 0 },
    trialToPaid: { started: trial.started ?? 0, converted: trial.converted ?? 0, rate: trial.started ? trial.converted / trial.started : null },
    series: series.map((r) => ({ day: r.day, messages: r.messages, activeUsers: r.active, revenue: r.paise / 100, aiCost: r.usd * INR() })),
  };
}
