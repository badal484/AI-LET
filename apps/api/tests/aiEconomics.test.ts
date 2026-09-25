import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { AIEconomicsService } from '../src/modules/analytics/services/AIEconomicsService.js';
import { randomUUID } from 'crypto';

describe('AIEconomicsService Tests', () => {
  beforeEach(async () => {
    await prisma.aIUsageEvent.deleteMany();
    await prisma.aIModelPricing.deleteMany();
  });

  it('calculates estimated cost accurately using default pricing rates', async () => {
    // gpt-4o: $2.50/M input, $10.00/M output, $1.25/M cached
    // 10,000 input tokens = 0.025
    // 2,000 output tokens = 0.020
    // Total = 0.045
    const cost = await AIEconomicsService.calculateEstimatedCost('openai', 'gpt-4o', 10000, 2000, 0);
    expect(cost).toBe(0.045);

    // gpt-4o-mini: $0.15/M input, $0.60/M output
    // 100,000 input = 0.015, 10,000 output = 0.006 => 0.021
    const costMini = await AIEconomicsService.calculateEstimatedCost('openai', 'gpt-4o-mini', 100000, 10000, 0);
    expect(costMini).toBe(0.021);
  });

  it('respects cached tokens with discount rate in cost calculation', async () => {
    // claude-3-5-sonnet: $3.00/M input, $15.00/M output, $0.30/M cached
    // 100,000 input tokens of which 80,000 are cached:
    // Non-cached: 20,000 * $3.00 / 1M = $0.00006
    // Cached: 80,000 * $0.30 / 1M = $0.000024
    // Output: 5,000 * $15.00 / 1M = $0.000075
    // Total = 0.06 + 0.024 + 0.075 = 0.159
    const cost = await AIEconomicsService.calculateEstimatedCost('anthropic', 'claude-3-5-sonnet', 100000, 5000, 80000);
    expect(cost).toBe(0.159);
  });

  it('allows overriding model pricing dynamically in the database', async () => {
    await AIEconomicsService.setPricingRate({
      provider: 'custom_ai',
      model: 'custom-ultra',
      inputPricePerMillion: 1.0,
      outputPricePerMillion: 2.0,
      cachedInputPricePerMillion: 0.5,
    });

    // 1,000,000 input + 1,000,000 output => $1.00 + $2.00 = $3.00
    const cost = await AIEconomicsService.calculateEstimatedCost('custom_ai', 'custom-ultra', 1000000, 1000000, 0);
    expect(cost).toBe(3.0);
  });

  it('records AI usage into the request ledger and computes unit economics', async () => {
    const userId1 = randomUUID();
    const userId2 = randomUUID();
    const convId1 = randomUUID();

    await AIEconomicsService.recordUsage({
      requestId: randomUUID(),
      provider: 'openai',
      model: 'gpt-4o',
      task: 'CHAT_RESPONSE',
      userId: userId1,
      conversationId: convId1,
      inputTokens: 1000,
      outputTokens: 500,
      cachedTokens: 0,
      latencyMs: 800,
      status: 'SUCCESS',
    });

    await AIEconomicsService.recordUsage({
      requestId: randomUUID(),
      provider: 'openai',
      model: 'gpt-4o-mini',
      task: 'MEMORY_EXTRACTION',
      userId: userId2,
      inputTokens: 2000,
      outputTokens: 200,
      cachedTokens: 0,
      latencyMs: 300,
      status: 'SUCCESS',
    });

    const economics = await AIEconomicsService.getUnitEconomics(30);

    expect(economics.totalRequests).toBe(2);
    expect(economics.totalInputTokens).toBe(3000);
    expect(economics.totalOutputTokens).toBe(700);
    expect(economics.totalEstimatedCost).toBeGreaterThan(0);
    expect(economics.costByProvider['openai']).toBeGreaterThan(0);
    expect(economics.costByTask['CHAT_RESPONSE']).toBeGreaterThan(0);
    expect(economics.costByTask['MEMORY_EXTRACTION']).toBeGreaterThan(0);
  });

  it('detects high-cost or high-latency request anomalies in ledger', async () => {
    // Record an anomalous event with 25,000 tokens and 20,000ms latency
    const anomalyReqId = randomUUID();
    await AIEconomicsService.recordUsage({
      requestId: anomalyReqId,
      provider: 'anthropic',
      model: 'claude-3-opus',
      task: 'EXTENDED_REASONING',
      inputTokens: 20000,
      outputTokens: 5000,
      latencyMs: 18000,
      status: 'SUCCESS',
    });

    const economics = await AIEconomicsService.getUnitEconomics(30);
    expect(economics.recentAnomalies.length).toBeGreaterThan(0);
    expect(economics.recentAnomalies.some(a => a.requestId === anomalyReqId)).toBe(true);
  });
});
