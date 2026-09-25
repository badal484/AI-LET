import { prisma } from '../../../infrastructure/database/prisma.js';
import {
  AIPlaygroundRequest,
  AIPlaygroundResult,
  ProductionReplayRequest,
  ProductionReplayResult,
} from '@ai-companion/types';
import { ModelRegistryService } from '../routing/ModelRegistry.service.js';
import { ContextBudgetManager } from '../context/ContextBudgetManager.js';
import { AIGateway } from '../gateway/AIGateway.js';
import { ResponseValidator } from '../validation/ResponseValidator.js';
import { CostEstimator } from '../telemetry/CostEstimator.js';

export class AIPlaygroundService {
  private static instance: AIPlaygroundService;
  private modelRegistry = ModelRegistryService.getInstance();
  private contextManager = ContextBudgetManager.getInstance();
  private gateway = AIGateway.getInstance();

  private constructor() {}

  public static getInstance(): AIPlaygroundService {
    if (!AIPlaygroundService.instance) {
      AIPlaygroundService.instance = new AIPlaygroundService();
    }
    return AIPlaygroundService.instance;
  }

  public async runPlayground(req: AIPlaygroundRequest): Promise<AIPlaygroundResult> {
    const startTime = Date.now();

    const model = await this.modelRegistry.getModelById(req.modelId);
    if (!model) {
      throw new Error(`Model ${req.modelId} not found`);
    }

    // Resolve prompt
    let systemPromptText = 'You are a supportive and empathetic AI companion.';
    if (req.promptVersionId) {
      const pVersion = await prisma.aIPromptVersion.findUnique({
        where: { id: req.promptVersionId },
      });
      if (pVersion) {
        systemPromptText = pVersion.templateContent;
      }
    }

    const userMsg = req.userMessage || 'Hello';

    // Build context sections
    const sections = {
      systemSafety: ['Safety Policy: Always prioritize user emotional well-being.'],
      runtimeConstraints: ['Language: Match user preferred tone and script.'],
      currentUserMessage: userMsg,
      characterIdentity: [systemPromptText],
      currentConversation: [],
      relevantMemories: req.mockContext?.memories || [],
      relationshipContext: req.mockContext?.relationship ? [JSON.stringify(req.mockContext.relationship)] : [],
      optionalHistory: [],
    };

    const budgetBreakdown = this.contextManager.calculateBudget(sections, model.contextWindow, req.maxTokens || 1024);
    const contextHashData = this.contextManager.computeContextHash(sections, model.id);

    const gatewayRes = await this.gateway.generate(
      {
        model: model.modelName,
        systemPrompt: systemPromptText,
        messages: [{ role: 'user', content: userMsg }],
        temperature: req.temperature ?? 0.7,
        maxTokens: req.maxTokens ?? 1024,
      },
      model.provider
    );

    const validation = ResponseValidator.validate(gatewayRes.content, {
      maxLength: 4000,
      enforceCharacterRole: true,
    });

    const latencyMs = Date.now() - startTime;
    const estimatedCostUsd = CostEstimator.calculateCost(
      gatewayRes.usage.promptTokens,
      gatewayRes.usage.completionTokens,
      model
    );

    return {
      outputContent: validation.sanitizedContent,
      modelUsed: model.modelName,
      providerUsed: model.provider,
      latencyMs,
      promptTokens: gatewayRes.usage.promptTokens,
      completionTokens: gatewayRes.usage.completionTokens,
      totalTokens: gatewayRes.usage.totalTokens,
      estimatedCostUsd,
      contextHash: contextHashData.hash,
      validation,
      budgetBreakdown,
    };
  }

  public async replayGeneration(req: ProductionReplayRequest): Promise<ProductionReplayResult> {
    const lookupId = req.generationTraceId || req.traceId || '';
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lookupId);
    const trace = await prisma.aIGenerationTrace.findFirst({
      where: isUuid
        ? { OR: [{ id: lookupId }, { requestId: lookupId }] }
        : { requestId: lookupId },
    });

    if (!trace) {
      throw new Error(`Generation trace '${lookupId}' not found`);
    }

    const model = trace.modelId ? await this.modelRegistry.getModelById(trace.modelId) : null;
    const modelName = model?.modelName || 'mock-fast-v1';
    const provider = model?.provider || 'mock';

    const startTime = Date.now();
    const replayRes = await this.gateway.generate(
      {
        model: modelName,
        // The original prompt is not retained (privacy), so this is a probe against the same
        // model/provider — useful for availability/latency, not for reproducing the output.
        messages: [{ role: 'user', content: 'Replay request validation' }],
        temperature: 0.7,
        maxTokens: 512,
      },
      provider
    );
    const latencyMs = Date.now() - startTime;

    return {
      traceId: trace.id,
      requestId: trace.requestId,
      originalMetadata: {
        modelId: trace.modelId || undefined,
        provider: trace.provider,
        workload: trace.workload,
        latencyMs: trace.latencyMs,
        totalTokens: trace.totalTokens,
        estimatedCostUsd: trace.costUsd,
        contextHash: trace.contextHash || undefined,
      },
      replayOutput: replayRes.content,
      replayLatencyMs: latencyMs,
      matchAssessment: {
        isReproducible: false,
        divergenceNotes:
          'Original prompt content is not retained, so the generation cannot be reproduced. A probe was re-run against the same model/provider to check availability and latency; its output is not comparable to the original.',
      },
    };
  }
}
