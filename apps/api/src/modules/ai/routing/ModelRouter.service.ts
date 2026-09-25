import { prisma } from '../../../infrastructure/database/prisma.js';
import {
  AIWorkloadType,
  AIModelCapability,
  AILatencyClass,
  AIQualityClass,
  AIRouteSelectionResult,
  AIModelData,
  AIGenerateRequest,
  AIGenerateResponse,
  AIStreamEvent,
} from '@ai-companion/types';
import { ModelRegistryService } from './ModelRegistry.service.js';
import { CircuitBreakerService } from './CircuitBreaker.service.js';
import { AIGateway, AIGatewayError } from '../gateway/AIGateway.js';
import { logger } from '../../../shared/utils/logger.js';

export interface RouteSelectionOptions {
  requiredCapabilities?: AIModelCapability[];
  latencyTarget?: AILatencyClass;
  qualityTarget?: AIQualityClass;
  contextSize?: number;
  maxCost?: number;
  characterPreferredModelId?: string;
  forceModelId?: string;
}

export class ModelRouterService {
  private static instance: ModelRouterService;
  private registry = ModelRegistryService.getInstance();
  private circuitBreaker = CircuitBreakerService.getInstance();
  private gateway = AIGateway.getInstance();

  private constructor() {}

  public static getInstance(): ModelRouterService {
    if (!ModelRouterService.instance) {
      ModelRouterService.instance = new ModelRouterService();
    }
    return ModelRouterService.instance;
  }

  public async selectRoute(
    workload: AIWorkloadType,
    options: RouteSelectionOptions = {}
  ): Promise<AIRouteSelectionResult> {
    const allModels = await this.registry.getActiveModels();
    if (allModels.length === 0) {
      throw new Error('No active AI models registered in system');
    }

    // 1. If explicit forced model requested
    if (options.forceModelId) {
      const forced = allModels.find((m) => m.id === options.forceModelId);
      if (forced) {
        return {
          primaryModel: forced,
          fallbackModels: allModels.filter((m) => m.id !== forced.id),
          workload,
          routingPolicyVersion: 'forced-override',
          reason: 'Explicitly forced model requested by caller',
          model: forced,
          provider: forced.provider,
          isFallback: false,
        };
      }
    }

    // 2. Fetch routing policy from DB
    const policy = await prisma.aIRoutingPolicy.findFirst({
      where: { workload, isEnabled: true },
      include: { preferredModel: true },
    });

    let primary: AIModelData | undefined;
    const fallbackList: AIModelData[] = [];

    if (policy) {
      const prefModel = allModels.find((m) => m.id === policy.preferredModelId);
      if (prefModel) {
        primary = prefModel;
      }
      for (const fId of policy.fallbackModelIds) {
        const fModel = allModels.find((m) => m.id === fId);
        if (fModel) fallbackList.push(fModel);
      }
    }

    // If character preferred model is set, give it priority if available
    if (options.characterPreferredModelId) {
      const charModel = allModels.find((m) => m.id === options.characterPreferredModelId);
      if (charModel) {
        if (primary && primary.id !== charModel.id) {
          fallbackList.unshift(primary);
        }
        primary = charModel;
      }
    }

    // Default primary selection if not established by policy
    const effectivePrimary: AIModelData =
      primary ?? this.findBestModelForWorkload(workload, allModels, options);

    // Populate fallbacks if empty
    if (fallbackList.length === 0) {
      const remaining = allModels.filter((m) => m.id !== effectivePrimary.id);
      fallbackList.push(...remaining);
    }

    // Check circuit breaker status on primary
    const primaryBreaker = await this.circuitBreaker.getStatus(
      effectivePrimary.provider,
      effectivePrimary.modelName
    );
    let selectedPrimary = effectivePrimary;
    let reason = `Selected via policy for workload ${workload}`;

    if (primaryBreaker === 'OPEN') {
      // Primary circuit breaker is tripped; promote first healthy fallback
      for (let i = 0; i < fallbackList.length; i++) {
        const candidate = fallbackList[i];
        if (!candidate) continue;
        const status = await this.circuitBreaker.getStatus(candidate.provider, candidate.modelName);
        if (status !== 'OPEN') {
          selectedPrimary = candidate;
          fallbackList.splice(i, 1);
          fallbackList.push(effectivePrimary);
          reason = `Primary model ${effectivePrimary.displayName} circuit OPEN; rerouted to ${candidate.displayName}`;
          break;
        }
      }
    }

    return {
      primaryModel: selectedPrimary,
      fallbackModels: fallbackList,
      workload,
      routingPolicyVersion: policy?.id || 'default-heuristic-v1',
      reason,
      model: selectedPrimary,
      provider: selectedPrimary.provider,
      isFallback: selectedPrimary.id !== effectivePrimary.id,
    };
  }

  public async executeWithFallback(
    workload: AIWorkloadType,
    requestBuilder: (model: AIModelData) => AIGenerateRequest,
    options: RouteSelectionOptions = {}
  ): Promise<AIGenerateResponse> {
    const route = await this.selectRoute(workload, options);
    const candidateChain = [route.primaryModel, ...route.fallbackModels];

    let lastError: Error | null = null;
    const maxAttempts = Math.min(3, candidateChain.length);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const currentModel = candidateChain[attempt];
      if (!currentModel) continue;
      const request = requestBuilder(currentModel);
      request.model = currentModel.modelName;

      try {
        const response = await this.gateway.generate(request, currentModel.provider);
        await this.circuitBreaker.recordSuccess(currentModel.provider, currentModel.modelName);
        return response;
      } catch (err: any) {
        lastError = err;
        logger.warn(
          `AI generation attempt failed on ${currentModel.provider}/${currentModel.modelName} (attempt ${attempt + 1}): ${err.message}`
        );

        await this.circuitBreaker.recordFailure(currentModel.provider, currentModel.modelName);

        // Do not retry on non-recoverable bad request errors
        if (err instanceof AIGatewayError && err.failureType === 'bad_request') {
          throw err;
        }
      }
    }

    throw lastError || new Error(`AI generation failed for workload ${workload} after ${maxAttempts} attempts`);
  }

  public async *streamWithFallback(
    workload: AIWorkloadType,
    requestBuilder: (model: AIModelData) => AIGenerateRequest,
    options: RouteSelectionOptions = {}
  ): AsyncIterable<AIStreamEvent> {
    const route = await this.selectRoute(workload, options);
    const candidateChain = [route.primaryModel, ...route.fallbackModels];

    const primary = candidateChain[0] || route.primaryModel;
    const request = requestBuilder(primary);
    request.model = primary.modelName;

    try {
      for await (const evt of this.gateway.stream(request, primary.provider)) {
        if (evt.type === 'completed') {
          await this.circuitBreaker.recordSuccess(primary.provider, primary.modelName);
        }
        if (evt.type === 'failed') {
          await this.circuitBreaker.recordFailure(primary.provider, primary.modelName);
        }
        yield evt;
      }
    } catch (err: any) {
      if (primary) {
        await this.circuitBreaker.recordFailure(primary.provider, primary.modelName);
      }
      yield {
        type: 'failed',
        id: `err_stream_${Date.now()}`,
        error: err.message || 'Stream generation failed',
        timestamp: Date.now(),
      };
    }
  }

  private findBestModelForWorkload(
    workload: AIWorkloadType,
    models: AIModelData[],
    options: RouteSelectionOptions
  ): AIModelData {
    let filtered = models;

    // Filter by required capability
    if (options.requiredCapabilities && options.requiredCapabilities.length > 0) {
      filtered = filtered.filter((m) =>
        options.requiredCapabilities!.every((cap) => m.capabilities.includes(cap))
      );
    }

    if (filtered.length === 0) filtered = models;

    const defaultModel = models[0]!;

    // Workload-specific heuristics
    switch (workload) {
      case 'EMBEDDING':
        return filtered.find((m) => m.capabilities.includes('embeddings')) || defaultModel;

      case 'MEMORY_EXTRACTION':
      case 'RELATIONSHIP_ANALYSIS':
      case 'PROACTIVE_DECISION':
        return (
          filtered.find((m) => m.latencyClass === 'fast' && m.capabilities.includes('structured_output')) ||
          filtered.find((m) => m.latencyClass === 'fast') ||
          defaultModel
        );

      case 'EVALUATION':
        return (
          filtered.find((m) => m.qualityClass === 'flagship' || m.qualityClass === 'advanced') ||
          filtered.find((m) => m.latencyClass === 'quality') ||
          defaultModel
        );

      case 'CONVERSATION':
      case 'PROACTIVE_GENERATION':
      default:
        if (options.qualityTarget === 'flagship') {
          return filtered.find((m) => m.qualityClass === 'flagship') || defaultModel;
        }
        return (
          filtered.find((m) => m.isDefault) ||
          filtered.find((m) => m.latencyClass === 'balanced') ||
          defaultModel
        );
    }
  }
}
