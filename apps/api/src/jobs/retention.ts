import { prisma } from '../infrastructure/database/prisma.js';
import { redis } from '../infrastructure/redis/redis.js';
import { logger } from '../config/logger.js';

/**
 * Nightly clean-up of old log rows (docs/DB_OPTIMIZATION_PLAN.md, step 2). Users' chats, memories and
 * reminders are never touched here — they live as long as the account.
 *
 * Deletes in small batches with a pause, so the database never locks up; each night is capped, and whatever
 * is left is picked up the next night. Raw AI usage is folded into daily totals (ai_usage_daily) in the same
 * statement that deletes it, so long-term cost history survives and nothing is counted twice.
 */

/** Days each log is kept. */
export const RETENTION_DAYS = {
  ai_generation_traces: 30,
  memory_access_logs: 30,
  character_runtime_snapshots: 30,
  analytics_events: 90,
  ai_usage_events: 90,
  safety_evaluation_logs: 180,
  audit_logs: 365,
} as const;

/** Sampled full prompts (message_generation_metadata.prompt_snapshot) are only for debugging recent replies. */
export const PROMPT_SNAPSHOT_DAYS = 7;

const BATCH = 5_000;
const MAX_BATCHES_PER_TABLE = 40; // ≤200k rows per table per night
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function inBatches(run: () => Promise<number>): Promise<number> {
  let total = 0;
  for (let i = 0; i < MAX_BATCHES_PER_TABLE; i++) {
    const n = await run();
    total += n;
    if (n < BATCH) break;
    await pause(200);
  }
  return total;
}

/** One pass over every log. Returns rows removed (or cleared) per table. */
export async function runRetention(now = new Date()): Promise<Record<string, number>> {
  const cutoff = (days: number) => new Date(now.getTime() - days * 86_400_000);
  const out: Record<string, number> = {};

  // AI usage: fold into daily totals and delete, atomically per batch.
  out['ai_usage_events'] = await inBatches(async () => {
    const [r] = await prisma.$queryRawUnsafe<Array<{ n: number }>>(
      `WITH moved AS (
         DELETE FROM ai_usage_events
          WHERE id IN (SELECT id FROM ai_usage_events WHERE created_at < $1 LIMIT ${BATCH})
         RETURNING created_at, model, task, input_tokens, output_tokens, cached_tokens, estimated_cost
       ), totals AS (
         INSERT INTO ai_usage_daily (day, model, task, calls, input_tokens, output_tokens, cached_tokens, cost_usd)
         SELECT (created_at AT TIME ZONE 'Asia/Kolkata')::date, model, task, count(*), sum(input_tokens), sum(output_tokens),
                sum(cached_tokens), sum(estimated_cost)
           FROM moved GROUP BY 1, 2, 3
         ON CONFLICT (day, model, task) DO UPDATE SET
           calls = ai_usage_daily.calls + EXCLUDED.calls,
           input_tokens = ai_usage_daily.input_tokens + EXCLUDED.input_tokens,
           output_tokens = ai_usage_daily.output_tokens + EXCLUDED.output_tokens,
           cached_tokens = ai_usage_daily.cached_tokens + EXCLUDED.cached_tokens,
           cost_usd = ai_usage_daily.cost_usd + EXCLUDED.cost_usd
       )
       SELECT count(*)::int AS n FROM moved`,
      cutoff(RETENTION_DAYS.ai_usage_events),
    );
    return r?.n ?? 0;
  });

  for (const table of ['ai_generation_traces', 'memory_access_logs', 'character_runtime_snapshots', 'analytics_events', 'safety_evaluation_logs', 'audit_logs'] as const) {
    out[table] = await inBatches(() =>
      prisma.$executeRawUnsafe(
        `DELETE FROM "${table}" WHERE id IN (SELECT id FROM "${table}" WHERE created_at < $1 LIMIT ${BATCH})`,
        cutoff(RETENTION_DAYS[table]),
      ),
    );
  }

  out['prompt_snapshots_cleared'] = await inBatches(() =>
    prisma.$executeRawUnsafe(
      `UPDATE message_generation_metadata SET prompt_snapshot = NULL
        WHERE id IN (SELECT id FROM message_generation_metadata WHERE prompt_snapshot IS NOT NULL AND created_at < $1 LIMIT ${BATCH})`,
      cutoff(PROMPT_SNAPSHOT_DAYS),
    ),
  );

  return out;
}

/**
 * Called every hour by the scheduler; runs once a night, around 3 am India time (quietest hour), and at most
 * once per day across all processes.
 */
export async function nightlyRetention(now = new Date()): Promise<Record<string, number> | null> {
  const ist = new Date(now.getTime() + 330 * 60_000);
  if (ist.getUTCHours() !== 3) return null;
  const key = `jobs:retention:${ist.toISOString().slice(0, 10)}`;
  if ((await redis.set(key, '1', 'EX', 2 * 86_400, 'NX').catch(() => null)) !== 'OK') return null;
  const removed = await runRetention(now);
  logger.info('Retention: old log rows removed', removed);
  return removed;
}
