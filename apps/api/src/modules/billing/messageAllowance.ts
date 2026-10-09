import { getSetting } from '../console/appSettings.js';
import { prisma } from '../../infrastructure/database/prisma.js';
import { redis } from '../../infrastructure/redis/redis.js';
import { logger } from '../../config/logger.js';
import { CreditWalletService } from './credits/CreditWalletService.js';
import { isCrisisMessage } from '../conversations/human/crisisSupport.js';
import { classifySituations } from '../conversations/human/situation.js';

/**
 * How many messages a user may send today. Free: FREE_DAILY_MESSAGES (5). Premium (trial included):
 * PREMIUM_DAILY_MESSAGES (150, fair use). Past the limit, one message-pack credit per message.
 * Crisis and emergency messages are never counted or blocked.
 * Off until BILLING_ENFORCE_LIMITS=true (turn on together with payments at launch).
 */

export interface AllowanceResult {
  allowed: boolean;
  premium: boolean;
  used: number;
  limit: number;
  credits?: number;
  /** Why it was blocked: 'free_limit' → offer the trial; 'fair_use' → offer a message pack. */
  reason?: 'free_limit' | 'fair_use';
  resetsAt: string;
}

// From the admin console's settings (env values are the defaults).
const limits = async () => ({ free: await getSetting('limits.freeDaily'), premium: await getSetting('limits.premiumDaily') });

export const limitsEnforced = () => getSetting('limits.enforce');

/** The user's day in India (resets at midnight IST). */
function istDay(now = new Date()): { key: string; resetsAt: Date } {
  const ist = new Date(now.getTime() + 330 * 60_000);
  const key = ist.toISOString().slice(0, 10);
  const nextMidnightIst = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + 1) - 330 * 60_000;
  return { key, resetsAt: new Date(nextMidnightIst) };
}

/** Trial, active, grace period, or cancelled-but-paid-up. */
export async function hasPremium(userId: string): Promise<boolean> {
  const sub = await prisma.billingSubscription.findFirst({
    where: {
      userId,
      currentPeriodEnd: { gt: new Date() },
      status: { in: ['TRIALING', 'ACTIVE', 'GRACE_PERIOD', 'CANCELLED'] },
      plan: { code: { not: 'FREE' } },
    },
    select: { id: true },
  });
  return Boolean(sub);
}

/** Counts one message (call once per message they send). Never throws: on any error it lets the message through. */
export async function useMessage(userId: string, text: string): Promise<AllowanceResult> {
  const { key, resetsAt } = istDay();
  const base = { resetsAt: resetsAt.toISOString() };
  try {
    const premium = await hasPremium(userId);
    const lim = await limits();
    const limit = premium ? lim.premium : lim.free;
    const situations = classifySituations(text, null);
    if (!(await limitsEnforced()) || isCrisisMessage(text) || situations.includes('emergency')) {
      return { allowed: true, premium, used: 0, limit, ...base };
    }
    const counterKey = `msgs:${userId}:${key}`;
    const used = await redis.incr(counterKey);
    if (used === 1) await redis.expire(counterKey, 2 * 86_400);
    if (used <= limit) return { allowed: true, premium, used, limit, ...base };

    // Over today's limit: a message-pack credit, if they have one.
    const wallet = await CreditWalletService.getWalletSummary(userId).catch(() => null);
    const credits = wallet?.availableBalance ?? 0;
    if (credits > 0) {
      await CreditWalletService.consumeCredits({
        userId,
        amount: 1,
        idempotencyKey: `msg_${userId}_${key}_${used}`,
        description: 'Extra message (message pack)',
        referenceType: 'MESSAGE',
      });
      return { allowed: true, premium, used, limit, credits: credits - 1, ...base };
    }
    await redis.decr(counterKey); // a blocked message doesn't use up tomorrow's room
    return { allowed: false, premium, used: limit, limit, credits: 0, reason: premium ? 'fair_use' : 'free_limit', ...base };
  } catch (err) {
    logger.warn(`Message allowance check failed (allowing): ${err instanceof Error ? err.message : 'Unknown'}`);
    return { allowed: true, premium: false, used: 0, limit: (await limits().catch(() => ({ free: 5 }))).free, ...base };
  }
}

/** For the app: today's numbers without counting anything. */
export async function allowanceStatus(userId: string): Promise<Omit<AllowanceResult, 'allowed' | 'reason'> & { enforced: boolean }> {
  const { key, resetsAt } = istDay();
  const premium = await hasPremium(userId);
  const used = Number((await redis.get(`msgs:${userId}:${key}`).catch(() => null)) ?? 0);
  const wallet = await CreditWalletService.getWalletSummary(userId).catch(() => null);
  return {
    premium,
    used,
    limit: premium ? (await limits()).premium : (await limits()).free,
    credits: wallet?.availableBalance ?? 0,
    resetsAt: resetsAt.toISOString(),
    enforced: await limitsEnforced(),
  };
}
