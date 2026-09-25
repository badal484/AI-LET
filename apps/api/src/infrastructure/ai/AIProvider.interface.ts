import {
  AIMessagePayload,
  ChatCompletionChunk,
  GenerationOptions,
  TokenUsage,
} from '@ai-companion/types';

export interface AIProviderResponse {
  content: string;
  usage: TokenUsage;
  finishReason: string;
}

export interface IAIProvider {
  readonly providerName: string;

  generateText(
    model: string,
    messages: AIMessagePayload[],
    options?: GenerationOptions,
  ): Promise<AIProviderResponse>;

  streamText(
    model: string,
    messages: AIMessagePayload[],
    options?: GenerationOptions,
  ): AsyncIterable<ChatCompletionChunk>;

  generateEmbedding(
    model: string,
    text: string,
  ): Promise<{ embedding: number[]; usage: { totalTokens: number } }>;
}
