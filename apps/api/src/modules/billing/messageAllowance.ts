import { getSetting } from '../console/appSettings.js';
import { prisma } from '../../infrastructure/database/prisma.js';
import { redis } from '../../infrastructure/redis/redis.js';
import { logger } from '../../config/logger.js';
import { CreditWalletService } from './credits/CreditWalletService.js';
import { isCrisisMessage } from '../conversations/human/crisisSupport.js';
import { classifySituations } from '../conversations/human/situation.js';
import { emailConfigured } from '../../infrastructure/email/email.js';

/**
 * How many messages a user may send today. Without Premium: limits.freeDaily (default 0 — no free plan; the
 * paywall offers the ₹1 first day). Premium (₹1 first day included):
 * PREMIUM_DAILY_MESSAGES (150, fair use). Past the limit, one message-pack credit per message.
 * Crisis and emergency messages are never counted or blocked.
 * Off until BILLING_ENFORCE_LIMITS=true (turn on together with payments at launch).
 *
 * Abuse guards that apply even while limits are off (audit H-1), so free use is never unlimited:
 *  - limits.openDaily per account per day (default 150) while limits are off;
 *  - limits.unverifiedDaily (default 30) until the email is verified — only when email sending is set up,
 *    so nobody is asked to verify an email that can't arrive. Premium accounts aren't held to it.
 */

export interface AllowanceResult {
  allowed: boolean;
  premium: boolean;
  used: number;
  limit: number;
  credits?: number;
  /**
   * Why it was blocked: 'free_limit' → offer the trial; 'fair_use' → offer a message pack;
   * 'verify_email' → verify the email to keep going; 'daily_cap' → today's cap while limits are off.
   */
  reason?: 'free_limit' | 'fair_use' | 'verify_email' | 'daily_cap';
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

/** True when this account hasn't verified its email and verification emails can actually be sent. */
async function needsVerification(userId: string): Promise<boolean> {
  if (!emailConfigured()) return false;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { emailVerifiedAt: true } });
  return Boolean(user && !user.emailVerifiedAt);
}

/** Counts one message (call once per message they send). On an unexpected error it lets the message through (the daily AI spending cap is the backstop). */
export async function useMessage(userId: string, text: string): Promise<AllowanceResult> {
  const { key, resetsAt } = istDay();
  const base = { resetsAt: resetsAt.toISOString() };
  try {
    const premium = await hasPremium(userId);
    const lim = await limits();
    const enforced = await limitsEnforced();
    const situations = classifySituations(text, null);
    if (isCrisisMessage(text) || situations.includes('emergency')) {
      return { allowed: true, premium, used: 0, limit: premium ? lim.premium : lim.free, ...base };
    }

    // The limit that applies today, and which rule set it (for the message the app shows).
    let limit = enforced ? (premium ? lim.premium : lim.free) : Number(await getSetting('limits.openDaily')) || Infinity;
    let rule: 'plan' | 'open' | 'verify' = enforced ? 'plan' : 'open';
    const unverifiedCap = Number(await getSetting('limits.unverifiedDaily'));
    if (!premium && unverifiedCap > 0 && unverifiedCap < limit && (await needsVerification(userId))) {
      limit = unverifiedCap;
      rule = 'verify';
    }
    if (limit === Infinity) return { allowed: true, premium, used: 0, limit: 0, ...base };

    const counterKey = `msgs:${userId}:${key}`;
    const used = await redis.incr(counterKey);
    if (used === 1) await redis.expire(counterKey, 2 * 86_400);
    if (used <= limit) return { allowed: true, premium, used, limit, ...base };

    // Over today's plan limit with payments on: a coin pays for one more message.
    if (rule === 'plan') {
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
    }
    await redis.decr(counterKey); // a blocked message doesn't use up tomorrow's room
    const reason = rule === 'verify' ? 'verify_email' : rule === 'open' ? 'daily_cap' : premium ? 'fair_use' : 'free_limit';
    return { allowed: false, premium, used: limit, limit, credits: 0, reason, ...base };
  } catch (err) {
    logger.warn(`Message allowance check failed (allowing): ${err instanceof Error ? err.message : 'Unknown'}`);
    return { allowed: true, premium: false, used: 0, limit: (await limits().catch(() => ({ free: 0 }))).free, ...base };
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
