import {
  AIGenerateRequest,
  AIGenerateResponse,
  AIStreamEvent,
  AIProviderName,
  AIFailureType,
} from '@ai-companion/types';
import { AI_ERROR_CODES, ErrorCodeType } from '@ai-companion/config';
import { AppError } from '../../../shared/errors/AppError.js';
import {
  IAIProviderAdapter,
  EmbeddingRequest,
  EmbeddingResponse,
  ClassificationRequest,
  ClassificationResponse,
} from './IAIProviderAdapter.js';
import { MockAIProviderAdapter } from './MockAIProviderAdapter.js';
import { OpenAIProviderAdapter } from './OpenAIProviderAdapter.js';
import { AnthropicProviderAdapter } from './AnthropicProviderAdapter.js';

export class AIGatewayError extends AppError {
  public readonly failureType: AIFailureType;
  public readonly provider: string;
  public readonly model: string;

  constructor(
    message: string,
    errorCode: ErrorCodeType = AI_ERROR_CODES.PROVIDER_UNAVAILABLE,
    failureType: AIFailureType = 'server_error',
    provider: string = 'unknown',
    model: string = 'unknown',
    statusCode: number = 502
  ) {
    super(message, statusCode, errorCode);
    this.name = 'AIGatewayError';
    this.failureType = failureType;
    this.provider = provider;
    this.model = model;
  }
}

export class AIGateway {
  private static instance: AIGateway;
  private adapters: Map<AIProviderName, IAIProviderAdapter> = new Map();

  private constructor() {
    this.registerAdapter(new MockAIProviderAdapter());
    this.registerAdapter(new OpenAIProviderAdapter());
    this.registerAdapter(new AnthropicProviderAdapter());
  }

  public static getInstance(): AIGateway {
    if (!AIGateway.instance) {
      AIGateway.instance = new AIGateway();
    }
    return AIGateway.instance;
  }

  public registerAdapter(adapter: IAIProviderAdapter): void {
    this.adapters.set(adapter.providerName, adapter);
  }

  public getAdapter(providerName: AIProviderName): IAIProviderAdapter {
    const adapter = this.adapters.get(providerName);
    if (!adapter) {
      // Fallback to mock adapter if provider is missing
      const mock = this.adapters.get('mock');
      if (mock) return mock;
      throw new AIGatewayError(
        `AI Provider '${providerName}' is not configured`,
        AI_ERROR_CODES.PROVIDER_UNAVAILABLE,
        'provider_unavailable',
        providerName,
        'unknown',
        503
      );
    }
    return adapter;
  }

  public async generate(
    request: AIGenerateRequest,
    providerName: AIProviderName = 'mock'
  ): Promise<AIGenerateResponse> {
    const adapter = this.getAdapter(providerName);
    try {
      return await adapter.generate(request);
    } catch (err: any) {
      const failureType = this.classifyError(err);
      throw new AIGatewayError(
        `AI generation failed on ${providerName}/${request.model}: ${err.message}`,
        this.getErrorCodeForFailure(failureType),
        failureType,
        providerName,
        request.model
      );
    }
  }

  public async *stream(
    request: AIGenerateRequest,
    providerName: AIProviderName = 'mock'
  ): AsyncIterable<AIStreamEvent> {
    const adapter = this.getAdapter(providerName);
    try {
      for await (const evt of adapter.stream(request)) {
        yield evt;
      }
    } catch (err: any) {
      const failureType = this.classifyError(err);
      yield {
        type: 'failed',
        id: `err_${Date.now()}`,
        error: `Streaming error (${failureType}): ${err.message}`,
        timestamp: Date.now(),
      };
    }
  }

  public async embed(
    request: EmbeddingRequest,
    providerName: AIProviderName = 'mock'
  ): Promise<EmbeddingResponse> {
    const adapter = this.getAdapter(providerName);
    try {
      return await adapter.embed(request);
    } catch (err: any) {
      const failureType = this.classifyError(err);
      throw new AIGatewayError(
        `AI embedding failed on ${providerName}/${request.model}: ${err.message}`,
        this.getErrorCodeForFailure(failureType),
        failureType,
        providerName,
        request.model
      );
    }
  }

  public async classify(
    request: ClassificationRequest,
    providerName: AIProviderName = 'mock'
  ): Promise<ClassificationResponse> {
    const adapter = this.getAdapter(providerName);
    try {
      return await adapter.classify(request);
    } catch (err: any) {
      const failureType = this.classifyError(err);
      throw new AIGatewayError(
        `AI classification failed on ${providerName}/${request.model}: ${err.message}`,
        this.getErrorCodeForFailure(failureType),
        failureType,
        providerName,
        request.model
      );
    }
  }

  public classifyError(err: any): AIFailureType {
    const msg = (err?.message || '').toLowerCase();
    if (msg.includes('timeout') || msg.includes('aborted') || msg.includes('deadline')) {
      return 'timeout';
    }
    if (msg.includes('rate limit') || msg.includes('429') || msg.includes('too many requests')) {
      return 'rate_limit';
    }
    if (msg.includes('auth') || msg.includes('401') || msg.includes('api key') || msg.includes('unauthorized')) {
      return 'authentication_error';
    }
    if (msg.includes('context') || msg.includes('token limit') || msg.includes('maximum context length')) {
      return 'context_overflow';
    }
    if (msg.includes('content') || msg.includes('safety') || msg.includes('blocked') || msg.includes('flagged')) {
      return 'content_block';
    }
    if (msg.includes('bad request') || msg.includes('400')) {
      return 'bad_request';
    }
    if (msg.includes('json') || msg.includes('parse') || msg.includes('invalid response')) {
      return 'invalid_response';
    }
    if (msg.includes('network') || msg.includes('econnrefused') || msg.includes('fetch failed')) {
      return 'network_error';
    }
    return 'server_error';
  }

  private getErrorCodeForFailure(failureType: AIFailureType): ErrorCodeType {
    switch (failureType) {
      case 'timeout':
        return AI_ERROR_CODES.PROVIDER_TIMEOUT;
      case 'rate_limit':
        return AI_ERROR_CODES.PROVIDER_RATE_LIMIT;
      case 'context_overflow':
        return AI_ERROR_CODES.CONTEXT_TOO_LARGE;
      case 'content_block':
        return AI_ERROR_CODES.SAFETY_BLOCK;
      case 'invalid_response':
        return AI_ERROR_CODES.INVALID_RESPONSE;
      case 'authentication_error':
      case 'provider_unavailable':
      default:
        return AI_ERROR_CODES.PROVIDER_UNAVAILABLE;
    }
  }
}
