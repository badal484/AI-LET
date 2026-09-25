import {
  AIGenerateRequest,
  AIGenerateResponse,
  AIStreamEvent,
  AIProviderName,
  AIModelCapability,
} from '@ai-companion/types';

export interface EmbeddingRequest {
  model: string;
  input: string | string[];
}

export interface EmbeddingResponse {
  model: string;
  embeddings: number[][];
  usage: {
    promptTokens: number;
    totalTokens: number;
  };
}

export interface ClassificationRequest {
  model: string;
  input: string;
  categories: string[];
}

export interface ClassificationResponse {
  model: string;
  category: string;
  confidence: number;
  scores: Record<string, number>;
}

export interface IAIProviderAdapter {
  readonly providerName: AIProviderName;
  
  getCapabilities(): AIModelCapability[];
  
  generate(request: AIGenerateRequest): Promise<AIGenerateResponse>;
  
  stream(request: AIGenerateRequest): AsyncIterable<AIStreamEvent>;
  
  embed(request: EmbeddingRequest): Promise<EmbeddingResponse>;
  
  classify(request: ClassificationRequest): Promise<ClassificationResponse>;
  
  isHealthy(): Promise<boolean>;
}
