import { prisma } from '../../../infrastructure/database/prisma.js';
import {
  BillingSubscription,
  SubscriptionStatus,
  PlanInterval,
  BillingProviderType,
} from '@ai-companion/types';
import { NotFoundError, BadRequestError } from '../../../shared/errors/AppError.js';
import { ErrorCode, SYSTEM_CONSTANTS } from '@ai-companion/config';
import { SubscriptionStateMachine } from '../domain/SubscriptionStateMachine.js';
import { EntitlementService } from '../entitlements/EntitlementService.js';
import { BillingProviderFactory } from '../providers/BillingProviderFactory.js';
import { logger } from '../../../config/logger.js';

export class SubscriptionService {
  /**
   * Upgrade / downgrade / change active plan for a user.
   */
  public static async changeSubscription(params: {
    userId: string;
    planCode: string;
    billingInterval: PlanInterval;
    provider: BillingProviderType;
  }): Promise<BillingSubscription> {
    const targetPlan = await prisma.billingPlan.findUnique({
      where: { code: params.planCode.toUpperCase() },
      include: { prices: true },
    });

    if (!targetPlan) {
      throw new NotFoundError(`Billing plan '${params.planCode}' not found`);
    }

    const price = targetPlan.prices.find(
      (p) => p.active && p.billingInterval?.toLowerCase() === params.billingInterval.toLowerCase()
    ) || targetPlan.prices.find((p) => p.active) || null;

    const now = new Date();
    const periodDays = params.billingInterval === 'year' ? 365 : 30;
    const currentPeriodEnd = new Date(now.getTime() + periodDays * 86400000);

    // Find existing active subscription
    const existing = await prisma.billingSubscription.findFirst({
      where: {
        userId: params.userId,
        status: { in: ['ACTIVE', 'TRIALING', 'GRACE_PERIOD', 'CANCELLED'] },
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      // Validate state transition
      SubscriptionStateMachine.validateTransition(
        existing.status.toLowerCase() as SubscriptionStatus,
        'active'
      );

      const updated = await prisma.billingSubscription.update({
        where: { id: existing.id },
        data: {
          planId: targetPlan.id,
          priceId: price?.id,
          status: 'ACTIVE',
          cancelAtPeriodEnd: false,
          currentPeriodStart: now,
          currentPeriodEnd,
          cancelledAt: null,
          endedAt: null,
        },
        include: { plan: true },
      });

      await EntitlementService.invalidateUserEntitlementsCache(params.userId);
      return this.mapSubscription(updated);
    }

    // Create new subscription if none existed
    const newSub = await prisma.billingSubscription.create({
      data: {
        userId: params.userId,
        planId: targetPlan.id,
        priceId: price?.id,
        status: 'ACTIVE',
        provider: params.provider.toUpperCase() as any,
        providerSubscriptionId: `sub_${params.provider}_${Date.now()}`,
        currentPeriodStart: now,
        currentPeriodEnd,
        cancelAtPeriodEnd: false,
      },
      include: { plan: true },
    });

    await EntitlementService.invalidateUserEntitlementsCache(params.userId);
    return this.mapSubscription(newSub);
  }

  /**
   * Cancel subscription (either cancel at period end or immediate cancellation).
   */
  public static async cancelSubscription(
    userId: string,
    cancelImmediately: boolean = false,
    reason?: string
  ): Promise<BillingSubscription> {
    const subscription = await prisma.billingSubscription.findFirst({
      where: {
        userId,
        status: { in: ['ACTIVE', 'TRIALING', 'GRACE_PERIOD'] },
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      throw new NotFoundError('No active subscription found to cancel', ErrorCode.SUBSCRIPTION_NOT_FOUND);
    }

    const now = new Date();
    const newStatus = cancelImmediately ? 'CANCELLED' : subscription.status;

    // Validate state machine transition
    SubscriptionStateMachine.validateTransition(
      subscription.status.toLowerCase() as SubscriptionStatus,
      'cancelled'
    );

    const updated = await prisma.billingSubscription.update({
      where: { id: subscription.id },
      data: {
        cancelAtPeriodEnd: !cancelImmediately,
        cancelledAt: now,
        status: newStatus,
        endedAt: cancelImmediately ? now : null,
        metadata: {
          cancellationReason: reason,
          cancelImmediately,
          cancelledAt: now.toISOString(),
        },
      },
      include: { plan: true },
    });

    // Notify provider adapter
    const providerAdapter = BillingProviderFactory.getProvider(subscription.provider.toLowerCase() as BillingProviderType);
    if (subscription.providerSubscriptionId) {
      await providerAdapter.cancelSubscription(subscription.providerSubscriptionId).catch((err) => {
        logger.warn(`Failed to notify provider of cancellation:`, err);
      });
    }

    await EntitlementService.invalidateUserEntitlementsCache(userId);
    return this.mapSubscription(updated);
  }

  /**
   * Resume subscription before current period ends.
   */
  public static async resumeSubscription(userId: string): Promise<BillingSubscription> {
    const subscription = await prisma.billingSubscription.findFirst({
      where: {
        userId,
        cancelAtPeriodEnd: true,
        currentPeriodEnd: { gt: new Date() },
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      throw new BadRequestError(
        'No pending-cancellation subscription found to resume',
        ErrorCode.SUBSCRIPTION_NOT_FOUND
      );
    }

    const updated = await prisma.billingSubscription.update({
      where: { id: subscription.id },
      data: {
        cancelAtPeriodEnd: false,
        cancelledAt: null,
        status: 'ACTIVE',
      },
      include: { plan: true },
    });

    await EntitlementService.invalidateUserEntitlementsCache(userId);
    return this.mapSubscription(updated);
  }

  /**
   * Handle webhook renewal event from payment provider.
   */
  public static async handleSubscriptionRenewal(
    providerSubscriptionId: string,
    currentPeriodEnd: Date
  ): Promise<void> {
    const sub = await prisma.billingSubscription.findUnique({
      where: { providerSubscriptionId },
    });

    if (!sub) {
      logger.warn(`Subscription '${providerSubscriptionId}' not found for renewal`);
      return;
    }

    await prisma.billingSubscription.update({
      where: { id: sub.id },
      data: {
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd,
        gracePeriodEnd: null,
      },
    });

    await EntitlementService.invalidateUserEntitlementsCache(sub.userId);
  }

  /**
   * Handle payment failure, transitioning to grace_period or past_due.
   */
  public static async handlePaymentFailure(
    providerSubscriptionId: string,
    gracePeriodDays: number = SYSTEM_CONSTANTS.BILLING.GRACE_PERIOD_DAYS || 3
  ): Promise<void> {
    const sub = await prisma.billingSubscription.findUnique({
      where: { providerSubscriptionId },
    });

    if (!sub) return;

    const now = new Date();
    const gracePeriodEnd = new Date(now.getTime() + gracePeriodDays * 86400000);

    await prisma.billingSubscription.update({
      where: { id: sub.id },
      data: {
        status: 'PAST_DUE',
        gracePeriodEnd,
      },
    });

    await EntitlementService.invalidateUserEntitlementsCache(sub.userId);
  }

  /**
   * Handle expired subscription when grace period elapses without payment.
   */
  public static async handleSubscriptionExpiration(providerSubscriptionId: string): Promise<void> {
    const sub = await prisma.billingSubscription.findUnique({
      where: { providerSubscriptionId },
    });

    if (!sub) return;

    await prisma.billingSubscription.update({
      where: { id: sub.id },
      data: {
        status: 'EXPIRED',
        endedAt: new Date(),
      },
    });

    await EntitlementService.invalidateUserEntitlementsCache(sub.userId);
  }

  /**
   * Get user's current subscription summary.
   */
  public static async getUserSubscription(userId: string): Promise<BillingSubscription | null> {
    const sub = await prisma.billingSubscription.findFirst({
      where: { userId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!sub) return null;
    return this.mapSubscription(sub);
  }

  private static mapSubscription(sub: any): BillingSubscription {
    return {
      id: sub.id,
      userId: sub.userId,
      planId: sub.planId,
      planCode: sub.plan?.code || 'PRO',
      planName: sub.plan?.name || 'Pro Plan',
      status: sub.status.toLowerCase(),
      provider: sub.provider.toLowerCase(),
      providerSubscriptionId: sub.providerSubscriptionId,
      currentPeriodStart: sub.currentPeriodStart.toISOString(),
      currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
      trialStart: sub.trialStart ? sub.trialStart.toISOString() : null,
      trialEnd: sub.trialEnd ? sub.trialEnd.toISOString() : null,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      cancelledAt: sub.cancelledAt ? sub.cancelledAt.toISOString() : null,
      endedAt: sub.endedAt ? sub.endedAt.toISOString() : null,
      gracePeriodEnd: sub.gracePeriodEnd ? sub.gracePeriodEnd.toISOString() : null,
      priceAmountMinorUnits: 999,
      currency: 'USD',
      billingInterval: 'month',
      createdAt: sub.createdAt.toISOString(),
      updatedAt: sub.updatedAt.toISOString(),
    };
  }
}
