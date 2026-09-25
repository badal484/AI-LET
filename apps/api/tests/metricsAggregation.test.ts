import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { MetricsAggregationService } from '../src/modules/analytics/services/MetricsAggregationService.js';
import { randomUUID } from 'crypto';

describe('MetricsAggregationService Tests', () => {
  beforeEach(async () => {
    await prisma.creatorDailyMetric.deleteMany();
    await prisma.characterDailyMetric.deleteMany();
    await prisma.productDailyMetric.deleteMany();
    await prisma.analyticsEvent.deleteMany();
    await prisma.aIUsageEvent.deleteMany();
    await prisma.purchaseTransaction.deleteMany();
  });

  it('aggregates platform product daily metrics correctly', async () => {
    const today = new Date();

    const u1 = await prisma.user.create({
      data: {
        email: `u1_${Date.now()}@example.com`,
        normalizedEmail: `u1_${Date.now()}@example.com`,
        passwordHash: 'dummyhash123',
      },
    });
    const u2 = await prisma.user.create({
      data: {
        email: `u2_${Date.now()}@example.com`,
        normalizedEmail: `u2_${Date.now()}@example.com`,
        passwordHash: 'dummyhash123',
      },
    });

    const user1 = u1.id;
    const user2 = u2.id;

    // Ingest events for today
    await prisma.analyticsEvent.createMany({
      data: [
        { id: randomUUID(), eventName: 'session_started', userId: user1, timestamp: today },
        { id: randomUUID(), eventName: 'session_started', userId: user2, timestamp: today },
        { id: randomUUID(), eventName: 'activation_completed', userId: user1, timestamp: today },
      ],
    });

    // Seed transaction
    await prisma.purchaseTransaction.create({
      data: {
        id: randomUUID(),
        userId: user1,
        provider: 'STRIPE',
        providerTransactionId: `stripe_tx_${Date.now()}`,
        productId: 'credits_pack_standard',
        currency: 'USD',
        amountMinorUnits: 1999, // $19.99
        status: 'SUCCEEDED',
        createdAt: today,
      },
    });

    // Seed AI usage
    await prisma.aIUsageEvent.create({
      data: {
        requestId: randomUUID(),
        provider: 'openai',
        model: 'gpt-4o',
        task: 'CHAT_RESPONSE',
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
        estimatedCost: 0.05,
        currency: 'USD',
        status: 'SUCCESS',
        createdAt: today,
      },
    });

    const dailyMetric = await MetricsAggregationService.aggregateProductDailyMetrics(today);

    expect(dailyMetric.dau).toBe(2);
    expect(dailyMetric.activatedUsers).toBe(1);
    expect(dailyMetric.revenue).toBe(19.99);
    expect(dailyMetric.aiCost).toBe(0.05);
    expect(dailyMetric.grossMargin).toBe(19.94);
  });

  it('calculates onboarding funnel steps with conversion and drop-off rates', async () => {
    const now = new Date();

    // 100 welcome viewed
    const welcomeEvents = Array.from({ length: 100 }, () => ({
      id: randomUUID(),
      eventName: 'welcome_viewed',
      timestamp: now,
    }));

    // 80 character previewed
    const charPreviewEvents = Array.from({ length: 80 }, () => ({
      id: randomUUID(),
      eventName: 'character_previewed',
      timestamp: now,
    }));

    // 50 first chat started
    const firstChatEvents = Array.from({ length: 50 }, () => ({
      id: randomUUID(),
      eventName: 'first_chat_started',
      timestamp: now,
    }));

    // 40 activation completed
    const activationEvents = Array.from({ length: 40 }, () => ({
      id: randomUUID(),
      eventName: 'activation_completed',
      timestamp: now,
    }));

    await prisma.analyticsEvent.createMany({
      data: [...welcomeEvents, ...charPreviewEvents, ...firstChatEvents, ...activationEvents],
    });

    const funnel = await MetricsAggregationService.getOnboardingFunnel(30);

    const welcomeStep = funnel.find(f => f.stepName === 'Welcome Viewed');
    const previewStep = funnel.find(f => f.stepName === 'Character Previewed');
    const chatStep = funnel.find(f => f.stepName === 'First Chat Started');
    const actStep = funnel.find(f => f.stepName === 'Activation Completed');

    expect(welcomeStep?.count).toBe(100);
    expect(welcomeStep?.conversionRate).toBe(100);

    expect(previewStep?.count).toBe(80);
    expect(previewStep?.conversionRate).toBe(80);

    expect(chatStep?.count).toBe(50);
    expect(chatStep?.conversionRate).toBe(50);

    expect(actStep?.count).toBe(40);
    expect(actStep?.conversionRate).toBe(40);
  });

  it('calculates acquisition attribution channels', async () => {
    const userA = randomUUID();
    const userB = randomUUID();

    await prisma.analyticsEvent.createMany({
      data: [
        { id: randomUUID(), eventName: 'signup_completed', source: 'referral', userId: userA },
        { id: randomUUID(), eventName: 'activation_completed', source: 'referral', userId: userA },
        { id: randomUUID(), eventName: 'purchase_completed', source: 'referral', userId: userA, properties: { amount: 29.99 } },
        { id: randomUUID(), eventName: 'signup_completed', source: 'organic', userId: userB },
      ],
    });

    const attribution = await MetricsAggregationService.getAttributionSummary();
    const referral = attribution.find(a => a.source === 'referral');
    const organic = attribution.find(a => a.source === 'organic');

    expect(referral?.signups).toBe(1);
    expect(referral?.activated).toBe(1);
    expect(referral?.payingUsers).toBe(1);
    expect(referral?.grossRevenue).toBe(29.99);

    expect(organic?.signups).toBe(1);
    expect(organic?.payingUsers).toBe(0);
  });
});
