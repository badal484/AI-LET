import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../config/logger.js';
import { getSetting } from '../../console/appSettings.js';

/**
 * The hard daily AI spending cap (audit H-1). Today's cost (since midnight IST) is read from the cost ledger
 * at most once a minute per process; calls recorded in between are added at once, so a sudden burst is
 * noticed without waiting for the next read. If the ledger can't be read, the last known total is used;
 * with none at all the cap doesn't block (one failed query shouldn't stop every chat).
 */

const INR_PER_USD = () => Number(process.env['INR_PER_USD'] ?? 88);
const REFRESH_MS = 60_000;

let state: { day: string; usd: number; readAt: number } | null = null;
let sinceRead = 0;
let alertedDay = '';

function istDayStart(now = new Date()): { day: string; start: Date } {
  const ist = new Date(now.getTime() + 330 * 60_000);
  const day = ist.toISOString().slice(0, 10);
  return { day, start: new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - 330 * 60_000) };
}

/** Called by the cost ledger for every billed call. */
export function noteSpendUsd(usd: number): void {
  if (Number.isFinite(usd) && usd > 0) sinceRead += usd;
}

/** Today's AI cost in ₹ (estimate). */
export async function todaySpendInr(): Promise<number> {
  const { day, start } = istDayStart();
  if (!state || state.day !== day || Date.now() - state.readAt > REFRESH_MS) {
    try {
      const agg = await prisma.aIUsageEvent.aggregate({ where: { createdAt: { gte: start } }, _sum: { estimatedCost: true } });
      state = { day, usd: Number(agg._sum.estimatedCost ?? 0), readAt: Date.now() };
      sinceRead = 0;
    } catch (err) {
      logger.warn(`Spend cap: could not read today's AI cost (${err instanceof Error ? err.message : 'unknown'})`);
      if (!state || state.day !== day) return 0;
    }
  }
  return (state.usd + sinceRead) * INR_PER_USD();
}

/** True once today's AI cost has reached the admin's cap (Settings → AI spending cap per day; 0 = off). */
export async function spendCapReached(): Promise<boolean> {
  const cap = Number(await getSetting('ai.dailyHardCap'));
  if (!cap || cap <= 0) return false;
  const spent = await todaySpendInr();
  const reached = spent >= cap;
  if (reached && alertedDay !== istDayStart().day) {
    alertedDay = istDayStart().day;
    logger.error(`AI spending cap reached: ₹${spent.toFixed(0)} of ₹${cap} today — new replies are paused until midnight IST`);
  }
  return reached;
}

/** Tests only. */
export function resetSpendGuardForTests(): void {
  state = null;
  sinceRead = 0;
  alertedDay = '';
}
