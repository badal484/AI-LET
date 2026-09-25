import { prisma } from '../../../infrastructure/database/prisma.js';
import { redisClient } from '../../../infrastructure/redis/redisClient.js';
import { AIModelData, AIProviderName, AILatencyClass, AIQualityClass } from '@ai-companion/types';
import { logger } from '../../../shared/utils/logger.js';

const MODEL_REGISTRY_CACHE_KEY = 'ai:models:active';
const CACHE_TTL_SECONDS = 300; // 5 minutes

export class ModelRegistryService {
  private static instance: ModelRegistryService;

  private constructor() {}

  public static getInstance(): ModelRegistryService {
    if (!ModelRegistryService.instance) {
      ModelRegistryService.instance = new ModelRegistryService();
    }
    return ModelRegistryService.instance;
  }

  public async getActiveModels(): Promise<AIModelData[]> {
    try {
      if (redisClient?.isOpen) {
        const cached = await redisClient.get(MODEL_REGISTRY_CACHE_KEY);
        if (cached) {
          return JSON.parse(cached) as AIModelData[];
        }
      }
    } catch (err) {
      logger.warn(`Failed to read active models from Redis cache: ${err}`);
    }

    let models = await prisma.aIModel.findMany({
      where: { isEnabled: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });

    if (models.length === 0) {
      await this.seedDefaultModels();
      models = await prisma.aIModel.findMany({
        where: { isEnabled: true },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      });
    }

    const result: AIModelData[] = models.map((m) => ({
      id: m.id,
      provider: m.provider as AIProviderName,
      modelName: m.modelName,
      displayName: m.displayName,
      capabilities: m.capabilities as any,
      contextWindow: m.contextWindow,
      inputCostPer1k: m.inputCostPer1k,
      outputCostPer1k: m.outputCostPer1k,
      latencyClass: m.latencyClass as AILatencyClass,
      qualityClass: m.qualityClass as AIQualityClass,
      isEnabled: m.isEnabled,
      isDefault: m.isDefault,
      fallbackModelId: m.fallbackModelId,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    }));

    try {
      if (redisClient?.isOpen) {
        await redisClient.setEx(MODEL_REGISTRY_CACHE_KEY, CACHE_TTL_SECONDS, JSON.stringify(result));
      }
    } catch (err) {
      logger.warn(`Failed to write active models to Redis cache: ${err}`);
    }

    return result;
  }

  public async getModelById(id: string): Promise<AIModelData | null> {
    const models = await this.getActiveModels();
    const found = models.find((m) => m.id === id);
    if (found) return found;

    const dbModel = await prisma.aIModel.findUnique({ where: { id } });
    if (!dbModel) return null;

    return {
      id: dbModel.id,
      provider: dbModel.provider as AIProviderName,
      modelName: dbModel.modelName,
      displayName: dbModel.displayName,
      capabilities: dbModel.capabilities as any,
      contextWindow: dbModel.contextWindow,
      inputCostPer1k: dbModel.inputCostPer1k,
      outputCostPer1k: dbModel.outputCostPer1k,
      latencyClass: dbModel.latencyClass as AILatencyClass,
      qualityClass: dbModel.qualityClass as AIQualityClass,
      isEnabled: dbModel.isEnabled,
      isDefault: dbModel.isDefault,
      fallbackModelId: dbModel.fallbackModelId,
      createdAt: dbModel.createdAt.toISOString(),
      updatedAt: dbModel.updatedAt.toISOString(),
    };
  }

  public async getModelByName(provider: string, modelName: string): Promise<AIModelData | null> {
    const models = await this.getActiveModels();
    const found = models.find((m) => m.provider === provider && m.modelName === modelName);
    if (found) return found;

    const dbModel = await prisma.aIModel.findUnique({
      where: {
        provider_modelName: {
          provider,
          modelName,
        },
      },
    });
    if (!dbModel) return null;

    return {
      id: dbModel.id,
      provider: dbModel.provider as AIProviderName,
      modelName: dbModel.modelName,
      displayName: dbModel.displayName,
      capabilities: dbModel.capabilities as any,
      contextWindow: dbModel.contextWindow,
      inputCostPer1k: dbModel.inputCostPer1k,
      outputCostPer1k: dbModel.outputCostPer1k,
      latencyClass: dbModel.latencyClass as AILatencyClass,
      qualityClass: dbModel.qualityClass as AIQualityClass,
      isEnabled: dbModel.isEnabled,
      isDefault: dbModel.isDefault,
      fallbackModelId: dbModel.fallbackModelId,
      createdAt: dbModel.createdAt.toISOString(),
      updatedAt: dbModel.updatedAt.toISOString(),
    };
  }

  public async invalidateCache(): Promise<void> {
    try {
      if (redisClient?.isOpen) {
        await redisClient.del(MODEL_REGISTRY_CACHE_KEY);
      }
    } catch (err) {
      logger.warn(`Failed to invalidate model registry cache: ${err}`);
    }
  }

  public async seedDefaultModels(): Promise<void> {
    const defaults = [
      {
        provider: 'mock',
        modelName: 'mock-fast-v1',
        displayName: 'Mock UltraFast',
        capabilities: ['chat', 'streaming', 'structured_output', 'multilingual'],
        contextWindow: 16384,
        inputCostPer1k: 0.0001,
        outputCostPer1k: 0.0002,
        latencyClass: 'fast',
        qualityClass: 'standard',
        isEnabled: true,
        isDefault: true,
      },
      {
        provider: 'mock',
        modelName: 'mock-quality-v1',
        displayName: 'Mock HighQuality',
        capabilities: ['chat', 'streaming', 'structured_output', 'tool_calling', 'multilingual', 'reasoning', 'long_context'],
        contextWindow: 128000,
        inputCostPer1k: 0.002,
        outputCostPer1k: 0.006,
        latencyClass: 'quality',
        qualityClass: 'flagship',
        isEnabled: true,
        isDefault: false,
      },
      {
        provider: 'openai',
        modelName: 'gpt-4o-mini',
        displayName: 'OpenAI GPT-4o Mini',
        capabilities: ['chat', 'streaming', 'structured_output', 'tool_calling', 'multilingual', 'vision'],
        contextWindow: 128000,
        inputCostPer1k: 0.00015,
        outputCostPer1k: 0.0006,
        latencyClass: 'fast',
        qualityClass: 'standard',
        isEnabled: true,
        isDefault: false,
      },
      {
        provider: 'openai',
        modelName: 'gpt-4o',
        displayName: 'OpenAI GPT-4o',
        capabilities: ['chat', 'streaming', 'structured_output', 'tool_calling', 'multilingual', 'vision', 'reasoning'],
        contextWindow: 128000,
        inputCostPer1k: 0.0025,
        outputCostPer1k: 0.01,
        latencyClass: 'quality',
        qualityClass: 'flagship',
        isEnabled: true,
        isDefault: false,
      },
      {
        provider: 'anthropic',
        modelName: 'claude-3-5-sonnet-20241022',
        displayName: 'Claude 3.5 Sonnet',
        capabilities: ['chat', 'streaming', 'structured_output', 'tool_calling', 'multilingual', 'reasoning', 'long_context'],
        contextWindow: 200000,
        inputCostPer1k: 0.003,
        outputCostPer1k: 0.015,
        latencyClass: 'quality',
        qualityClass: 'flagship',
        isEnabled: true,
        isDefault: false,
      },
      {
        provider: 'google',
        modelName: 'gemini-2.5-flash-lite',
        displayName: 'Google Gemini 2.5 Flash Lite',
        capabilities: ['chat', 'streaming', 'structured_output', 'tool_calling', 'multilingual', 'reasoning', 'long_context'],
        contextWindow: 1000000,
        inputCostPer1k: 0.000075,
        outputCostPer1k: 0.0003,
        latencyClass: 'fast',
        qualityClass: 'standard',
        isEnabled: true,
        isDefault: true,
      },
      {
        provider: 'google',
        modelName: 'gemini-2.5-flash',
        displayName: 'Google Gemini 2.5 Flash',
        capabilities: ['chat', 'streaming', 'structured_output', 'tool_calling', 'multilingual', 'reasoning', 'long_context'],
        contextWindow: 1000000,
        inputCostPer1k: 0.00015,
        outputCostPer1k: 0.0006,
        latencyClass: 'fast',
        qualityClass: 'standard',
        isEnabled: true,
        isDefault: false,
      },
      {
        provider: 'mock',
        modelName: 'mock-embedding-v1',
        displayName: 'Mock Embedding',
        capabilities: ['embeddings'],
        contextWindow: 8192,
        inputCostPer1k: 0.00002,
        outputCostPer1k: 0.0,
        latencyClass: 'fast',
        qualityClass: 'standard',
        isEnabled: true,
        isDefault: false,
      },
    ];

    for (const d of defaults) {
      await prisma.aIModel.upsert({
        where: {
          provider_modelName: {
            provider: d.provider,
            modelName: d.modelName,
          },
        },
        update: {
          displayName: d.displayName,
          capabilities: d.capabilities,
          contextWindow: d.contextWindow,
          inputCostPer1k: d.inputCostPer1k,
          outputCostPer1k: d.outputCostPer1k,
          latencyClass: d.latencyClass,
          qualityClass: d.qualityClass,
          isEnabled: d.isEnabled,
          isDefault: d.isDefault,
        },
        create: {
          provider: d.provider,
          modelName: d.modelName,
          displayName: d.displayName,
          capabilities: d.capabilities,
          contextWindow: d.contextWindow,
          inputCostPer1k: d.inputCostPer1k,
          outputCostPer1k: d.outputCostPer1k,
          latencyClass: d.latencyClass,
          qualityClass: d.qualityClass,
          isEnabled: d.isEnabled,
          isDefault: d.isDefault,
        },
      });
    }

    logger.info('Default AI Models seeded in database');
  }
}
