import type { SocialRateLimitedAction } from '@ai-companion/config';
import { redis } from '../../../infrastructure/redis/redis.js';
import { logger } from '../../../config/logger.js';
import { RateLimitError } from '../../../shared/errors/AppError.js';
import { SocialPolicyService } from '../policy/SocialPolicyService.js';

/** Actions where a Redis outage must not silently remove anti-spam protection. */
const FAIL_CLOSED: ReadonlySet<SocialRateLimitedAction> = new Set([
  'message_request',
  'community_create',
  'ai_social_action',
  'username_change',
]);

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  retryAfterSeconds: number;
}

/**
 * Distributed fixed-window counters, one independent limit per social action (no global limit).
 * New accounts receive a reduced allowance; established high-activity creators are not penalised
 * because limits are per-action and generous for low-risk reads/reactions.
 */
export class SocialRateLimiter {
  public static async consume(
    action: SocialRateLimitedAction,
    subject: string,
    opts: { accountCreatedAt?: Date | null; cost?: number } = {},
  ): Promise<RateLimitResult> {
    const config = await SocialPolicyService.getConfig();
    const rule = config.rateLimits[action];
    let limit = rule.limit;

    if (opts.accountCreatedAt) {
      const ageHours = (Date.now() - opts.accountCreatedAt.getTime()) / 3_600_000;
      if (ageHours < config.abuse.newAccountAgeHours) {
        limit = Math.max(1, Math.floor(limit * config.abuse.newAccountRateMultiplier));
      }
    }

    const windowId = Math.floor(Date.now() / 1000 / rule.windowSeconds);
    const key = `social:rl:${action}:${subject}:${windowId}`;
    try {
      const count = await redis.incrby(key, opts.cost ?? 1);
      if (count === (opts.cost ?? 1)) await redis.expire(key, rule.windowSeconds + 5);
      const retryAfterSeconds = rule.windowSeconds - (Math.floor(Date.now() / 1000) % rule.windowSeconds);
      return { allowed: count <= limit, count, limit, retryAfterSeconds };
    } catch (err) {
      const failClosed = FAIL_CLOSED.has(action);
      logger.warn(`[SocialRateLimiter] Redis unavailable for ${action}; failing ${failClosed ? 'closed' : 'open'}`, { error: err });
      return { allowed: !failClosed, count: 0, limit, retryAfterSeconds: 60 };
    }
  }

  public static async enforce(
    action: SocialRateLimitedAction,
    subject: string,
    opts: { accountCreatedAt?: Date | null; cost?: number } = {},
  ): Promise<void> {
    const r = await this.consume(action, subject, opts);
    if (!r.allowed) {
      throw new RateLimitError(`You're doing that too often. Try again in ${Math.ceil(r.retryAfterSeconds / 60)} minute(s).`);
    }
  }

  /** Reads a counter without incrementing (used by risk scoring). */
  public static async peek(action: SocialRateLimitedAction, subject: string): Promise<number> {
    const config = await SocialPolicyService.getConfig();
    const rule = config.rateLimits[action];
    const windowId = Math.floor(Date.now() / 1000 / rule.windowSeconds);
    try {
      return parseInt((await redis.get(`social:rl:${action}:${subject}:${windowId}`)) ?? '0', 10);
    } catch {
      return 0;
    }
  }
}
