import { prisma } from '../../../infrastructure/database/prisma.js';
import { CreditTransactionType, CreditWalletSummary } from '@ai-companion/types';
import { AppError, NotFoundError } from '../../../shared/errors/AppError.js';
import { ErrorCode } from '@ai-companion/config';

export class CreditWalletService {
  /**
   * Get or initialize credit wallet for user.
   */
  public static async getOrCreateWallet(userId: string) {
    return await prisma.creditWallet.upsert({
      where: { userId },
      create: {
        userId,
        availableBalance: 0,
        purchasedCredits: 0,
        promotionalCredits: 0,
      },
      update: {},
    });
  }

  /**
   * Get formatted credit wallet summary including upcoming expiring credits.
   */
  public static async getWalletSummary(userId: string): Promise<CreditWalletSummary> {
    const wallet = await this.getOrCreateWallet(userId);
    const now = new Date();

    const nextExpiring = await prisma.creditTransaction.findFirst({
      where: {
        userId,
        type: 'GRANT',
        expiresAt: { gt: now },
      },
      orderBy: { expiresAt: 'asc' },
    });

    return {
      userId: wallet.userId,
      availableBalance: wallet.availableBalance,
      purchasedCredits: wallet.purchasedCredits,
      promotionalCredits: wallet.promotionalCredits,
      expiringCredits: nextExpiring?.expiresAt
        ? {
            amount: nextExpiring.amount,
            expiresAt: nextExpiring.expiresAt.toISOString(),
          }
        : null,
      updatedAt: wallet.updatedAt.toISOString(),
    };
  }

  /**
   * Grant credits to a user's wallet with ledger entry and idempotency.
   */
  public static async grantCredits(params: {
    userId: string;
    amount: number;
    type: 'PURCHASE' | 'GRANT' | 'ADJUSTMENT';
    idempotencyKey: string;
    description: string;
    referenceType?: string;
    referenceId?: string;
    expiresAt?: Date;
    isPromotional?: boolean;
  }) {
    if (params.amount <= 0) {
      throw new AppError('Credit grant amount must be positive', 400, ErrorCode.BAD_REQUEST);
    }

    // Check idempotency
    const existing = await prisma.creditTransaction.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
    });
    if (existing) {
      return existing;
    }

    return await prisma.$transaction(async (tx) => {
      const wallet = await tx.creditWallet.upsert({
        where: { userId: params.userId },
        create: {
          userId: params.userId,
          availableBalance: params.amount,
          purchasedCredits: params.isPromotional ? 0 : params.amount,
          promotionalCredits: params.isPromotional ? params.amount : 0,
        },
        update: {
          availableBalance: { increment: params.amount },
          purchasedCredits: params.isPromotional ? undefined : { increment: params.amount },
          promotionalCredits: params.isPromotional ? { increment: params.amount } : undefined,
        },
      });

      const transaction = await tx.creditTransaction.create({
        data: {
          walletId: wallet.id,
          userId: params.userId,
          type: params.type,
          amount: params.amount,
          balanceAfter: wallet.availableBalance,
          idempotencyKey: params.idempotencyKey,
          description: params.description,
          referenceType: params.referenceType,
          referenceId: params.referenceId,
          expiresAt: params.expiresAt,
        },
      });

      return transaction;
    });
  }

  /**
   * Consume credits from user's wallet with balance validation and ledger entry.
   */
  public static async consumeCredits(params: {
    userId: string;
    amount: number;
    idempotencyKey: string;
    description: string;
    referenceType?: string;
    referenceId?: string;
  }) {
    if (params.amount <= 0) {
      throw new AppError('Credit consumption amount must be positive', 400, ErrorCode.BAD_REQUEST);
    }

    const existing = await prisma.creditTransaction.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
    });
    if (existing) {
      return existing;
    }

    return await prisma.$transaction(async (tx) => {
      const wallet = await tx.creditWallet.findUnique({
        where: { userId: params.userId },
      });

      if (!wallet || wallet.availableBalance < params.amount) {
        throw new AppError(
          `Insufficient credit balance. Required: ${params.amount}, Available: ${wallet?.availableBalance || 0}`,
          400,
          ErrorCode.CREDIT_BALANCE_INSUFFICIENT,
        );
      }

      // Priority consumption: consume promotional credits first, then purchased credits
      const promoDeduction = Math.min(wallet.promotionalCredits, params.amount);
      const purchasedDeduction = params.amount - promoDeduction;

      const updatedWallet = await tx.creditWallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: { decrement: params.amount },
          promotionalCredits: { decrement: promoDeduction },
          purchasedCredits: { decrement: purchasedDeduction },
        },
      });

      const transaction = await tx.creditTransaction.create({
        data: {
          walletId: wallet.id,
          userId: params.userId,
          type: 'CONSUMPTION',
          amount: -params.amount,
          balanceAfter: updatedWallet.availableBalance,
          idempotencyKey: params.idempotencyKey,
          description: params.description,
          referenceType: params.referenceType,
          referenceId: params.referenceId,
        },
      });

      return transaction;
    });
  }

  /**
   * Refund or reverse previously granted or consumed credits.
   */
  public static async refundTransaction(transactionId: string, reason: string) {
    const original = await prisma.creditTransaction.findUnique({
      where: { id: transactionId },
    });

    if (!original) {
      throw new NotFoundError(`Credit transaction '${transactionId}' not found`);
    }

    const reversalAmount = -original.amount;
    const reversalType: 'REVERSAL' | 'REFUND' = original.amount > 0 ? 'REVERSAL' : 'REFUND';
    const reversalKey = `reversal:${original.id}`;

    const existingReversal = await prisma.creditTransaction.findUnique({
      where: { idempotencyKey: reversalKey },
    });
    if (existingReversal) {
      return existingReversal;
    }

    return await prisma.$transaction(async (tx) => {
      const wallet = await tx.creditWallet.update({
        where: { id: original.walletId },
        data: {
          availableBalance: { increment: reversalAmount },
        },
      });

      return await tx.creditTransaction.create({
        data: {
          walletId: wallet.id,
          userId: original.userId,
          type: reversalType,
          amount: reversalAmount,
          balanceAfter: wallet.availableBalance,
          idempotencyKey: reversalKey,
          description: `Reversal of #${original.id}: ${reason}`,
          referenceType: 'REFUND',
          referenceId: original.id,
        },
      });
    });
  }

  /**
   * Reconcile user's wallet projection with immutable ledger sum.
   */
  public static async reconcileWalletBalance(userId: string) {
    const wallet = await this.getOrCreateWallet(userId);

    const ledgerSum = await prisma.creditTransaction.aggregate({
      where: { userId },
      _sum: { amount: true },
    });

    const derivedBalance = ledgerSum._sum.amount || 0;
    const storedBalance = wallet.availableBalance;
    const matched = derivedBalance === storedBalance;

    if (!matched) {
      await prisma.creditWallet.update({
        where: { id: wallet.id },
        data: { availableBalance: derivedBalance },
      });
    }

    return {
      userId,
      derivedBalance,
      storedBalance,
      matched,
    };
  }

  /**
   * Get paginated credit transaction history for user.
   */
  public static async getTransactionHistory(userId: string, limit: number = 20, cursor?: string) {
    const transactions = await prisma.creditTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    let nextCursor: string | null = null;
    if (transactions.length > limit) {
      const nextItem = transactions.pop();
      nextCursor = nextItem ? nextItem.id : null;
    }

    return {
      items: transactions.map(t => ({
        id: t.id,
        userId: t.userId,
        type: t.type.toLowerCase() as CreditTransactionType,
        amount: t.amount,
        balanceAfter: t.balanceAfter,
        idempotencyKey: t.idempotencyKey,
        referenceType: t.referenceType,
        referenceId: t.referenceId,
        description: t.description,
        expiresAt: t.expiresAt ? t.expiresAt.toISOString() : null,
        createdAt: t.createdAt.toISOString(),
      })),
      nextCursor,
    };
  }
}
