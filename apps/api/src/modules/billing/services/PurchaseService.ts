import { prisma } from '../../../infrastructure/database/prisma.js';
import {
  PurchaseVerificationRequest,
  PurchaseVerificationResponse,
  RestorePurchasesResponse,
  BillingProviderType,
  BillingSubscription,
} from '@ai-companion/types';
import { BadRequestError, NotFoundError } from '../../../shared/errors/AppError.js';
import { ErrorCode } from '@ai-companion/config';
import { BillingProviderFactory } from '../providers/BillingProviderFactory.js';
import { EntitlementService } from '../entitlements/EntitlementService.js';
import { CreditWalletService } from '../credits/CreditWalletService.js';
import { logger } from '../../../config/logger.js';

export class PurchaseService {
  /**
   * Server-side receipt verification and subscription entitlement activation.
   */
  public static async verifyPurchase(
    userId: string,
    request: PurchaseVerificationRequest
  ): Promise<PurchaseVerificationResponse> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError(`User '${userId}' not found`);
    }

    // 1. Idempotency Check: check if provider transaction ID or idempotency key already processed
    const existingTransaction = await prisma.purchaseTransaction.findFirst({
      where: {
        OR: [
          { providerTransactionId: request.transactionId },
          ...(request.idempotencyKey ? [{ idempotencyKey: request.idempotencyKey }] : []),
        ],
      },
      include: {
        subscription: {
          include: { plan: true },
        },
      },
    });

    if (existingTransaction) {
      logger.info(`Transaction ${request.transactionId} already processed for user ${userId}`);
      const effective = await EntitlementService.getEffectiveEntitlements(userId);
      return {
        success: true,
        status: 'ALREADY_PROCESSED',
        subscription: existingTransaction.subscription
          ? this.mapSubscription(existingTransaction.subscription)
          : null,
        entitlements: effective.activeEntitlementsList,
        message: 'Transaction has already been verified and processed.',
      };
    }

    // 2. Delegate to provider adapter
    const provider = BillingProviderFactory.getProvider(request.provider);
    const verified = await provider.verifyPurchase({
      receiptData: request.receiptData,
      productId: request.productId,
      transactionId: request.transactionId,
      planCode: request.planCode,
      currency: request.currency,
      priceAmountMinorUnits: request.priceAmountMinorUnits,
    });

    if (!verified.isValid) {
      // Record failed transaction for auditing
      await prisma.purchaseTransaction.create({
        data: {
          userId,
          provider: request.provider.toUpperCase() as any,
          providerTransactionId: request.transactionId,
          productId: request.productId,
          amountMinorUnits: request.priceAmountMinorUnits || 0,
          currency: (request.currency || 'USD') as any,
          status: 'FAILED',
          rawReceiptData: request.receiptData,
          metadata: verified.rawPayload as any,
        },
      }).catch((err) => logger.warn('Failed to record failed transaction:', err));

      throw new BadRequestError(
        verified.errorMessage || 'Purchase verification failed with provider',
        ErrorCode.PURCHASE_VERIFICATION_FAILED
      );
    }

    // 3. Find matching product / plan
    const targetPlanCode = verified.planCode || request.planCode || 'PRO';
    const plan = await prisma.billingPlan.findUnique({
      where: { code: targetPlanCode },
      include: {
        prices: true,
        entitlements: true,
      },
    });

    if (!plan) {
      throw new NotFoundError(`Billing plan '${targetPlanCode}' not found`);
    }

    const price = plan.prices.find(p => p.active) || null;

    // 4. Transactionally persist purchase, subscription, and ledger entries
    const result = await prisma.$transaction(async (tx) => {
      // Upsert Subscription
      const currentPeriodStart = verified.currentPeriodStart || new Date();
      const currentPeriodEnd = verified.currentPeriodEnd || new Date(currentPeriodStart.getTime() + 30 * 86400000);

      const subscription = await tx.billingSubscription.upsert({
        where: {
          providerSubscriptionId: verified.providerSubscriptionId || `sub_${verified.providerTransactionId}`,
        },
        create: {
          userId,
          planId: plan.id,
          priceId: price?.id,
          status: 'ACTIVE',
          provider: request.provider.toUpperCase() as any,
          providerSubscriptionId: verified.providerSubscriptionId || `sub_${verified.providerTransactionId}`,
          currentPeriodStart,
          currentPeriodEnd,
          trialStart: verified.trialStart,
          trialEnd: verified.trialEnd,
          cancelAtPeriodEnd: false,
        },
        update: {
          planId: plan.id,
          priceId: price?.id,
          status: 'ACTIVE',
          currentPeriodStart,
          currentPeriodEnd,
          cancelAtPeriodEnd: false,
          endedAt: null,
          cancelledAt: null,
        },
        include: { plan: true },
      });

      // Record Purchase Transaction
      const transaction = await tx.purchaseTransaction.create({
        data: {
          userId,
          subscriptionId: subscription.id,
          provider: request.provider.toUpperCase() as any,
          providerTransactionId: verified.providerTransactionId,
          idempotencyKey: request.idempotencyKey,
          productId: verified.productId,
          currency: verified.currency as any,
          amountMinorUnits: verified.amountMinorUnits,
          status: 'SUCCEEDED',
          rawReceiptData: request.receiptData,
          metadata: verified.rawPayload as any,
        },
      });

      // Generate invoice record
      const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
      await tx.billingInvoice.create({
        data: {
          subscriptionId: subscription.id,
          transactionId: transaction.id,
          invoiceNumber,
          currency: verified.currency as any,
          subtotalMinor: verified.amountMinorUnits,
          taxMinor: 0,
          totalMinor: verified.amountMinorUnits,
          status: 'SUCCEEDED',
          periodStart: currentPeriodStart,
          periodEnd: currentPeriodEnd,
        },
      });

      return { subscription, transaction };
    });

    // 5. If product is a credit pack, grant credits
    let creditsGranted = 0;
    if (request.productId.toLowerCase().includes('credit')) {
      creditsGranted = 500; // standard bonus/pack
      await CreditWalletService.grantCredits({
        userId,
        amount: creditsGranted,
        type: 'PURCHASE',
        idempotencyKey: `credit_pack_${verified.providerTransactionId}`,
        description: `Credits from ${request.productId}`,
        referenceType: 'PURCHASE',
        referenceId: result.transaction.id,
      });
    }

    // 6. Invalidate cached entitlements
    await EntitlementService.invalidateUserEntitlementsCache(userId);
    const effective = await EntitlementService.getEffectiveEntitlements(userId);

    return {
      success: true,
      status: 'VERIFIED',
      subscription: this.mapSubscription(result.subscription),
      entitlements: effective.activeEntitlementsList,
      creditsGranted: creditsGranted > 0 ? creditsGranted : undefined,
    };
  }

  /**
   * Restore previous purchases for user without duplicating records.
   */
  public static async restorePurchases(
    userId: string,
    providerType: BillingProviderType,
    receiptData?: string
  ): Promise<RestorePurchasesResponse> {
    const provider = BillingProviderFactory.getProvider(providerType);
    const restoredItems = await provider.restorePurchases({ receiptData });

    let restoredCount = 0;
    let activeSub: BillingSubscription | null = null;

    for (const item of restoredItems) {
      if (item.status === 'active' && item.currentPeriodEnd > new Date()) {
        const plan = await prisma.billingPlan.findFirst({
          where: { isActive: true, code: { not: 'FREE' } },
        });

        if (plan) {
          const subscription = await prisma.billingSubscription.upsert({
            where: {
              providerSubscriptionId: item.subscriptionId || `sub_${item.transactionId}`,
            },
            create: {
              userId,
              planId: plan.id,
              status: 'ACTIVE',
              provider: providerType.toUpperCase() as any,
              providerSubscriptionId: item.subscriptionId || `sub_${item.transactionId}`,
              currentPeriodStart: new Date(),
              currentPeriodEnd: item.currentPeriodEnd,
            },
            update: {
              userId, // re-link to current authenticated user
              status: 'ACTIVE',
              currentPeriodEnd: item.currentPeriodEnd,
            },
            include: { plan: true },
          });

          restoredCount++;
          activeSub = this.mapSubscription(subscription);
        }
      }
    }

    await EntitlementService.invalidateUserEntitlementsCache(userId);
    const effective = await EntitlementService.getEffectiveEntitlements(userId);

    return {
      success: true,
      restoredCount,
      activeSubscription: activeSub,
      entitlements: effective.activeEntitlementsList,
      syncedAt: new Date().toISOString(),
    };
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
