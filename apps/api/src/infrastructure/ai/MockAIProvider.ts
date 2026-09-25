import { AIMessagePayload, ChatCompletionChunk, GenerationOptions } from '@ai-companion/types';
import { IAIProvider, AIProviderResponse } from './AIProvider.interface.js';

export class MockAIProvider implements IAIProvider {
  public readonly providerName = 'mock';

  async generateText(
    model: string,
    messages: AIMessagePayload[],
    _options?: GenerationOptions,
  ): Promise<AIProviderResponse> {
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || 'Hello';
    const mockReply = `[Mock ${model} Response] That sounds fascinating! Tell me more about "${lastUserMessage}".`;

    return {
      content: mockReply,
      usage: {
        promptTokens: 25,
        completionTokens: 20,
        totalTokens: 45,
        estimatedCostUsd: 0.0001,
      },
      finishReason: 'stop',
    };
  }

  async *streamText(
    _model: string,
    messages: AIMessagePayload[],
    _options?: GenerationOptions,
  ): AsyncIterable<ChatCompletionChunk> {
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || 'Hello';
    const tokens = [
      'Hello',
      ' there!',
      ' I',
      ' hear',
      ' you',
      ' saying',
      ` "${lastUserMessage.slice(0, 15)}..."`,
    ];

    for (const token of tokens) {
      yield {
        delta: token,
        isComplete: false,
      };
    }

    yield {
      delta: '',
      isComplete: true,
      usage: {
        promptTokens: 25,
        completionTokens: 20,
        totalTokens: 45,
        estimatedCostUsd: 0.0001,
      },
    };
  }

  async generateEmbedding(
    _model: string,
    _text: string,
  ): Promise<{ embedding: number[]; usage: { totalTokens: number } }> {
    const embedding = Array.from({ length: 1536 }, (_, i) => Math.sin(i * 0.1) * 0.01);
    return {
      embedding,
      usage: { totalTokens: 10 },
    };
  }
}
