import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../config/logger.js';
import type {
  AIUsageRecordInput,
  AIModelPricingItem,
  AIModelPricingCreateInput,
  AIUnitEconomicsSummary,
} from '@ai-companion/types';

// Built-in fallback price rates per 1,000,000 tokens (USD)
const DEFAULT_MODEL_PRICING: Record<
  string,
  { inputPerMillion: number; outputPerMillion: number; cachedPerMillion: number }
> = {
  // OpenAI
  'gpt-4o': { inputPerMillion: 2.5, outputPerMillion: 10.0, cachedPerMillion: 1.25 },
  'gpt-4o-mini': { inputPerMillion: 0.15, outputPerMillion: 0.6, cachedPerMillion: 0.075 },
  'gpt-4-turbo': { inputPerMillion: 10.0, outputPerMillion: 30.0, cachedPerMillion: 5.0 },
  'text-embedding-3-small': { inputPerMillion: 0.02, outputPerMillion: 0.0, cachedPerMillion: 0.0 },
  'text-embedding-3-large': { inputPerMillion: 0.13, outputPerMillion: 0.0, cachedPerMillion: 0.0 },
  // Anthropic
  'claude-3-5-sonnet': { inputPerMillion: 3.0, outputPerMillion: 15.0, cachedPerMillion: 0.3 },
  'claude-3-haiku': { inputPerMillion: 0.25, outputPerMillion: 1.25, cachedPerMillion: 0.025 },
  'claude-3-opus': { inputPerMillion: 15.0, outputPerMillion: 75.0, cachedPerMillion: 1.5 },
  // Google
  'gemini-1.5-pro': { inputPerMillion: 1.25, outputPerMillion: 5.0, cachedPerMillion: 0.3 },
  'gemini-1.5-flash': { inputPerMillion: 0.075, outputPerMillion: 0.3, cachedPerMillion: 0.01875 },
  'gemini-2.0-flash': { inputPerMillion: 0.1, outputPerMillion: 0.4, cachedPerMillion: 0.025 },
  // Voice & Media
  'whisper-1': { inputPerMillion: 0.006, outputPerMillion: 0.0, cachedPerMillion: 0.0 }, // per second approx
  'eleven-labs-turbo-v2': { inputPerMillion: 0.15, outputPerMillion: 0.0, cachedPerMillion: 0.0 }, // per 1k characters
};

export class AIEconomicsService {
  /**
   * Calculates estimated cost in USD based on configured or default pricing.
   */
  public static async calculateEstimatedCost(
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    cachedTokens = 0,
  ): Promise<number> {
    const now = new Date();
    // Try to find configured pricing from DB
    const pricing = await prisma.aIModelPricing.findFirst({
      where: {
        provider,
        model,
        effectiveFrom: { lte: now },
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    let inputRate = 0.5; // default fallback $0.50 / M
    let outputRate = 1.5; // default fallback $1.50 / M
    let cachedRate = 0.25;

    if (pricing) {
      inputRate = pricing.inputPricePerMillion;
      outputRate = pricing.outputPricePerMillion;
      cachedRate = pricing.cachedInputPricePerMillion;
    } else {
      // Check built-in fallback lookup
      const defaultRate = DEFAULT_MODEL_PRICING[model.toLowerCase()] ||
        DEFAULT_MODEL_PRICING[model.split('/')[1]?.toLowerCase() || ''];
      if (defaultRate) {
        inputRate = defaultRate.inputPerMillion;
        outputRate = defaultRate.outputPerMillion;
        cachedRate = defaultRate.cachedPerMillion;
      }
    }

    const nonCachedInput = Math.max(0, inputTokens - cachedTokens);
    const inputCost = (nonCachedInput / 1_000_000) * inputRate;
    const cachedCost = (cachedTokens / 1_000_000) * cachedRate;
    const outputCost = (outputTokens / 1_000_000) * outputRate;

    return Number((inputCost + cachedCost + outputCost).toFixed(6));
  }

  /**
   * Records an AI request into the AI request ledger.
   */
  public static async recordUsage(params: AIUsageRecordInput): Promise<void> {
    try {
      const totalTokens = params.inputTokens + params.outputTokens;
      const estimatedCost = await this.calculateEstimatedCost(
        params.provider,
        params.model,
        params.inputTokens,
        params.outputTokens,
        params.cachedTokens || 0,
      );

      await prisma.aIUsageEvent.create({
        data: {
          requestId: params.requestId,
          provider: params.provider,
          model: params.model,
          task: params.task,
          userId: params.userId || null,
          characterId: params.characterId || null,
          conversationId: params.conversationId || null,
          inputTokens: params.inputTokens,
          outputTokens: params.outputTokens,
          cachedTokens: params.cachedTokens || 0,
          totalTokens,
          estimatedCost,
          currency: 'USD',
          latencyMs: params.latencyMs || 0,
          status: params.status || 'SUCCESS',
          breakdown: (params.breakdown as any) || null,
        },
      });
    } catch (err) {
      logger.error('Failed to record AI usage in ledger', { err, requestId: params.requestId });
    }
  }

  /**
   * Calculates comprehensive AI unit economics across all models, providers, and characters.
   */
  public static async getUnitEconomics(timeframeDays = 30): Promise<AIUnitEconomicsSummary> {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - timeframeDays);

    const usageEvents = await prisma.aIUsageEvent.findMany({
      where: { createdAt: { gte: sinceDate } },
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });

    let totalRequests = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCachedTokens = 0;
    let totalEstimatedCost = 0;

    const uniqueUsers = new Set<string>();
    const uniqueConversations = new Set<string>();

    const costByProvider: Record<string, number> = {};
    const costByModel: Record<string, number> = {};
    const costByTask: Record<string, number> = {};
    const characterCostMap: Record<string, { totalCost: number; totalTokens: number; requestCount: number }> = {};
    const anomalies: Array<{
      requestId: string;
      model: string;
      tokens: number;
      cost: number;
      reason: string;
      createdAt: string;
    }> = [];

    for (const evt of usageEvents) {
      totalRequests++;
      totalInputTokens += evt.inputTokens;
      totalOutputTokens += evt.outputTokens;
      totalCachedTokens += evt.cachedTokens;
      totalEstimatedCost += evt.estimatedCost;

      if (evt.userId) uniqueUsers.add(evt.userId);
      if (evt.conversationId) uniqueConversations.add(evt.conversationId);

      costByProvider[evt.provider] = (costByProvider[evt.provider] || 0) + evt.estimatedCost;
      costByModel[evt.model] = (costByModel[evt.model] || 0) + evt.estimatedCost;
      costByTask[evt.task] = (costByTask[evt.task] || 0) + evt.estimatedCost;

      if (evt.characterId) {
        if (!characterCostMap[evt.characterId]) {
          characterCostMap[evt.characterId] = { totalCost: 0, totalTokens: 0, requestCount: 0 };
        }
        characterCostMap[evt.characterId]!.totalCost += evt.estimatedCost;
        characterCostMap[evt.characterId]!.totalTokens += evt.totalTokens;
        characterCostMap[evt.characterId]!.requestCount++;
      }

      // Check anomaly: very large tokens or high cost
      if (evt.totalTokens > 16000 || evt.estimatedCost > 0.15 || evt.latencyMs > 15000) {
        if (anomalies.length < 15) {
          anomalies.push({
            requestId: evt.requestId,
            model: evt.model,
            tokens: evt.totalTokens,
            cost: evt.estimatedCost,
            reason: evt.totalTokens > 16000
              ? 'Large context/token spike'
              : evt.latencyMs > 15000
                ? 'High generation latency'
                : 'High request cost',
            createdAt: evt.createdAt.toISOString(),
          });
        }
      }
    }

    // Top characters by cost resolution
    const characterIds = Object.keys(characterCostMap);
    const characters = characterIds.length > 0
      ? await prisma.character.findMany({
          where: { id: { in: characterIds } },
          select: { id: true, name: true },
        })
      : [];
    const charNameMap = new Map(characters.map(c => [c.id, c.name]));

    const topCharactersByCost = characterIds
      .map(id => ({
        characterId: id,
        name: charNameMap.get(id) || 'Unknown Character',
        totalCost: Number(characterCostMap[id]!.totalCost.toFixed(4)),
        totalTokens: characterCostMap[id]!.totalTokens,
        requestCount: characterCostMap[id]!.requestCount,
      }))
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 10);

    const costPerUser = uniqueUsers.size > 0 ? totalEstimatedCost / uniqueUsers.size : 0;
    const costPerConversation = uniqueConversations.size > 0 ? totalEstimatedCost / uniqueConversations.size : 0;
    const costPerMessage = totalRequests > 0 ? totalEstimatedCost / totalRequests : 0;

    return {
      totalRequests,
      totalInputTokens,
      totalOutputTokens,
      totalCachedTokens,
      totalEstimatedCost: Number(totalEstimatedCost.toFixed(4)),
      costPerUser: Number(costPerUser.toFixed(4)),
      costPerConversation: Number(costPerConversation.toFixed(4)),
      costPerMessage: Number(costPerMessage.toFixed(4)),
      costByProvider,
      costByModel,
      costByTask,
      topCharactersByCost,
      recentAnomalies: anomalies,
    };
  }

  /**
   * Sets custom model pricing.
   */
  public static async setPricingRate(input: AIModelPricingCreateInput): Promise<AIModelPricingItem> {
    const created = await prisma.aIModelPricing.create({
      data: {
        provider: input.provider,
        model: input.model,
        inputPricePerMillion: input.inputPricePerMillion,
        outputPricePerMillion: input.outputPricePerMillion,
        cachedInputPricePerMillion: input.cachedInputPricePerMillion || 0.0,
        currency: input.currency || 'USD',
      },
    });

    return {
      id: created.id,
      provider: created.provider,
      model: created.model,
      inputPricePerMillion: created.inputPricePerMillion,
      outputPricePerMillion: created.outputPricePerMillion,
      cachedInputPricePerMillion: created.cachedInputPricePerMillion,
      currency: created.currency,
      effectiveFrom: created.effectiveFrom.toISOString(),
      effectiveUntil: created.effectiveUntil?.toISOString() || null,
    };
  }

  /**
   * Lists all configured pricing entries.
   */
  public static async listPricingRates(): Promise<AIModelPricingItem[]> {
    const list = await prisma.aIModelPricing.findMany({
      orderBy: [{ provider: 'asc' }, { model: 'asc' }, { effectiveFrom: 'desc' }],
    });

    return list.map(p => ({
      id: p.id,
      provider: p.provider,
      model: p.model,
      inputPricePerMillion: p.inputPricePerMillion,
      outputPricePerMillion: p.outputPricePerMillion,
      cachedInputPricePerMillion: p.cachedInputPricePerMillion,
      currency: p.currency,
      effectiveFrom: p.effectiveFrom.toISOString(),
      effectiveUntil: p.effectiveUntil?.toISOString() || null,
    }));
  }
}
