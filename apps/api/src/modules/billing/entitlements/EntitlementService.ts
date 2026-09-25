import { prisma } from '../../../infrastructure/database/prisma.js';
import { redis } from '../../../infrastructure/redis/redis.js';
import { SYSTEM_CONSTANTS, ErrorCode } from '@ai-companion/config';
import { EffectiveEntitlementsResponse, SubscriptionStatus } from '@ai-companion/types';
import { ForbiddenError, NotFoundError } from '../../../shared/errors/AppError.js';
import { logger } from '../../../config/logger.js';
import { SubscriptionStateMachine } from '../domain/SubscriptionStateMachine.js';

export class EntitlementService {
  private static readonly CACHE_PREFIX = 'entitlements:user:';
  private static readonly TTL_SECONDS = SYSTEM_CONSTANTS.CACHE.USER_ENTITLEMENTS_TTL_SECONDS || 300;

  /**
   * Check whether a user has a specific entitlement.
   */
  public static async hasEntitlement(userId: string, entitlementKey: string): Promise<boolean> {
    const entitlements = await this.getEffectiveEntitlements(userId);
    return Boolean(entitlements.entitlements[entitlementKey]);
  }

  /**
   * Enforce entitlement requirement, throwing ForbiddenError if missing.
   */
  public static async requireEntitlement(userId: string, entitlementKey: string): Promise<void> {
    const hasAccess = await this.hasEntitlement(userId, entitlementKey);
    if (!hasAccess) {
      throw new ForbiddenError(
        `Access denied. Requires '${entitlementKey}' entitlement.`,
        ErrorCode.ENTITLEMENT_REQUIRED
      );
    }
  }

  /**
   * Resolve all effective entitlements combining subscriptions, manual grants, promotions, and system defaults.
   */
  public static async getEffectiveEntitlements(userId: string): Promise<EffectiveEntitlementsResponse> {
    const cacheKey = `${this.CACHE_PREFIX}${userId}`;

    // 1. Try Redis cache
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as EffectiveEntitlementsResponse;
      }
    } catch (err) {
      logger.warn(`Redis entitlement cache read failed for user ${userId}:`, err);
    }

    // 2. Fetch active subscriptions for user
    const now = new Date();
    const activeSubscription = await prisma.billingSubscription.findFirst({
      where: {
        userId,
        status: { in: ['ACTIVE', 'TRIALING', 'GRACE_PERIOD'] },
        currentPeriodEnd: { gte: now },
      },
      include: {
        plan: {
          include: {
            entitlements: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 3. Fetch active user direct entitlements (admin grants, trials, promotions)
    const directEntitlements = await prisma.userEntitlement.findMany({
      where: {
        userId,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
      },
    });

    // 4. Base default entitlements for every user
    const entitlementMap: Record<string, boolean> = {
      [SYSTEM_CONSTANTS.BILLING.ENTITLEMENT_KEYS.CHAT_BASIC]: true,
    };

    let planCode = 'FREE';
    let subscriptionStatus: SubscriptionStatus = 'active';

    // 5. Apply plan entitlements if subscription is active
    if (activeSubscription && SubscriptionStateMachine.isEntitlementEligible(activeSubscription.status.toLowerCase() as SubscriptionStatus)) {
      planCode = activeSubscription.plan.code;
      subscriptionStatus = activeSubscription.status.toLowerCase() as SubscriptionStatus;

      for (const ent of activeSubscription.plan.entitlements) {
        entitlementMap[ent.entitlementKey] = true;
      }
    }

    // 6. Apply direct grants (can override or add)
    for (const direct of directEntitlements) {
      entitlementMap[direct.entitlementKey] = true;
    }

    const activeList = Object.keys(entitlementMap).filter(k => entitlementMap[k]);

    const result: EffectiveEntitlementsResponse = {
      userId,
      planCode,
      subscriptionStatus,
      entitlements: entitlementMap,
      activeEntitlementsList: activeList,
      expiresAt: activeSubscription?.currentPeriodEnd ? activeSubscription.currentPeriodEnd.toISOString() : null,
      syncedAt: now.toISOString(),
    };

    // 7. Write to cache
    try {
      await redis.setex(cacheKey, this.TTL_SECONDS, JSON.stringify(result));
    } catch (err) {
      logger.warn(`Redis entitlement cache write failed for user ${userId}:`, err);
    }

    return result;
  }

  /**
   * Grant a manual entitlement to a user with an auditable reason.
   */
  public static async grantManualEntitlement(
    userId: string,
    entitlementKey: string,
    reason: string,
    durationDays?: number,
    adminUserId?: string
  ) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError(`User with ID '${userId}' not found`);
    }

    const now = new Date();
    const expiresAt = durationDays ? new Date(now.getTime() + durationDays * 86400000) : null;

    const entitlement = await prisma.userEntitlement.upsert({
      where: {
        userId_entitlementKey_source_sourceId: {
          userId,
          entitlementKey,
          source: 'ADMIN_GRANT',
          sourceId: adminUserId || 'system',
        },
      },
      create: {
        userId,
        entitlementKey,
        source: 'ADMIN_GRANT',
        sourceId: adminUserId || 'system',
        expiresAt,
        isActive: true,
        metadata: { reason, grantedBy: adminUserId },
      },
      update: {
        expiresAt,
        isActive: true,
        metadata: { reason, grantedBy: adminUserId, updatedAt: now.toISOString() },
      },
    });

    await this.invalidateUserEntitlementsCache(userId);
    return entitlement;
  }

  /**
   * Revoke a specific direct entitlement from a user.
   */
  public static async revokeEntitlement(
    userId: string,
    entitlementKey: string,
    reason?: string,
    adminUserId?: string
  ): Promise<void> {
    await prisma.userEntitlement.updateMany({
      where: {
        userId,
        entitlementKey,
      },
      data: {
        isActive: false,
        metadata: { revokedReason: reason, revokedBy: adminUserId, revokedAt: new Date().toISOString() },
      },
    });

    await this.invalidateUserEntitlementsCache(userId);
  }

  /**
   * Invalidate Redis cache for user entitlements.
   */
  public static async invalidateUserEntitlementsCache(userId: string): Promise<void> {
    try {
      await redis.del(`${this.CACHE_PREFIX}${userId}`);
    } catch (err) {
      logger.warn(`Failed to invalidate entitlement cache for user ${userId}:`, err);
    }
  }

  public static async invalidateUserCache(userId: string): Promise<void> {
    return this.invalidateUserEntitlementsCache(userId);
  }
}
