import { prisma } from '../../../infrastructure/database/prisma.js';
import type {
  ProductDailyMetricItem,
  CharacterDailyMetricItem,
  CreatorDailyMetricItem,
  CohortRetentionItem,
  OnboardingFunnelStep,
  AttributionChannelSummary,
} from '@ai-companion/types';

export class MetricsAggregationService {
  /**
   * Aggregates platform-wide daily product metrics for a specified day.
   */
  public static async aggregateProductDailyMetrics(targetDate = new Date()): Promise<ProductDailyMetricItem> {
    const dayStart = new Date(targetDate);
    dayStart.setUTCHours(0, 0, 0, 0);

    const dayEnd = new Date(targetDate);
    dayEnd.setUTCHours(23, 59, 59, 999);

    const sevenDaysAgo = new Date(dayStart);
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);

    const thirtyDaysAgo = new Date(dayStart);
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 29);

    // 1. DAU: unique active users today
    const dauEvents = await prisma.analyticsEvent.findMany({
      where: {
        timestamp: { gte: dayStart, lte: dayEnd },
        userId: { not: null },
      },
      distinct: ['userId'],
      select: { userId: true },
    });
    const dau = dauEvents.length;

    // 2. WAU
    const wauEvents = await prisma.analyticsEvent.findMany({
      where: {
        timestamp: { gte: sevenDaysAgo, lte: dayEnd },
        userId: { not: null },
      },
      distinct: ['userId'],
      select: { userId: true },
    });
    const wau = wauEvents.length;

    // 3. MAU
    const mauEvents = await prisma.analyticsEvent.findMany({
      where: {
        timestamp: { gte: thirtyDaysAgo, lte: dayEnd },
        userId: { not: null },
      },
      distinct: ['userId'],
      select: { userId: true },
    });
    const mau = mauEvents.length;

    // 4. New users today
    const newUsers = await prisma.user.count({
      where: { createdAt: { gte: dayStart, lte: dayEnd } },
    });

    // 5. Activated users today
    const activatedEvents = await prisma.analyticsEvent.findMany({
      where: {
        eventName: { in: ['activation_completed', 'onboarding_completed'] },
        timestamp: { gte: dayStart, lte: dayEnd },
        userId: { not: null },
      },
      distinct: ['userId'],
      select: { userId: true },
    });
    const activatedUsers = activatedEvents.length;

    // 6. Messages today
    const messages = await prisma.message.count({
      where: { createdAt: { gte: dayStart, lte: dayEnd } },
    });

    // 7. Conversations today
    const conversations = await prisma.conversation.count({
      where: { updatedAt: { gte: dayStart, lte: dayEnd } },
    });

    // 8. Revenue today
    const transactions = await prisma.purchaseTransaction.findMany({
      where: {
        status: 'SUCCEEDED',
        createdAt: { gte: dayStart, lte: dayEnd },
      },
      select: { amountMinorUnits: true },
    });
    const revenue = transactions.reduce((acc, t) => acc + t.amountMinorUnits / 100, 0);

    // 9. AI cost today
    const aiUsage = await prisma.aIUsageEvent.findMany({
      where: { createdAt: { gte: dayStart, lte: dayEnd } },
      select: { estimatedCost: true, task: true },
    });
    const aiCost = Number(aiUsage.reduce((acc, u) => acc + u.estimatedCost, 0).toFixed(4));
    const grossMargin = Number((revenue - aiCost).toFixed(4));

    // 10. Voice & Image count
    const voiceMinutes = Number(
      (aiUsage.filter(u => u.task === 'VOICE_TTS').length * 0.25).toFixed(1),
    );
    const imageGenerations = aiUsage.filter(u => u.task === 'IMAGE_GEN').length;

    // 11. Day-N retention (%): of the users who signed up N days before this day, the share with any
    // analytics activity on this day. 0 when that cohort is empty.
    const activeToday = new Set(dauEvents.map((e) => e.userId as string));
    const retention = async (n: number): Promise<number> => {
      const cohortStart = new Date(dayStart);
      cohortStart.setUTCDate(cohortStart.getUTCDate() - n);
      const cohortEnd = new Date(cohortStart);
      cohortEnd.setUTCHours(23, 59, 59, 999);
      const cohort = await prisma.user.findMany({
        where: { createdAt: { gte: cohortStart, lte: cohortEnd } },
        select: { id: true },
      });
      if (cohort.length === 0) return 0;
      const retained = cohort.filter((u) => activeToday.has(u.id)).length;
      return Number(((retained / cohort.length) * 100).toFixed(1));
    };
    const [d1Retained, d7Retained, d30Retained] = await Promise.all([retention(1), retention(7), retention(30)]);

    // Upsert into product_daily_metrics
    const metric = await prisma.productDailyMetric.upsert({
      where: { date: dayStart },
      create: {
        date: dayStart,
        dau,
        wau,
        mau,
        newUsers,
        activatedUsers,
        d1Retained,
        d7Retained,
        d30Retained,
        conversations,
        messages,
        revenue,
        aiCost,
        grossMargin,
        voiceMinutes,
        imageGenerations,
      },
      update: {
        dau,
        wau,
        mau,
        newUsers,
        activatedUsers,
        d1Retained,
        d7Retained,
        d30Retained,
        conversations,
        messages,
        revenue,
        aiCost,
        grossMargin,
        voiceMinutes,
        imageGenerations,
      },
    });

    return {
      id: metric.id,
      date: metric.date.toISOString().split('T')[0]!,
      dau: metric.dau,
      wau: metric.wau,
      mau: metric.mau,
      newUsers: metric.newUsers,
      activatedUsers: metric.activatedUsers,
      d1Retained: metric.d1Retained,
      d7Retained: metric.d7Retained,
      d30Retained: metric.d30Retained,
      conversations: metric.conversations,
      messages: metric.messages,
      revenue: metric.revenue,
      aiCost: metric.aiCost,
      grossMargin: metric.grossMargin,
      voiceMinutes: metric.voiceMinutes,
      imageGenerations: metric.imageGenerations,
    };
  }

  /**
   * Aggregates character performance metrics for a specified day.
   */
  public static async aggregateCharacterDailyMetrics(targetDate = new Date()): Promise<CharacterDailyMetricItem[]> {
    const dayStart = new Date(targetDate);
    dayStart.setUTCHours(0, 0, 0, 0);

    const dayEnd = new Date(targetDate);
    dayEnd.setUTCHours(23, 59, 59, 999);

    const characters = await prisma.character.findMany({
      where: { status: 'PUBLISHED' },
      select: { id: true, name: true },
    });

    const results: CharacterDailyMetricItem[] = [];

    for (const char of characters) {
      const charEvents = await prisma.analyticsEvent.findMany({
        where: {
          characterId: char.id,
          timestamp: { gte: dayStart, lte: dayEnd },
        },
        select: { eventName: true, userId: true },
      });

      const views = charEvents.filter(e => e.eventName === 'character_viewed').length;
      const starts = charEvents.filter(e => e.eventName === 'character_started').length;
      const favorites = charEvents.filter(e => e.eventName === 'character_favorited').length;
      const activeUserIds = new Set(charEvents.map(e => e.userId).filter(Boolean));

      const messages = await prisma.message.count({
        where: {
          conversation: { characterId: char.id },
          createdAt: { gte: dayStart, lte: dayEnd },
        },
      });

      const aiUsage = await prisma.aIUsageEvent.findMany({
        where: {
          characterId: char.id,
          createdAt: { gte: dayStart, lte: dayEnd },
        },
        select: { estimatedCost: true },
      });
      const aiCost = Number(aiUsage.reduce((acc, u) => acc + u.estimatedCost, 0).toFixed(4));

      const metric = await prisma.characterDailyMetric.upsert({
        where: {
          characterId_date: {
            characterId: char.id,
            date: dayStart,
          },
        },
        create: {
          characterId: char.id,
          date: dayStart,
          views,
          starts,
          messages,
          activeUsers: activeUserIds.size,
          returningUsers: Math.max(0, activeUserIds.size - starts),
          favorites,
          voiceSessions: 0,
          mediaInteractions: 0,
          reports: 0,
          aiCost,
          grossRevenue: 0.0,
        },
        update: {
          views,
          starts,
          messages,
          activeUsers: activeUserIds.size,
          returningUsers: Math.max(0, activeUserIds.size - starts),
          favorites,
          aiCost,
        },
      });

      results.push({
        id: metric.id,
        date: metric.date.toISOString().split('T')[0]!,
        characterId: metric.characterId,
        views: metric.views,
        starts: metric.starts,
        messages: metric.messages,
        activeUsers: metric.activeUsers,
        returningUsers: metric.returningUsers,
        favorites: metric.favorites,
        voiceSessions: metric.voiceSessions,
        mediaInteractions: metric.mediaInteractions,
        reports: metric.reports,
        aiCost: metric.aiCost,
        grossRevenue: metric.grossRevenue,
      });
    }

    return results;
  }

  /**
   * Aggregates creator daily metrics for creator analytics dashboards.
   */
  public static async aggregateCreatorDailyMetrics(targetDate = new Date()): Promise<CreatorDailyMetricItem[]> {
    const dayStart = new Date(targetDate);
    dayStart.setUTCHours(0, 0, 0, 0);

    const creators = await prisma.creatorProfile.findMany({
      select: { id: true, userId: true },
    });

    const results: CreatorDailyMetricItem[] = [];

    for (const creator of creators) {
      const creatorChars = await prisma.character.findMany({
        where: { creatorProfileId: creator.id, status: 'PUBLISHED' },
        select: { id: true },
      });
      const charIds = creatorChars.map(c => c.id);

      const charMetrics = charIds.length > 0
        ? await prisma.characterDailyMetric.findMany({
            where: {
              characterId: { in: charIds },
              date: dayStart,
            },
          })
        : [];

      const totalStarts = charMetrics.reduce((sum, m) => sum + m.starts, 0);
      const activeUsers = charMetrics.reduce((sum, m) => sum + m.activeUsers, 0);
      const returningUsers = charMetrics.reduce((sum, m) => sum + m.returningUsers, 0);

      // Earnings
      const earnings = await prisma.creatorEarningsLedger.findMany({
        where: {
          creatorProfileId: creator.id,
          createdAt: { gte: dayStart },
        },
      });

      const grossEarnings = earnings.reduce((sum, e) => sum + e.grossAmount / 100, 0);
      const creatorNet = earnings.reduce((sum, e) => sum + e.creatorNetAmount / 100, 0);

      const metric = await prisma.creatorDailyMetric.upsert({
        where: {
          creatorProfileId_date: {
            creatorProfileId: creator.id,
            date: dayStart,
          },
        },
        create: {
          creatorProfileId: creator.id,
          date: dayStart,
          publishedCharacters: charIds.length,
          totalStarts,
          activeUsers,
          returningUsers,
          grossEarnings,
          creatorNet,
          reports: 0,
        },
        update: {
          publishedCharacters: charIds.length,
          totalStarts,
          activeUsers,
          returningUsers,
          grossEarnings,
          creatorNet,
        },
      });

      results.push({
        id: metric.id,
        date: metric.date.toISOString().split('T')[0]!,
        creatorProfileId: metric.creatorProfileId,
        publishedCharacters: metric.publishedCharacters,
        totalStarts: metric.totalStarts,
        activeUsers: metric.activeUsers,
        returningUsers: metric.returningUsers,
        grossEarnings: metric.grossEarnings,
        creatorNet: metric.creatorNet,
        reports: metric.reports,
      });
    }

    return results;
  }

  /**
   * Calculates cohort retention matrix (D1, D3, D7, D14, D30) for recent signup cohorts.
   */
  public static async getCohortRetention(daysBack = 14): Promise<CohortRetentionItem[]> {
    const cohorts: CohortRetentionItem[] = [];
    const now = new Date();

    for (let i = daysBack; i >= 1; i--) {
      const cohortDate = new Date(now);
      cohortDate.setUTCDate(cohortDate.getUTCDate() - i);
      cohortDate.setUTCHours(0, 0, 0, 0);

      const nextDay = new Date(cohortDate);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);

      // Users who signed up on cohortDate
      const signupUsers = await prisma.user.findMany({
        where: { createdAt: { gte: cohortDate, lt: nextDay } },
        select: { id: true },
      });

      const cohortSize = signupUsers.length;
      if (cohortSize === 0) {
        cohorts.push({
          cohortDate: cohortDate.toISOString().split('T')[0]!,
          cohortSize: 0,
          d1Rate: 0,
          d3Rate: 0,
          d7Rate: 0,
          d14Rate: 0,
          d30Rate: 0,
        });
        continue;
      }

      const userIds = signupUsers.map(u => u.id);

      // Check return activity on D1, D3, D7
      const checkDays = [1, 3, 7, 14, 30];
      const rates: Record<number, number> = {};

      for (const dayOffset of checkDays) {
        const dStart = new Date(cohortDate);
        dStart.setUTCDate(dStart.getUTCDate() + dayOffset);

        const dEnd = new Date(dStart);
        dEnd.setUTCDate(dEnd.getUTCDate() + 1);

        if (dStart > now) {
          rates[dayOffset] = 0;
          continue;
        }

        const returnedUsers = await prisma.analyticsEvent.findMany({
          where: {
            userId: { in: userIds },
            timestamp: { gte: dStart, lt: dEnd },
          },
          distinct: ['userId'],
          select: { userId: true },
        });

        rates[dayOffset] = Number(((returnedUsers.length / cohortSize) * 100).toFixed(1));
      }

      cohorts.push({
        cohortDate: cohortDate.toISOString().split('T')[0]!,
        cohortSize,
        d1Rate: rates[1] || 0,
        d3Rate: rates[3] || 0,
        d7Rate: rates[7] || 0,
        d14Rate: rates[14] || 0,
        d30Rate: rates[30] || 0,
      });
    }

    return cohorts;
  }

  /**
   * Evaluates the multi-step user onboarding and activation funnel.
   */
  public static async getOnboardingFunnel(days = 30): Promise<OnboardingFunnelStep[]> {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    const steps = [
      { name: 'Welcome Viewed', event: 'welcome_viewed' },
      { name: 'Language Selected', event: 'language_selected' },
      { name: 'Interest Selected', event: 'interest_selected' },
      { name: 'Character Previewed', event: 'character_previewed' },
      { name: 'Character Selected', event: 'character_selected' },
      { name: 'First Chat Started', event: 'first_chat_started' },
      { name: 'First Message Sent', event: 'first_message_sent' },
      { name: 'Activation Completed', event: 'activation_completed' },
    ];

    const results: OnboardingFunnelStep[] = [];
    let topCount = 0;
    let prevCount = 0;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]!;
      const count = await prisma.analyticsEvent.count({
        where: {
          eventName: step.event,
          timestamp: { gte: sinceDate },
        },
      });

      if (i === 0) {
        topCount = count || 1;
        prevCount = count;
      }

      const conversionRate = Number(((count / topCount) * 100).toFixed(1));
      const dropoffRate = Number((prevCount > 0 ? ((prevCount - count) / prevCount) * 100 : 0).toFixed(1));

      results.push({
        stepName: step.name,
        count,
        conversionRate,
        dropoffRate,
      });

      prevCount = count;
    }

    return results;
  }

  /**
   * Evaluates acquisition attribution channels.
   */
  public static async getAttributionSummary(): Promise<AttributionChannelSummary[]> {
    const events = await prisma.analyticsEvent.findMany({
      where: {
        eventName: { in: ['signup_completed', 'activation_completed', 'purchase_completed'] },
      },
      select: {
        eventName: true,
        source: true,
        userId: true,
        properties: true,
      },
    });

    const channelMap: Record<
      string,
      { signups: Set<string>; activated: Set<string>; paying: Set<string>; grossRevenue: number }
    > = {
      organic: { signups: new Set(), activated: new Set(), paying: new Set(), grossRevenue: 0 },
      referral: { signups: new Set(), activated: new Set(), paying: new Set(), grossRevenue: 0 },
      creator_link: { signups: new Set(), activated: new Set(), paying: new Set(), grossRevenue: 0 },
      campaign: { signups: new Set(), activated: new Set(), paying: new Set(), grossRevenue: 0 },
      search: { signups: new Set(), activated: new Set(), paying: new Set(), grossRevenue: 0 },
    };

    for (const evt of events) {
      const channel = evt.source || 'organic';
      if (!channelMap[channel]) {
        channelMap[channel] = { signups: new Set(), activated: new Set(), paying: new Set(), grossRevenue: 0 };
      }

      if (evt.userId) {
        if (evt.eventName === 'signup_completed') channelMap[channel]!.signups.add(evt.userId);
        if (evt.eventName === 'activation_completed') channelMap[channel]!.activated.add(evt.userId);
        if (evt.eventName === 'purchase_completed') {
          channelMap[channel]!.paying.add(evt.userId);
          const amt = Number((evt.properties as any)?.amount || 0);
          channelMap[channel]!.grossRevenue += amt;
        }
      }
    }

    return Object.keys(channelMap).map(ch => {
      const data = channelMap[ch]!;
      const signupCount = data.signups.size || 1;
      return {
        source: ch,
        signups: data.signups.size,
        activated: data.activated.size,
        activationRate: Number(((data.activated.size / signupCount) * 100).toFixed(1)),
        payingUsers: data.paying.size,
        grossRevenue: Number(data.grossRevenue.toFixed(2)),
      };
    });
  }
}
