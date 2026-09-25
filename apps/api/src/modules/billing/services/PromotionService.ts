import { prisma } from '../../../infrastructure/database/prisma.js';
import { BadRequestError, NotFoundError } from '../../../shared/errors/AppError.js';
import { ErrorCode } from '@ai-companion/config';
import { CreditWalletService } from '../credits/CreditWalletService.js';
import { BillingPromotion } from '@ai-companion/types';

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

    // Apply promotion effect
    let grantedCredits = 0;
    if (promotion.discountType === 'FREE_CREDITS') {
      grantedCredits = Math.round(promotion.discountValue);
      await CreditWalletService.grantCredits({
        userId,
        amount: grantedCredits,
        type: 'GRANT',
        idempotencyKey: `promo_${promotion.id}_${userId}_${Date.now()}`,
        description: `Promo Code: ${promotion.code} (${promotion.name})`,
        isPromotional: true,
        expiresAt: new Date(now.getTime() + 30 * 86400000), // 30 day expiration for promo credits
      });
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
      message: `Promotion '${promotion.name}' successfully redeemed!`,
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
