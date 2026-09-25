import { prisma } from '../../../infrastructure/database/prisma.js';
import { ErrorCode } from '@ai-companion/config';
import { NotFoundError } from '../../../shared/errors/AppError.js';
import type { CreatorEarningsLedgerItem } from '@ai-companion/types';

export class CreatorMonetizationService {
  private static readonly FEATURE_FLAG_ENABLED = process.env['ENABLE_CREATOR_MONETIZATION'] === 'true';

  /**
   * Retrieves creator earnings summary and balances.
   */
  public static async getMonetizationOverview(creatorProfileId: string) {
    const creator = await prisma.creatorProfile.findUnique({
      where: { id: creatorProfileId },
    });

    if (!creator) {
      throw new NotFoundError('Creator profile not found', ErrorCode.NOT_FOUND);
    }

    const ledgerEntries = await prisma.creatorEarningsLedger.findMany({
      where: { creatorProfileId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    let totalGrossCents = 0;
    let totalPlatformFeeCents = 0;
    let totalCreatorShareCents = 0;

    for (const entry of ledgerEntries) {
      if (entry.eventType === 'CREATOR_SHARE' || entry.eventType === 'PURCHASE') {
        totalGrossCents += entry.grossAmount;
        totalPlatformFeeCents += entry.platformFee;
        totalCreatorShareCents += entry.creatorNetAmount;
      } else if (entry.eventType === 'REFUND' || entry.eventType === 'CHARGEBACK') {
        totalGrossCents -= entry.grossAmount;
        totalPlatformFeeCents -= entry.platformFee;
        totalCreatorShareCents -= entry.creatorNetAmount;
      }
    }

    return {
      monetizationEnabled: this.FEATURE_FLAG_ENABLED,
      currency: 'INR',
      grossEarningsCents: Math.max(0, totalGrossCents),
      platformFeeCents: Math.max(0, totalPlatformFeeCents),
      creatorNetShareCents: Math.max(0, totalCreatorShareCents),
      pendingPayoutCents: Math.max(0, totalCreatorShareCents),
      paidPayoutCents: 0, // Real-money payouts disabled in this foundation phase
      payoutStatus: 'FOUNDATION_MODE',
      recentEntries: ledgerEntries.map((e: any) => ({
        id: e.id,
        creatorProfileId: e.creatorProfileId,
        characterId: e.characterId || undefined,
        eventType: e.eventType,
        grossAmount: e.grossAmount,
        platformFee: e.platformFee,
        creatorNetAmount: e.creatorNetAmount,
        currency: e.currency,
        referenceId: e.referenceId || undefined,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Appends an immutable financial ledger event.
   */
  public static async recordLedgerEvent(data: {
    creatorProfileId: string;
    characterId?: string;
    entryType: 'PURCHASE' | 'REFUND' | 'CHARGEBACK' | 'CREATOR_SHARE' | 'ADJUSTMENT';
    grossAmountCents: number;
    platformFeeCents: number;
    creatorShareCents: number;
    currency?: string;
    referenceId?: string;
  }): Promise<CreatorEarningsLedgerItem> {
    const entry = await prisma.creatorEarningsLedger.create({
      data: {
        creatorProfileId: data.creatorProfileId,
        characterId: data.characterId || null,
        eventType: data.entryType,
        grossAmount: data.grossAmountCents,
        platformFee: data.platformFeeCents,
        creatorNetAmount: data.creatorShareCents,
        currency: data.currency || 'INR',
        referenceId: data.referenceId || null,
      },
    });

    return {
      id: entry.id,
      creatorProfileId: entry.creatorProfileId,
      characterId: entry.characterId,
      eventType: entry.eventType,
      grossAmount: entry.grossAmount,
      platformFee: entry.platformFee,
      creatorNetAmount: entry.creatorNetAmount,
      currency: entry.currency,
      referenceId: entry.referenceId,
      createdAt: entry.createdAt.toISOString(),
    };
  }
}
