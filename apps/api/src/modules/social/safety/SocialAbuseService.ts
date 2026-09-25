import type { AccountRestrictionType } from '@prisma/client';
import { ErrorCode } from '@ai-companion/config';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { redis } from '../../../infrastructure/redis/redis.js';
import { logger } from '../../../config/logger.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { SocialPolicyService } from '../policy/SocialPolicyService.js';
import { SocialRateLimiter } from './SocialRateLimiter.js';
import { stableHash } from '../shared/ids.js';

/**
 * Internal-only risk signals. Never exposed publicly and never rendered as a "trust score".
 */
export interface SocialRiskProfile {
  spamScore: number;
  abuseScore: number;
  automationScore: number;
  reportRate: number;
  enforcementCount: number;
  accountAgeDays: number;
  recentActivityBurst: number;
  riskLevel: 'LOW' | 'ELEVATED' | 'HIGH';
}

/** Which social capability an action needs; maps onto `UserRestriction` types. */
export type SocialCapability = 'ANY' | 'COMMENT' | 'DIRECT_MESSAGE' | 'SHARE' | 'CREATE_COMMUNITY' | 'PUBLISH';

const CAPABILITY_RESTRICTIONS: Record<SocialCapability, AccountRestrictionType[]> = {
  ANY: ['SOCIAL_RESTRICTED'],
  COMMENT: ['SOCIAL_RESTRICTED', 'CANNOT_COMMENT'],
  DIRECT_MESSAGE: ['SOCIAL_RESTRICTED', 'CANNOT_DIRECT_MESSAGE'],
  SHARE: ['SOCIAL_RESTRICTED', 'CANNOT_SHARE_CONTENT'],
  CREATE_COMMUNITY: ['SOCIAL_RESTRICTED', 'CANNOT_CREATE_COMMUNITIES'],
  PUBLISH: ['SOCIAL_RESTRICTED', 'CANNOT_PUBLISH', 'CANNOT_SHARE_CONTENT'],
};

const GLOBAL_RESTRICTIONS: AccountRestrictionType[] = ['ACCOUNT_RESTRICTED', 'ACCOUNT_SUSPENDED', 'ACCOUNT_BANNED'];

export class SocialAbuseService {
  /**
   * Throws if the user has an active restriction covering this capability. Always read from
   * PostgreSQL (never cached) so enforcement cannot be bypassed by stale state.
   */
  public static async assertCapability(userId: string, capability: SocialCapability): Promise<void> {
    const now = new Date();
    const restriction = await prisma.userRestriction.findFirst({
      where: {
        userId,
        isActive: true,
        restrictionType: { in: [...CAPABILITY_RESTRICTIONS[capability], ...GLOBAL_RESTRICTIONS] },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { restrictionType: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    });
    if (restriction) {
      const until = restriction.expiresAt ? ` until ${restriction.expiresAt.toISOString()}` : '';
      throw new AppError(
        `This feature is restricted on your account${until}. You can review this and appeal from Settings → Social & Privacy.`,
        403,
        ErrorCode.ACCOUNT_SUSPENDED,
      );
    }
  }

  /**
   * Detects repeated identical content from the same author inside a short window.
   * Returns true if duplicate. Normalization collapses whitespace/case so trivial variants match.
   */
  public static async isDuplicateContent(userId: string, surface: string, text: string): Promise<boolean> {
    const config = await SocialPolicyService.getConfig();
    const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
    if (normalized.length < 12) return false;
    const key = `social:dup:${surface}:${userId}:${stableHash(normalized).slice(0, 24)}`;
    try {
      const set = await redis.set(key, '1', 'EX', config.abuse.duplicateContentWindowSeconds, 'NX');
      return set !== 'OK';
    } catch {
      return false;
    }
  }

  /**
   * Tracks follow/unfollow cycling on the same target (a classic growth-hack / harassment pattern).
   * Returns true once the threshold is crossed within 24h.
   */
  public static async recordFollowToggle(followerId: string, targetId: string): Promise<boolean> {
    const config = await SocialPolicyService.getConfig();
    const key = `social:followcycle:${followerId}:${targetId}`;
    try {
      const n = await redis.incr(key);
      if (n === 1) await redis.expire(key, 86_400);
      return n > config.abuse.followCycleThreshold * 2;
    } catch {
      return false;
    }
  }

  /** Composite risk profile from DB + Redis signals. Used for escalation, never shown to users. */
  public static async getRiskProfile(userId: string): Promise<SocialRiskProfile> {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const [user, reportsAgainst, enforcementCount, contentCount, rejectedContent, followBurst, commentBurst] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
      prisma.socialModerationCase.aggregate({
        where: { subjectUserId: userId, createdAt: { gte: since } },
        _sum: { uniqueReporterCount: true },
      }),
      prisma.userRestriction.count({ where: { userId } }),
      prisma.socialContent.count({ where: { authorUserId: userId, createdAt: { gte: since } } }),
      prisma.socialContent.count({ where: { authorUserId: userId, createdAt: { gte: since }, status: { in: ['REJECTED', 'HIDDEN', 'RESTRICTED'] } } }),
      SocialRateLimiter.peek('follow', userId),
      SocialRateLimiter.peek('comment', userId),
    ]);

    const accountAgeDays = user ? (Date.now() - user.createdAt.getTime()) / 86_400_000 : 0;
    const uniqueReporters = reportsAgainst._sum.uniqueReporterCount ?? 0;
    const reportRate = contentCount > 0 ? uniqueReporters / contentCount : uniqueReporters > 0 ? 1 : 0;
    const recentActivityBurst = followBurst + commentBurst;

    const spamScore = Math.min(1, (contentCount > 0 ? rejectedContent / contentCount : 0) * 0.7 + Math.min(recentActivityBurst / 200, 1) * 0.3);
    const abuseScore = Math.min(1, Math.min(uniqueReporters / 10, 1) * 0.6 + Math.min(enforcementCount / 3, 1) * 0.4);
    const automationScore = Math.min(1, (accountAgeDays < 3 ? 0.4 : 0) + Math.min(recentActivityBurst / 150, 1) * 0.6);
    const top = Math.max(spamScore, abuseScore, automationScore);

    return {
      spamScore: Number(spamScore.toFixed(3)),
      abuseScore: Number(abuseScore.toFixed(3)),
      automationScore: Number(automationScore.toFixed(3)),
      reportRate: Number(reportRate.toFixed(3)),
      enforcementCount,
      accountAgeDays: Number(accountAgeDays.toFixed(1)),
      recentActivityBurst,
      riskLevel: top >= 0.7 ? 'HIGH' : top >= 0.4 ? 'ELEVATED' : 'LOW',
    };
  }

  /**
   * Progressive escalation through the existing enforcement system:
   * warning → temporary rate limit → restricted social actions → suspension (manual).
   * Automated escalation stops at time-boxed SOCIAL_RESTRICTED; suspension is always a human decision.
   */
  public static async escalateIfNeeded(userId: string, trigger: string): Promise<'NONE' | 'WARNED' | 'RESTRICTED'> {
    const profile = await this.getRiskProfile(userId);
    if (profile.riskLevel === 'LOW') return 'NONE';

    const recentAuto = await prisma.userRestriction.count({
      where: { userId, restrictionType: 'SOCIAL_RESTRICTED', isActive: true, issuedByAdminId: null },
    });
    if (profile.riskLevel === 'HIGH' && recentAuto === 0) {
      const hours = profile.enforcementCount > 0 ? 72 : 24;
      await prisma.userRestriction.create({
        data: {
          userId,
          restrictionType: 'SOCIAL_RESTRICTED',
          reason: `Automated temporary social restriction (${trigger})`,
          expiresAt: new Date(Date.now() + hours * 3_600_000),
          metadata: { automated: true, trigger, riskLevel: profile.riskLevel },
        },
      });
      logger.warn('[SocialAbuse] Auto-restricted social actions', { userId, trigger, hours });
      return 'RESTRICTED';
    }
    return 'WARNED';
  }
}
