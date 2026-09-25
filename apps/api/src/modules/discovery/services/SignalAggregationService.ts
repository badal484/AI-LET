import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../config/logger.js';
import type { DiscoveryEventBatchInput } from '@ai-companion/validation';

export class SignalAggregationService {
  /**
   * Processes a batch of discovery interaction events.
   */
  public static async processEvents(
    userId: string | undefined,
    data: DiscoveryEventBatchInput,
  ): Promise<{ processed: number }> {
    const events = data.events;
    if (!events || events.length === 0) {
      return { processed: 0 };
    }

    try {
      // 1. Insert raw logs
      await prisma.discoveryEventLog.createMany({
        data: events.map(evt => ({
          userId: userId || null,
          eventType: evt.eventType as any,
          characterId: evt.characterId || null,
          surface: evt.surface,
          position: evt.position || null,
          recommendationVersion: evt.recommendationVersion || 'v1',
          metadata: (evt.metadata as any) || {},
        })),
      });

      // 2. If authenticated user, update projections for characters
      if (userId) {
        for (const evt of events) {
          if (!evt.characterId) continue;

          const now = new Date();
          let viewInc = 0;
          let startInc = 0;
          let dismissInc = 0;
          let favInc = 0;

          if (evt.eventType === 'IMPRESSION' || evt.eventType === 'DETAIL_VIEW') viewInc = 1;
          else if (evt.eventType === 'CHAT_START') startInc = 1;
          else if (evt.eventType === 'DISMISS') dismissInc = 1;
          else if (evt.eventType === 'FAVORITE') favInc = 1;

          await prisma.userCharacterSignal.upsert({
            where: {
              userId_characterId: {
                userId,
                characterId: evt.characterId,
              },
            },
            create: {
              userId,
              characterId: evt.characterId,
              viewsCount: viewInc,
              startsCount: startInc,
              favoritesCount: favInc,
              dismissalsCount: dismissInc,
              lastViewedAt: viewInc > 0 ? now : null,
              lastStartedAt: startInc > 0 ? now : null,
              lastInteractedAt: now,
              lastDismissedAt: dismissInc > 0 ? now : null,
              engagementScore: startInc * 5 + favInc * 4 + viewInc * 0.5 - dismissInc * 3,
            },
            update: {
              viewsCount: { increment: viewInc },
              startsCount: { increment: startInc },
              favoritesCount: { increment: favInc },
              dismissalsCount: { increment: dismissInc },
              lastViewedAt: viewInc > 0 ? now : undefined,
              lastStartedAt: startInc > 0 ? now : undefined,
              lastInteractedAt: now,
              lastDismissedAt: dismissInc > 0 ? now : undefined,
              engagementScore: {
                increment: startInc * 5 + favInc * 4 + viewInc * 0.5 - dismissInc * 3,
              },
            },
          });
        }
      }

      return { processed: events.length };
    } catch (err) {
      logger.error(`[SignalAggregationService] Event processing error: ${(err as Error).message}`);
      return { processed: 0 };
    }
  }

  /**
   * Generates discovery analytics overview for Admin dashboard.
   */
  public static async getAnalyticsOverview(): Promise<any> {
    const [
      totalImpressions,
      totalClicks,
      totalStarts,
      totalFavorites,
      topQueries,
      zeroResultQueries,
    ] = await Promise.all([
      prisma.discoveryEventLog.count({ where: { eventType: 'IMPRESSION' } }),
      prisma.discoveryEventLog.count({ where: { eventType: 'CLICK' } }),
      prisma.discoveryEventLog.count({ where: { eventType: 'CHAT_START' } }),
      prisma.discoveryEventLog.count({ where: { eventType: 'FAVORITE' } }),
      prisma.searchQueryLog.groupBy({
        by: ['normalizedQuery'],
        _count: { normalizedQuery: true },
        _avg: { resultCount: true },
        orderBy: { _count: { normalizedQuery: 'desc' } },
        take: 10,
      }),
      prisma.searchQueryLog.groupBy({
        by: ['normalizedQuery'],
        where: { resultCount: 0 },
        _count: { normalizedQuery: true },
        orderBy: { _count: { normalizedQuery: 'desc' } },
        take: 10,
      }),
    ]);

    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const startConversion = totalClicks > 0 ? (totalStarts / totalClicks) * 100 : 0;

    return {
      totalImpressions,
      totalClicks,
      totalChatStarts: totalStarts,
      totalFavorites,
      overallCtrPercent: parseFloat(ctr.toFixed(2)),
      startConversionPercent: parseFloat(startConversion.toFixed(2)),
      topSearchQueries: topQueries.map(q => ({
        query: q.normalizedQuery,
        count: q._count.normalizedQuery,
        resultCount: Math.round(q._avg.resultCount || 0),
      })),
      zeroResultQueries: zeroResultQueries.map(q => ({
        query: q.normalizedQuery,
        count: q._count.normalizedQuery,
      })),
      topTrendingCharacters: [],
    };
  }
}
