import { AIMessagePayload, GenerationOptions, AIProviderName } from '@ai-companion/types';
import { IAIProvider, AIProviderResponse } from './AIProvider.interface.js';
import { MockAIProvider } from './MockAIProvider.js';
import { AIProviderError } from '../../shared/errors/AppError.js';
import { logger } from '../../config/logger.js';
import { AIGateway } from '../../modules/ai/gateway/AIGateway.js';
import { AITelemetryService } from '../../modules/ai/telemetry/AITelemetry.service.js';
import { ResponseValidator } from '../../modules/ai/validation/ResponseValidator.js';

export class AIOrchestrator {
  private static instance: AIOrchestrator;
  private static providers: Map<string, IAIProvider> = new Map();
  private static gateway = AIGateway.getInstance();
  private static telemetry = AITelemetryService.getInstance();

  static {
    AIOrchestrator.registerProvider(new MockAIProvider());
  }

  public static getInstance(): AIOrchestrator {
    if (!AIOrchestrator.instance) {
      AIOrchestrator.instance = new AIOrchestrator();
    }
    return AIOrchestrator.instance;
  }

  public async generateText(input: {
    systemPrompt?: string;
    messages: { role: string; content: string }[];
    temperature?: number;
    maxTokens?: number;
    model?: string;
    provider?: string;
  }): Promise<{ text: string; model: string; provider: string; usage?: { promptTokens: number; completionTokens: number; totalTokens: number } }> {
    const pName = (input.provider || 'mock').toLowerCase() as AIProviderName;
    const mName = input.model || 'mock-gpt-4o';
    const allMessages: AIMessagePayload[] = [];
    if (input.systemPrompt) {
      allMessages.push({ role: 'system', content: input.systemPrompt });
    }
    for (const msg of input.messages) {
      allMessages.push({ role: msg.role as any, content: msg.content });
    }
    const res = await AIOrchestrator.executeText(pName, mName, allMessages, {
      temperature: input.temperature,
      maxTokens: input.maxTokens,
    });
    return {
      text: res.content,
      model: mName,
      provider: pName,
      usage: res.usage,
    };
  }

  public static registerProvider(provider: IAIProvider): void {
    this.providers.set(provider.providerName.toLowerCase(), provider);
  }

  public static getProvider(name: string): IAIProvider {
    const provider = this.providers.get(name.toLowerCase());
    if (!provider) {
      const mock = this.providers.get('mock');
      if (mock) {
        logger.warn(`Provider ${name} not found, falling back to mock provider`);
        return mock;
      }
      throw new AIProviderError(`AI Provider '${name}' is not registered`);
    }
    return provider;
  }

  public static async executeText(
    providerName: string,
    modelName: string,
    messages: AIMessagePayload[],
    options?: GenerationOptions,
  ): Promise<AIProviderResponse> {
    const start = Date.now();
    const pName = (providerName.toLowerCase() || 'mock') as AIProviderName;

    try {
      // Direct call through Phase 8 AIGateway
      const systemMessage = messages.find((m) => m.role === 'system')?.content;
      const conversationMessages = messages.filter((m) => m.role !== 'system');

      const response = await this.gateway.generate(
        {
          model: modelName,
          systemPrompt: systemMessage,
          messages: conversationMessages.map((m) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content,
          })),
          temperature: options?.temperature,
          maxTokens: options?.maxTokens,
        },
        pName
      );

      const latencyMs = Date.now() - start;

      // Validate output safety
      const validation = ResponseValidator.validate(response.content, {
        maxLength: options?.maxTokens ? options.maxTokens * 4 : 4000,
      });

      // Record telemetry in background
      this.telemetry
        .recordTrace({
          requestId: response.id,
          provider: pName,
          modelId: undefined,
          workload: 'CONVERSATION',
          promptTokens: response.usage.promptTokens,
          completionTokens: response.usage.completionTokens,
          latencyMs,
          ttftMs: response.ttftMs,
          isSuccess: true,
        })
        .catch(() => {});

      return {
        content: validation.sanitizedContent || response.content,
        finishReason: response.finishReason,
        usage: {
          promptTokens: response.usage.promptTokens,
          completionTokens: response.usage.completionTokens,
          totalTokens: response.usage.totalTokens,
        },
      };
    } catch (err: any) {
      logger.error(`AI Request failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      throw new AIProviderError(`AI execution failed on ${providerName}/${modelName}: ${err.message}`);
    }
  }

  public static async generateEmbedding(
    providerName: string,
    modelName: string,
    text: string,
  ): Promise<{ embedding: number[]; usage: { totalTokens: number } }> {
    const pName = (providerName.toLowerCase() || 'mock') as AIProviderName;
    try {
      const response = await this.gateway.embed(
        {
          model: modelName,
          input: text,
        },
        pName
      );

      return {
        embedding: response.embeddings[0] || [],
        usage: {
          totalTokens: response.usage.totalTokens,
        },
      };
    } catch (err: any) {
      logger.error(`AI Embedding failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      throw new AIProviderError(`AI embedding failed on ${providerName}/${modelName}: ${err.message}`);
    }
  }
}
