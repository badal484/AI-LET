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

export class GoogleAIProviderAdapter implements IAIProviderAdapter {
  public readonly providerName: AIProviderName = 'google';
  private apiKey: string | undefined;
  private mockFallback: MockAIProviderAdapter;

  constructor() {
    this.apiKey = process.env['GOOGLE_AI_API_KEY'];
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
      'embeddings',
    ];
  }

  private resolveModelName(requested?: string): string {
    if (!requested || requested.includes('mock') || requested.includes('gpt')) {
      return 'gemini-2.5-flash-lite';
    }
    if (requested.startsWith('models/')) {
      return requested.replace('models/', '');
    }
    return requested;
  }

  private buildGeminiPayload(request: AIGenerateRequest) {
    const systemPrompt = request.systemPrompt || request.messages.find((m) => m.role === 'system')?.content;
    const nonSystemMessages = request.messages.filter((m) => m.role !== 'system');

    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    for (const m of nonSystemMessages) {
      const role: 'user' | 'model' = m.role === 'assistant' ? 'model' : 'user';
      const last = contents[contents.length - 1];
      if (last && last.role === role && last.parts[0]) {
        last.parts[0].text += `\n\n${m.content}`;
      } else {
        contents.push({ role, parts: [{ text: m.content }] });
      }
    }

    if (contents.length === 0) {
      contents.push({ role: 'user', parts: [{ text: 'Hello' }] });
    } else if (contents[0]?.role === 'model') {
      contents.unshift({ role: 'user', parts: [{ text: 'Hello' }] });
    }

    const body: Record<string, any> = {
      contents,
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens ?? 1024,
      },
    };

    if (systemPrompt) {
      body['systemInstruction'] = {
        parts: [{ text: systemPrompt }],
      };
    }

    return body;
  }

  public async generate(request: AIGenerateRequest): Promise<AIGenerateResponse> {
    if (!this.apiKey) {
      const mockRes = await this.mockFallback.generate(request);
      return {
        ...mockRes,
        provider: 'google',
      };
    }

    const startTime = Date.now();
    const modelName = this.resolveModelName(request.model);

    try {
      const body = this.buildGeminiPayload(request);

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${this.apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Google Gemini API error ${response.status}: ${errorText}`);
      }

      const data: any = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const finishReason = data.candidates?.[0]?.finishReason || 'STOP';
      const usage = data.usageMetadata || {};
      const latencyMs = Date.now() - startTime;

      return {
        id: data.responseId || `gen_gemini_${Date.now()}`,
        provider: 'google',
        model: modelName,
        content,
        finishReason: finishReason === 'STOP' ? 'stop' : 'length',
        usage: {
          promptTokens: usage.promptTokenCount || 0,
          completionTokens: usage.candidatesTokenCount || 0,
          totalTokens: usage.totalTokenCount || 0,
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
    const generationId = `gen_gemini_stream_${Date.now()}`;
    const modelName = this.resolveModelName(request.model);

    yield {
      type: 'started',
      id: generationId,
      model: modelName,
      timestamp: Date.now(),
    };

    try {
      const body = this.buildGeminiPayload(request);

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?alt=sse&key=${this.apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok || !response.body) {
        const errorText = await response.text();
        yield {
          type: 'failed',
          id: generationId,
          error: `Google Gemini API error ${response.status}: ${errorText}`,
          timestamp: Date.now(),
        };
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let accumulated = '';
      let ttftMs: number | undefined;
      let lastUsage: any = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.substring(6).trim();
            if (!dataStr) continue;

            try {
              const chunk = JSON.parse(dataStr);
              if (chunk.usageMetadata) {
                lastUsage = {
                  promptTokens: chunk.usageMetadata.promptTokenCount || 0,
                  completionTokens: chunk.usageMetadata.candidatesTokenCount || 0,
                  totalTokens: chunk.usageMetadata.totalTokenCount || 0,
                };
              }
              const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text;

              if (text) {
                if (ttftMs === undefined) {
                  ttftMs = Date.now() - startTime;
                }
                accumulated += text;
                yield {
                  type: 'delta',
                  id: generationId,
                  delta: text,
                  timestamp: Date.now(),
                };
              }
            } catch {}
          }
        }
      }

      yield {
        type: 'completed',
        id: generationId,
        fullContent: accumulated,
        finishReason: 'stop',
        usage: lastUsage || {
          promptTokens: Math.ceil(request.messages.reduce((acc, m) => acc + m.content.length, 0) / 4),
          completionTokens: Math.ceil(accumulated.length / 4),
          totalTokens: Math.ceil((request.messages.reduce((acc, m) => acc + m.content.length, 0) + accumulated.length) / 4),
        },
        latencyMs: Date.now() - startTime,
        ttftMs: ttftMs ?? Date.now() - startTime,
        timestamp: Date.now(),
      };
    } catch (err: any) {
      yield {
        type: 'failed',
        id: generationId,
        error: err.message || 'Stream processing error',
        timestamp: Date.now(),
      };
    }
  }

  public async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    if (!this.apiKey) {
      return this.mockFallback.embed(request);
    }

    try {
      const inputs = Array.isArray(request.input) ? request.input : [request.input];
      const model = 'gemini-embedding-001';
      const embeddings: number[][] = [];

      for (const text of inputs) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${this.apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: { parts: [{ text }] },
          }),
        });
        if (res.ok) {
          const json: any = await res.json();
          embeddings.push(json.embedding?.values || []);
        } else {
          return this.mockFallback.embed(request);
        }
      }

      return {
        model,
        embeddings,
        usage: {
          promptTokens: inputs.reduce((a, b) => a + b.length, 0) / 4,
          totalTokens: inputs.reduce((a, b) => a + b.length, 0) / 4,
        },
      };
    } catch {
      return this.mockFallback.embed(request);
    }
  }

  public async classify(request: ClassificationRequest): Promise<ClassificationResponse> {
    return this.mockFallback.classify(request);
  }

  public async isHealthy(): Promise<boolean> {
    if (!this.apiKey) return true;
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`
      );
      return res.status === 200;
    } catch {
      return false;
    }
  }
}
