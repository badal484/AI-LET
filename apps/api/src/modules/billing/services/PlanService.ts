import { prisma } from '../../../infrastructure/database/prisma.js';
import {
  BillingPlanSummary,
  PaywallConfig,
  PriceCurrency,
  PlanInterval,
} from '@ai-companion/types';
import { ConflictError } from '../../../shared/errors/AppError.js';
import { Money } from '../domain/Money.js';

export class PlanService {
  /**
   * List all active plans formatted for client paywall presentation.
   */
  public static async getActivePlans(): Promise<BillingPlanSummary[]> {
    const plans = await prisma.billingPlan.findMany({
      where: { isActive: true },
      include: {
        prices: {
          where: { active: true },
        },
        entitlements: true,
        usageLimits: true,
      },
      orderBy: { trialDays: 'asc' },
    });

    return plans.map((plan) => {
      const limitsMap: Record<string, number> = {};
      for (const limit of plan.usageLimits) {
        limitsMap[limit.meterUnit] = limit.limitAmount;
      }

      return {
        id: plan.id,
        code: plan.code,
        name: plan.name,
        tagline: plan.tagline,
        description: plan.description,
        trialDays: plan.trialDays,
        isPopular: plan.isPopular,
        prices: plan.prices.map((p) => ({
          id: p.id,
          currency: p.currency as PriceCurrency,
          amountMinorUnits: p.amountMinorUnits,
          billingInterval: (p.billingInterval?.toLowerCase() || 'month') as PlanInterval,
          formattedPrice: Money.fromMinor(p.amountMinorUnits, p.currency as PriceCurrency).format(),
        })),
        entitlements: plan.entitlements.map((e) => e.entitlementKey),
        limits: limitsMap,
      };
    });
  }

  /**
   * Get dynamic paywall configuration for mobile and web clients.
   */
  public static async getPaywallConfig(_userId?: string): Promise<PaywallConfig> {
    const activePlans = await this.getActivePlans();

    const planCards = activePlans
      .filter((p) => p.code !== 'FREE')
      .map((p) => {
        const monthlyPrice = p.prices.find((pr) => pr.billingInterval === 'month');
        const yearlyPrice = p.prices.find((pr) => pr.billingInterval === 'year');

        let savingsText: string | undefined;
        let monthlyEquivFormatted: string | undefined;

        if (monthlyPrice && yearlyPrice) {
          const yearlyTotal = yearlyPrice.amountMinorUnits;
          const monthlyYearlyTotal = monthlyPrice.amountMinorUnits * 12;
          if (monthlyYearlyTotal > yearlyTotal) {
            const savingsPct = Math.round(((monthlyYearlyTotal - yearlyTotal) / monthlyYearlyTotal) * 100);
            savingsText = `Save ${savingsPct}%`;
          }
          const monthlyEquiv = Math.round(yearlyTotal / 12);
          monthlyEquivFormatted = Money.fromMinor(monthlyEquiv, yearlyPrice.currency).format();
        }

        return {
          planId: p.id,
          code: p.code,
          name: p.name,
          tagline: p.tagline,
          badge: p.isPopular ? 'Most Popular' : undefined,
          isPopular: p.isPopular,
          monthlyPrice: monthlyPrice
            ? {
                id: monthlyPrice.id,
                amountMinorUnits: monthlyPrice.amountMinorUnits,
                currency: monthlyPrice.currency,
                formatted: monthlyPrice.formattedPrice,
              }
            : null,
          yearlyPrice: yearlyPrice
            ? {
                id: yearlyPrice.id,
                amountMinorUnits: yearlyPrice.amountMinorUnits,
                currency: yearlyPrice.currency,
                formatted: yearlyPrice.formattedPrice,
                savingsText,
                monthlyEquivalentFormatted: monthlyEquivFormatted,
              }
            : null,
          trialDays: p.trialDays,
          features: p.entitlements.map(e => this.formatEntitlementLabel(e)),
        };
      });

    return {
      headline: 'Deepen Your AI Companion Connection',
      subtitle: 'Unlock unlimited high-fidelity conversations, real-time voice, and emotional memory.',
      featuredPlanCode: 'PRO',
      badge: 'Special Membership',
      benefits: [
        {
          icon: 'sparkles',
          title: 'Unrestricted Conversations',
          description: 'Never hit conversation caps or slow-downs during intimate moments.',
          highlighted: true,
        },
        {
          icon: 'microphone',
          title: 'Full Real-Time Voice Calls',
          description: 'Speak hands-free with natural, emotive, ultra-low-latency voices.',
        },
        {
          icon: 'brain',
          title: 'Advanced Memory & Recall',
          description: 'Your companion remembers shared lore, inside jokes, and personal milestones.',
        },
        {
          icon: 'image',
          title: 'High-Definition Selfies & Images',
          description: 'Receive visual moments and character portraits seamlessly in chat.',
        },
      ],
      plans: planCards,
      termsUrl: 'https://aicompanion.app/terms',
      privacyUrl: 'https://aicompanion.app/privacy',
    };
  }

  /**
   * Admin: Create a new commercial plan.
   */
  public static async createPlan(data: {
    productId: string;
    code: string;
    name: string;
    tagline?: string;
    description?: string;
    isActive?: boolean;
    isPopular?: boolean;
    trialDays?: number;
    entitlements?: string[];
    usageLimits?: Array<{ meterUnit: string; limitAmount: number; period?: string }>;
    metadata?: Record<string, unknown>;
  }) {
    const existing = await prisma.billingPlan.findUnique({
      where: { code: data.code.toUpperCase() },
    });
    if (existing) {
      throw new ConflictError(`Plan with code '${data.code}' already exists`);
    }

    return await prisma.$transaction(async (tx) => {
      const plan = await tx.billingPlan.create({
        data: {
          productId: data.productId,
          code: data.code.toUpperCase(),
          name: data.name,
          tagline: data.tagline || '',
          description: data.description || '',
          isActive: data.isActive ?? true,
          isPopular: data.isPopular ?? false,
          trialDays: data.trialDays ?? 0,
          metadata: (data.metadata || {}) as any,
        },
      });

      if (data.entitlements && data.entitlements.length > 0) {
        await tx.planEntitlement.createMany({
          data: data.entitlements.map((key) => ({
            planId: plan.id,
            entitlementKey: key,
          })),
        });
      }

      if (data.usageLimits && data.usageLimits.length > 0) {
        await tx.planUsageLimit.createMany({
          data: data.usageLimits.map((l) => ({
            planId: plan.id,
            meterUnit: l.meterUnit,
            limitAmount: l.limitAmount,
            period: l.period || 'month',
          })),
        });
      }

      return plan;
    });
  }

  /**
   * Admin: Create price for a product/plan.
   */
  public static async createPrice(data: {
    productId: string;
    planId?: string;
    currency: PriceCurrency;
    amountMinorUnits: number;
    billingInterval?: PlanInterval;
    billingIntervalCount?: number;
    provider: 'apple' | 'google' | 'stripe' | 'mock';
    providerPriceId: string;
    country?: string;
    active?: boolean;
    metadata?: Record<string, unknown>;
  }) {
    return await prisma.billingPrice.create({
      data: {
        productId: data.productId,
        planId: data.planId,
        currency: data.currency,
        amountMinorUnits: data.amountMinorUnits,
        billingInterval: data.billingInterval ? (data.billingInterval.toUpperCase() as any) : null,
        billingIntervalCount: data.billingIntervalCount || 1,
        provider: data.provider.toUpperCase() as any,
        providerPriceId: data.providerPriceId,
        country: data.country,
        active: data.active ?? true,
        metadata: (data.metadata || {}) as any,
      },
    });
  }

  /**
   * Admin: List all products, plans, and prices.
   */
  public static async listAllAdmin() {
    const products = await prisma.billingProduct.findMany({
      include: {
        plans: {
          include: {
            entitlements: true,
            usageLimits: true,
            prices: true,
          },
        },
        prices: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return products;
  }

  private static formatEntitlementLabel(key: string): string {
    return key
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
}
