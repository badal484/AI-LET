import { prisma } from '../../../infrastructure/database/prisma.js';
import { CreditWalletService } from '../credits/CreditWalletService.js';
import { EntitlementService } from '../entitlements/EntitlementService.js';
import { logger } from '../../../config/logger.js';

export class ReconciliationService {
  /**
   * Run subscription reconciliation across active subscriptions.
   */
  public static async reconcileSubscriptions(): Promise<{
    checkedCount: number;
    mismatchCount: number;
  }> {
    const now = new Date();
    const expiredActiveSubs = await prisma.billingSubscription.findMany({
      where: {
        status: { in: ['ACTIVE', 'TRIALING', 'GRACE_PERIOD'] },
        currentPeriodEnd: { lt: now },
      },
      include: { user: true, plan: true },
    });

    let mismatchCount = 0;

    for (const sub of expiredActiveSubs) {
      // If grace period ended, expire subscription
      const isPastGrace = !sub.gracePeriodEnd || sub.gracePeriodEnd < now;

      if (isPastGrace) {
        await prisma.billingSubscription.update({
          where: { id: sub.id },
          data: {
            status: 'EXPIRED',
            endedAt: now,
          },
        });

        await prisma.billingReconciliation.create({
          data: {
            userId: sub.userId,
            subscriptionId: sub.id,
            provider: sub.provider,
            providerState: { currentPeriodEnd: sub.currentPeriodEnd },
            internalState: { status: 'EXPIRED', previousStatus: sub.status },
            status: 'RESOLVED',
            mismatchReason: `Subscription automatically expired as current period ended on ${sub.currentPeriodEnd.toISOString()}`,
            resolvedAt: now,
            resolvedBy: 'system_reconciliation',
          },
        });

        await EntitlementService.invalidateUserEntitlementsCache(sub.userId);
        mismatchCount++;
      }
    }

    return {
      checkedCount: expiredActiveSubs.length,
      mismatchCount,
    };
  }

  /**
   * Run credit wallet reconciliation for all users with wallets.
   */
  public static async reconcileCreditWallets(): Promise<{
    checkedCount: number;
    correctedCount: number;
  }> {
    const wallets = await prisma.creditWallet.findMany({ take: 200 });
    let correctedCount = 0;

    for (const wallet of wallets) {
      const result = await CreditWalletService.reconcileWalletBalance(wallet.userId);
      if (!result.matched) {
        logger.warn(`Credit wallet mismatch detected and corrected for user ${wallet.userId}: stored=${result.storedBalance}, derived=${result.derivedBalance}`);
        correctedCount++;
      }
    }

    return {
      checkedCount: wallets.length,
      correctedCount,
    };
  }

  /**
   * Admin: List reconciliation records.
   */
  public static async listReconciliationsAdmin() {
    return await prisma.billingReconciliation.findMany({
      include: {
        user: {
          select: { id: true, email: true },
        },
        subscription: {
          include: { plan: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /**
   * Admin: Mark a reconciliation mismatch as resolved.
   */
  public static async resolveMismatchAdmin(
    reconciliationId: string,
    resolutionNotes: string,
    adminUserId?: string
  ) {
    return await prisma.billingReconciliation.update({
      where: { id: reconciliationId },
      data: {
        status: 'RESOLVED',
        mismatchReason: resolutionNotes,
        resolvedAt: new Date(),
        resolvedBy: adminUserId || 'admin',
      },
    });
  }
}
