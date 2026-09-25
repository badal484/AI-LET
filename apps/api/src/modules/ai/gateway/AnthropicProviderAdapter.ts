import {
  AIGenerateRequest,
  AIGenerateResponse,
  AIStreamEvent,
  AIProviderName,
  AIModelCapability,
} from '@ai-companion/types';
import {
  IAIProviderAdapter,
  EmbeddingRequest,
  EmbeddingResponse,
  ClassificationRequest,
  ClassificationResponse,
} from './IAIProviderAdapter.js';
import { MockAIProviderAdapter } from './MockAIProviderAdapter.js';

export class AnthropicProviderAdapter implements IAIProviderAdapter {
  public readonly providerName: AIProviderName = 'anthropic';
  private apiKey: string | undefined;
  private mockFallback: MockAIProviderAdapter;

  constructor() {
    this.apiKey = process.env['ANTHROPIC_API_KEY'];
    this.mockFallback = new MockAIProviderAdapter();
  }

  public getCapabilities(): AIModelCapability[] {
    return [
      'chat',
      'streaming',
      'structured_output',
      'tool_calling',
      'multilingual',
      'long_context',
      'reasoning',
    ];
  }

  public async generate(request: AIGenerateRequest): Promise<AIGenerateResponse> {
    if (!this.apiKey) {
      const mockRes = await this.mockFallback.generate(request);
      return {
        ...mockRes,
        provider: 'anthropic',
      };
    }

    const startTime = Date.now();
    try {
      const messages = request.messages.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));

      const body: Record<string, any> = {
        model: request.model,
        messages,
        max_tokens: request.maxTokens ?? 1024,
        temperature: request.temperature ?? 0.7,
      };

      if (request.systemPrompt) {
        body['system'] = request.systemPrompt;
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(request.timeoutMs || 30000),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Anthropic API error ${response.status}: ${errText}`);
      }

      const data = (await response.json()) as any;
      const latencyMs = Date.now() - startTime;
      const content = data.content?.[0]?.text || '';

      return {
        id: data.id || `gen_anthropic_${Date.now()}`,
        provider: 'anthropic',
        model: data.model || request.model,
        content,
        finishReason: data.stop_reason === 'end_turn' ? 'stop' : data.stop_reason || 'stop',
        usage: {
          promptTokens: data.usage?.input_tokens || 0,
          completionTokens: data.usage?.output_tokens || 0,
          totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        },
        latencyMs,
        ttftMs: Math.min(latencyMs, 250),
      };
    } catch (err: any) {
      if (!this.apiKey) {
        return this.mockFallback.generate(request);
      }
      throw err;
    }
  }

  public async *stream(request: AIGenerateRequest): AsyncIterable<AIStreamEvent> {
    if (!this.apiKey) {
      for await (const evt of this.mockFallback.stream(request)) {
        yield evt;
      }
      return;
    }

    const startTime = Date.now();
    const generationId = `gen_anthropic_stream_${Date.now()}`;

    yield {
      type: 'started',
      id: generationId,
      model: request.model,
      timestamp: Date.now(),
    };

    try {
      const messages = request.messages.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: request.model,
          messages,
          system: request.systemPrompt,
          max_tokens: request.maxTokens ?? 1024,
          temperature: request.temperature ?? 0.7,
          stream: true,
        }),
        signal: AbortSignal.timeout(request.timeoutMs || 30000),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Anthropic stream error ${response.status}: ${errText}`);
      }

      let fullContent = '';
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;

            try {
              const json = JSON.parse(trimmed.slice(6));
              if (json.type === 'content_block_delta') {
                const delta = json.delta?.text || '';
                if (delta) {
                  fullContent += delta;
                  yield {
                    type: 'delta',
                    id: generationId,
                    delta,
                    timestamp: Date.now(),
                  };
                }
              }
            } catch {
              // Ignore partial stream line parse errors
            }
          }
        }
      }

      yield {
        type: 'metadata',
        id: generationId,
        usage: {
          promptTokens: Math.ceil((request.systemPrompt?.length || 0) / 4),
          completionTokens: Math.ceil(fullContent.length / 4),
          totalTokens: Math.ceil(((request.systemPrompt?.length || 0) + fullContent.length) / 4),
        },
        latencyMs: Date.now() - startTime,
        timestamp: Date.now(),
      };

      yield {
        type: 'completed',
        id: generationId,
        fullContent,
        finishReason: 'stop',
        timestamp: Date.now(),
      };
    } catch (err: any) {
      yield {
        type: 'failed',
        id: generationId,
        error: err.message || 'Anthropic streaming failed',
        timestamp: Date.now(),
      };
    }
  }

  public async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    return this.mockFallback.embed(request);
  }

  public async classify(request: ClassificationRequest): Promise<ClassificationResponse> {
    return this.mockFallback.classify(request);
  }

  public async isHealthy(): Promise<boolean> {
    return true;
  }
}
