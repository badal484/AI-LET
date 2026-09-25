import { prisma } from '../../../infrastructure/database/prisma.js';
import { SYSTEM_CONSTANTS } from '@ai-companion/config';
import { UsageMeterItem, MeterUnit } from '@ai-companion/types';

export class UsageMeterService {
  /**
   * Determine the current billing period boundaries for a user.
   */
  public static async getBillingPeriod(userId: string, targetDate: Date = new Date()): Promise<{ periodStart: Date; periodEnd: Date; planCode: string }> {
    const activeSub = await prisma.billingSubscription.findFirst({
      where: {
        userId,
        status: { in: ['ACTIVE', 'TRIALING', 'GRACE_PERIOD'] },
        currentPeriodStart: { lte: targetDate },
        currentPeriodEnd: { gte: targetDate },
      },
      include: {
        plan: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (activeSub) {
      return {
        periodStart: activeSub.currentPeriodStart,
        periodEnd: activeSub.currentPeriodEnd,
        planCode: activeSub.plan.code,
      };
    }

    // Default calendar month in UTC
    const year = targetDate.getUTCFullYear();
    const month = targetDate.getUTCMonth();
    const periodStart = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
    const periodEnd = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

    return {
      periodStart,
      periodEnd,
      planCode: 'FREE',
    };
  }

  /**
   * Get configured limit for a meter unit on a given plan.
   */
  public static async getPlanLimit(planCode: string, meterUnit: string): Promise<number> {
    const plan = await prisma.billingPlan.findUnique({
      where: { code: planCode },
      include: { usageLimits: true },
    });

    if (plan) {
      const limitConfig = plan.usageLimits.find(l => l.meterUnit === meterUnit);
      if (limitConfig) {
        return limitConfig.limitAmount;
      }
    }

    // Fallback free limits
    switch (meterUnit) {
      case SYSTEM_CONSTANTS.BILLING.METER_UNITS.AI_TEXT_TOKENS:
        return SYSTEM_CONSTANTS.BILLING.DEFAULT_FREE_LIMITS.AI_TEXT_TOKENS;
      case SYSTEM_CONSTANTS.BILLING.METER_UNITS.VOICE_SECONDS:
        return SYSTEM_CONSTANTS.BILLING.DEFAULT_FREE_LIMITS.VOICE_SECONDS;
      case SYSTEM_CONSTANTS.BILLING.METER_UNITS.IMAGE_GENERATIONS:
        return SYSTEM_CONSTANTS.BILLING.DEFAULT_FREE_LIMITS.IMAGE_GENERATIONS;
      default:
        return 1000;
    }
  }

  /**
   * Get or create active usage meter for user and meterUnit.
   */
  public static async getOrCreateMeter(userId: string, meterUnit: string, targetDate: Date = new Date()) {
    const { periodStart, periodEnd, planCode } = await this.getBillingPeriod(userId, targetDate);
    const limitAmount = await this.getPlanLimit(planCode, meterUnit);

    const meter = await prisma.usageMeter.upsert({
      where: {
        userId_meterUnit_periodStart_periodEnd: {
          userId,
          meterUnit,
          periodStart,
          periodEnd,
        },
      },
      create: {
        userId,
        meterUnit,
        periodStart,
        periodEnd,
        limitAmount,
        consumedAmount: 0,
        reservedAmount: 0,
      },
      update: {
        limitAmount, // ensure limit matches current plan
      },
    });

    return meter;
  }

  /**
   * Get all active usage meters for a user formatted for API response.
   */
  public static async getUserUsageMeters(userId: string): Promise<UsageMeterItem[]> {
    const targetDate = new Date();
    const { periodStart, periodEnd, planCode } = await this.getBillingPeriod(userId, targetDate);

    const standardUnits: MeterUnit[] = [
      'ai_text_tokens',
      'voice_seconds',
      'image_generations',
    ];

    const results: UsageMeterItem[] = [];

    for (const unit of standardUnits) {
      const limitAmount = await this.getPlanLimit(planCode, unit);
      const meter = await prisma.usageMeter.upsert({
        where: {
          userId_meterUnit_periodStart_periodEnd: {
            userId,
            meterUnit: unit,
            periodStart,
            periodEnd,
          },
        },
        create: {
          userId,
          meterUnit: unit,
          periodStart,
          periodEnd,
          limitAmount,
          consumedAmount: 0,
          reservedAmount: 0,
        },
        update: {
          limitAmount,
        },
      });

      const remaining = Math.max(0, meter.limitAmount - (meter.consumedAmount + meter.reservedAmount));

      results.push({
        id: meter.id,
        userId: meter.userId,
        meterUnit: meter.meterUnit,
        periodStart: meter.periodStart.toISOString(),
        periodEnd: meter.periodEnd.toISOString(),
        limitAmount: meter.limitAmount,
        consumedAmount: meter.consumedAmount,
        reservedAmount: meter.reservedAmount,
        remainingAmount: remaining,
        unitFormatted: this.formatMeterUnitName(meter.meterUnit),
      });
    }

    return results;
  }

  private static formatMeterUnitName(unit: string): string {
    switch (unit) {
      case 'ai_text_tokens':
        return 'AI Tokens';
      case 'voice_seconds':
        return 'Voice Seconds';
      case 'image_generations':
        return 'Image Generations';
      case 'premium_messages':
        return 'Premium Messages';
      default:
        return unit;
    }
  }
}
