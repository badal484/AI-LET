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

export class OpenAIProviderAdapter implements IAIProviderAdapter {
  public readonly providerName: AIProviderName = 'openai';
  private apiKey: string | undefined;
  private mockFallback: MockAIProviderAdapter;

  constructor() {
    this.apiKey = process.env['OPENAI_API_KEY'];
    this.mockFallback = new MockAIProviderAdapter();
  }

  public getCapabilities(): AIModelCapability[] {
    return [
      'chat',
      'streaming',
      'structured_output',
      'tool_calling',
      'embeddings',
      'moderation',
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
        provider: 'openai',
      };
    }

    const startTime = Date.now();
    try {
      const messages = [
        ...(request.systemPrompt ? [{ role: 'system', content: request.systemPrompt }] : []),
        ...request.messages.map((m) => ({ role: m.role, content: m.content })),
      ];

      const modelName = request.model || 'gpt-4o-mini';

      const body: Record<string, any> = {
        model: modelName,
        messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 1024,
      };

      if (request.responseFormat?.type === 'json_object') {
        body['response_format'] = { type: 'json_object' };
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(request.timeoutMs || 30000),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI API error ${response.status}: ${errText}`);
      }

      const data = (await response.json()) as any;
      const latencyMs = Date.now() - startTime;
      const choice = data.choices?.[0];

      return {
        id: data.id || `gen_openai_${Date.now()}`,
        provider: 'openai',
        model: data.model || modelName,
        content: choice?.message?.content || '',
        finishReason: choice?.finish_reason || 'stop',
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
        latencyMs,
        ttftMs: Math.min(latencyMs, 200),
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
    const generationId = `gen_openai_stream_${Date.now()}`;
    const modelName = request.model || 'gpt-4o-mini';

    yield {
      type: 'started',
      id: generationId,
      model: modelName,
      timestamp: Date.now(),
    };

    try {
      const messages = [
        ...(request.systemPrompt ? [{ role: 'system', content: request.systemPrompt }] : []),
        ...request.messages.map((m) => ({ role: m.role, content: m.content })),
      ];

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: modelName,
          messages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? 1024,
          stream: true,
        }),
        signal: AbortSignal.timeout(request.timeoutMs || 30000),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI stream error ${response.status}: ${errText}`);
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
            if (trimmed === 'data: [DONE]') break;

            try {
              const json = JSON.parse(trimmed.slice(6));
              const delta = json.choices?.[0]?.delta?.content || '';
              if (delta) {
                fullContent += delta;
                yield {
                  type: 'delta',
                  id: generationId,
                  delta,
                  timestamp: Date.now(),
                };
              }
            } catch {
              // Ignore line parse errors in stream
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
        error: err.message || 'OpenAI streaming failed',
        timestamp: Date.now(),
      };
    }
  }

  public async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    if (!this.apiKey) {
      return this.mockFallback.embed(request);
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: request.model || 'text-embedding-3-small',
        input: request.input,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI Embedding error: ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    return {
      model: data.model,
      embeddings: data.data.map((d: any) => d.embedding),
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
    };
  }

  public async classify(request: ClassificationRequest): Promise<ClassificationResponse> {
    return this.mockFallback.classify(request);
  }

  public async isHealthy(): Promise<boolean> {
    return true;
  }
}
