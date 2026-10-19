import { prisma } from '../../../infrastructure/database/prisma.js';
import { BadRequestError, NotFoundError } from '../../../shared/errors/AppError.js';
import { ErrorCode } from '@ai-companion/config';
import { CreditWalletService } from '../credits/CreditWalletService.js';
import { BillingPromotion } from '@ai-companion/types';
import { EntitlementService } from '../entitlements/EntitlementService.js';

/**
 * Free Premium from a promo code: N days, added after any Premium they already have (paid or promo), so a code
 * never wastes days they've paid for. Recorded as its own subscription (provider PROMO) — nothing to renew or cancel.
 */
async function grantPremiumDays(userId: string, days: number, code: string): Promise<Date> {
  const plan = await prisma.billingPlan.findUnique({ where: { code: 'PREMIUM' } });
  if (!plan) throw new NotFoundError('Premium is not set up yet.');
  const now = new Date();
  const latest = await prisma.billingSubscription.findFirst({
    where: { userId, currentPeriodEnd: { gt: now }, status: { in: ['TRIALING', 'ACTIVE', 'GRACE_PERIOD', 'CANCELLED'] }, plan: { code: { not: 'FREE' } } },
    orderBy: { currentPeriodEnd: 'desc' },
    select: { currentPeriodEnd: true },
  });
  const start = latest ? latest.currentPeriodEnd : now;
  const end = new Date(start.getTime() + days * 86_400_000);
  await prisma.billingSubscription.create({
    data: {
      userId,
      planId: plan.id,
      status: 'ACTIVE',
      provider: 'PROMO',
      providerSubscriptionId: `promo_${code}_${userId}_${now.getTime()}`,
      currentPeriodStart: now,
      currentPeriodEnd: end,
      cancelAtPeriodEnd: true, // never renews
      metadata: { promoCode: code, days },
    },
  });
  await EntitlementService.invalidateUserEntitlementsCache(userId);
  return end;
}

export class PromotionService {
  /**
   * Redeem a promotional offer for a user.
   */
  public static async redeemPromotion(userId: string, promoCode: string) {
    const code = promoCode.trim().toUpperCase();
    const promotion = await prisma.billingPromotion.findUnique({
      where: { code },
      include: { plan: true },
    });

    if (!promotion || !promotion.isActive) {
      throw new NotFoundError(`Promotion code '${code}' is invalid or expired`, ErrorCode.PROMOTION_NOT_ELIGIBLE);
    }

    const now = new Date();
    if (promotion.validFrom > now || (promotion.validUntil && promotion.validUntil < now)) {
      throw new BadRequestError(`Promotion code '${code}' has expired`, ErrorCode.PROMOTION_EXPIRED);
    }

    if (promotion.maxRedemptions && promotion.currentRedemptions >= promotion.maxRedemptions) {
      throw new BadRequestError(`Promotion code '${code}' redemption limit has been reached`, ErrorCode.PROMOTION_EXPIRED);
    }

    // Check user redemption count
    const userRedemptionsCount = await prisma.promoRedemption.count({
      where: {
        promotionId: promotion.id,
        userId,
      },
    });

    if (userRedemptionsCount >= promotion.perUserLimit) {
      throw new BadRequestError(
        `You have already redeemed promotion code '${code}'`,
        ErrorCode.PROMOTION_NOT_ELIGIBLE
      );
    }

    // What a code gives (admin → Settings → Promo codes): free coins, or free Premium for a number of days.
    let grantedCredits = 0;
    let premiumUntil: Date | null = null;
    if (promotion.discountType === 'FREE_CREDITS') {
      grantedCredits = Math.round(promotion.discountValue);
      await CreditWalletService.grantCredits({
        userId,
        amount: grantedCredits,
        type: 'GRANT',
        idempotencyKey: `promo_${promotion.id}_${userId}_${userRedemptionsCount + 1}`,
        description: `Promo code ${promotion.code}`,
        isPromotional: true,
      });
    } else if (promotion.discountType === 'TRIAL_EXTENSION') {
      premiumUntil = await grantPremiumDays(userId, Math.round(promotion.discountValue), promotion.code);
    } else {
      // % / ₹ off are not offered (a discount on the ₹499 needs Play/Razorpay offers): never say "redeemed" for nothing.
      throw new BadRequestError(`Promotion code '${code}' can't be used in the app`, ErrorCode.PROMOTION_NOT_ELIGIBLE);
    }

    // Record redemption and increment counter
    await prisma.$transaction([
      prisma.promoRedemption.create({
        data: {
          promotionId: promotion.id,
          userId,
        },
      }),
      prisma.billingPromotion.update({
        where: { id: promotion.id },
        data: { currentRedemptions: { increment: 1 } },
      }),
    ]);

    return {
      success: true,
      code: promotion.code,
      name: promotion.name,
      discountType: promotion.discountType.toLowerCase(),
      discountValue: promotion.discountValue,
      grantedCredits: grantedCredits > 0 ? grantedCredits : undefined,
      premiumUntil: premiumUntil?.toISOString(),
      message: premiumUntil
        ? `Premium is yours until ${premiumUntil.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} 💜`
        : `${grantedCredits} coins added 🪙`,
    };
  }

  /**
   * Admin: Create new promotion campaign.
   */
  public static async createPromotion(data: {
    code: string;
    name: string;
    description?: string;
    discountType: 'percentage' | 'fixed_amount' | 'free_credits' | 'trial_extension';
    discountValue: number;
    planId?: string;
    maxRedemptions?: number;
    perUserLimit?: number;
    validFrom?: string;
    validUntil?: string;
    isActive?: boolean;
    targetAudience?: string;
  }): Promise<BillingPromotion> {
    const code = data.code.trim().toUpperCase();
    const existing = await prisma.billingPromotion.findUnique({ where: { code } });
    if (existing) {
      throw new BadRequestError(`Promotion code '${code}' already exists`);
    }

    const created = await prisma.billingPromotion.create({
      data: {
        code,
        name: data.name,
        description: data.description || '',
        discountType: data.discountType.toUpperCase() as any,
        discountValue: data.discountValue,
        planId: data.planId,
        maxRedemptions: data.maxRedemptions,
        perUserLimit: data.perUserLimit ?? 1,
        validFrom: data.validFrom ? new Date(data.validFrom) : new Date(),
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        isActive: data.isActive ?? true,
        targetAudience: data.targetAudience,
      },
    });

    return {
      id: created.id,
      code: created.code,
      name: created.name,
      description: created.description,
      discountType: created.discountType.toLowerCase() as any,
      discountValue: created.discountValue,
      planId: created.planId,
      maxRedemptions: created.maxRedemptions,
      currentRedemptions: created.currentRedemptions,
      perUserLimit: created.perUserLimit,
      validFrom: created.validFrom.toISOString(),
      validUntil: created.validUntil ? created.validUntil.toISOString() : null,
      isActive: created.isActive,
      targetAudience: created.targetAudience,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  /**
   * Admin: List all promotions.
   */
  public static async listPromotionsAdmin(): Promise<BillingPromotion[]> {
    const promos = await prisma.billingPromotion.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return promos.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description,
      discountType: p.discountType.toLowerCase() as any,
      discountValue: p.discountValue,
      planId: p.planId,
      maxRedemptions: p.maxRedemptions,
      currentRedemptions: p.currentRedemptions,
      perUserLimit: p.perUserLimit,
      validFrom: p.validFrom.toISOString(),
      validUntil: p.validUntil ? p.validUntil.toISOString() : null,
      isActive: p.isActive,
      targetAudience: p.targetAudience,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));
  }
}
