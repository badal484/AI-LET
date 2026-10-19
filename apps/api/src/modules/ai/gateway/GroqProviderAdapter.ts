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

/**
 * Groq AI Cloud Platform — ultra-fast LPU inference (OpenAI-compatible chat completions).
 *
 * Provides high-speed primary or fallback generation for character chat and platform tasks.
 * If a model encounters a rate limit (429) or transient outage (5xx), it walks available
 * candidate models and degrades failing models temporarily.
 */
export class GroqProviderAdapter implements IAIProviderAdapter {
  public readonly providerName: AIProviderName = 'groq';
  private readonly mock = new MockAIProviderAdapter();

  private static readonly API_URL = 'https://api.groq.com/openai/v1/chat/completions';
  /** Available models in preference order. Override primary with GROQ_CHAT_MODEL. */
  private static readonly FALLBACK_MODELS = [
    'qwen/qwen3.8-27b',
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'allam-2-7b',
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
  ];
  private static readonly FIRST_BYTE_TIMEOUT_MS = 8_000;
  private static readonly ATTEMPT_TIMEOUT_MS = 30_000;
  private static readonly DEGRADED_FOR_MS = 60_000;
  private static readonly degradedUntil = new Map<string, number>();

  private getApiKey(): string | undefined {
    return process.env['GROQ_API_KEY'] || undefined;
  }

  public getCapabilities(): AIModelCapability[] {
    return ['chat', 'streaming', 'structured_output', 'multilingual', 'reasoning'];
  }

  private static resolveModel(requested?: string): string {
    if (requested && !requested.startsWith('mock') && !requested.startsWith('gemini') && !requested.startsWith('ministral') && !requested.startsWith('claude')) {
      return requested;
    }
    return process.env['GROQ_CHAT_MODEL'] || GroqProviderAdapter.FALLBACK_MODELS[0]!;
  }

  private static candidates(primary: string): string[] {
    const chain = [primary, ...GroqProviderAdapter.FALLBACK_MODELS.filter((m) => m !== primary)];
    const now = Date.now();
    const degraded = (m: string) => (GroqProviderAdapter.degradedUntil.get(m) ?? 0) > now;
    return [...chain.filter((m) => !degraded(m)), ...chain.filter(degraded)];
  }

  private static markDegraded(model: string): void {
    GroqProviderAdapter.degradedUntil.set(model, Date.now() + GroqProviderAdapter.DEGRADED_FOR_MS);
  }

  private static buildMessages(request: AIGenerateRequest): Array<{ role: string; content: string }> {
    const system = request.systemPrompt || request.messages.find((m) => m.role === 'system')?.content;
    const rest = request.messages
      .filter((m) => m.role !== 'system' && m.content?.trim())
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user',
        content: m.content,
      }));
    if (rest.length === 0) {
      rest.push({ role: 'user', content: '...' });
    }
    return [...(system ? [{ role: 'system', content: system }] : []), ...rest];
  }

  private static body(request: AIGenerateRequest, model: string, stream: boolean): string {
    const payload: Record<string, any> = {
      model,
      stream,
      messages: GroqProviderAdapter.buildMessages(request),
      temperature: Math.min(request.temperature ?? 0.7, 1),
      max_tokens: request.maxTokens ?? 1024,
    };
    if (request.responseFormat?.type === 'json_object') {
      payload['response_format'] = { type: 'json_object' };
    }
    return JSON.stringify(payload);
  }

  public async generate(request: AIGenerateRequest): Promise<AIGenerateResponse> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return { ...(await this.mock.generate(request)), provider: 'groq' };
    }

    const startTime = Date.now();
    let lastError = 'no model attempted';

    for (const model of GroqProviderAdapter.candidates(GroqProviderAdapter.resolveModel(request.model))) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), request.timeoutMs || GroqProviderAdapter.ATTEMPT_TIMEOUT_MS);
      try {
        const res = await fetch(GroqProviderAdapter.API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: GroqProviderAdapter.body(request, model, false),
          signal: ctl.signal,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          lastError = `${model}: HTTP ${res.status} ${errText}`.slice(0, 200);
          if (res.status === 429 || res.status >= 500) {
            GroqProviderAdapter.markDegraded(model);
          }
          continue;
        }

        const data: any = await res.json();
        const content: string = data.choices?.[0]?.message?.content ?? '';
        if (!content.trim()) {
          lastError = `${model}: empty response`;
          continue;
        }

        const latencyMs = Date.now() - startTime;
        return {
          id: data.id || `gen_groq_${Date.now()}`,
          provider: 'groq',
          model: data.model || model,
          content: content.trim(),
          finishReason: data.choices?.[0]?.finish_reason === 'length' ? 'length' : 'stop',
          usage: {
            promptTokens: data.usage?.prompt_tokens ?? 0,
            completionTokens: data.usage?.completion_tokens ?? 0,
            totalTokens: data.usage?.total_tokens ?? 0,
          },
          latencyMs,
          ttftMs: latencyMs,
        };
      } catch (err) {
        lastError = `${model}: ${(err as Error).name === 'AbortError' ? 'timed out' : (err as Error).message}`;
        if ((err as Error).name === 'AbortError') {
          GroqProviderAdapter.markDegraded(model);
        }
      } finally {
        clearTimeout(timer);
      }
    }

    throw new Error(`Groq generation failed on all candidate models (${lastError})`);
  }

  public async *stream(request: AIGenerateRequest): AsyncIterable<AIStreamEvent> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      for await (const evt of this.mock.stream(request)) yield evt;
      return;
    }

    const startTime = Date.now();
    const generationId = `gen_groq_stream_${Date.now()}`;
    const primary = GroqProviderAdapter.resolveModel(request.model);
    yield { type: 'started', id: generationId, model: primary, timestamp: Date.now() };

    let accumulated = '';
    let lastError = 'no model attempted';
    let sawRateLimit = false;

    for (const model of GroqProviderAdapter.candidates(primary)) {
      const ctl = new AbortController();
      const attemptTimer = setTimeout(() => ctl.abort(), request.timeoutMs || GroqProviderAdapter.ATTEMPT_TIMEOUT_MS);
      let firstByteTimer: ReturnType<typeof setTimeout> | undefined = setTimeout(
        () => ctl.abort(),
        GroqProviderAdapter.FIRST_BYTE_TIMEOUT_MS,
      );
      let ttftMs: number | undefined;
      let usage: any = null;
      let finishReason: string | undefined;

      try {
        const res = await fetch(GroqProviderAdapter.API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: GroqProviderAdapter.body(request, model, true),
          signal: ctl.signal,
        });

        if (!res.ok || !res.body) {
          lastError = `${model}: HTTP ${res.status}`;
          if (res.status === 429) sawRateLimit = true;
          if (res.status === 429 || res.status >= 500) {
            GroqProviderAdapter.markDegraded(model);
          }
          continue;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (!data || data === '[DONE]') continue;

            let chunk: any;
            try {
              chunk = JSON.parse(data);
            } catch {
              continue;
            }

            if (chunk.usage || chunk.x_groq?.usage) {
              const u = chunk.usage || chunk.x_groq?.usage;
              usage = {
                promptTokens: u.prompt_tokens ?? 0,
                completionTokens: u.completion_tokens ?? 0,
                totalTokens: u.total_tokens ?? 0,
              };
            }

            const choice = chunk.choices?.[0];
            if (choice?.finish_reason) {
              finishReason = choice.finish_reason;
            }

            // Reasoning models (e.g. gpt-oss-120b) may emit delta.reasoning: ignore reasoning, take delta.content
            const deltaContent: string | undefined = choice?.delta?.content;
            if (deltaContent) {
              if (firstByteTimer) {
                clearTimeout(firstByteTimer);
                firstByteTimer = undefined;
                ttftMs = Date.now() - startTime;
              }
              accumulated += deltaContent;
              yield {
                type: 'delta',
                id: generationId,
                delta: deltaContent,
                timestamp: Date.now(),
              };
            }
          }
        }
      } catch (err) {
        lastError = `${model}: ${(err as Error).name === 'AbortError' ? 'timed out' : (err as Error).message}`;
        if ((err as Error).name === 'AbortError') {
          GroqProviderAdapter.markDegraded(model);
        }
      } finally {
        clearTimeout(attemptTimer);
        if (firstByteTimer) clearTimeout(firstByteTimer);
      }

      // Once text reached the caller, do not splice another model's output onto it
      if (accumulated.trim()) {
        GroqProviderAdapter.degradedUntil.delete(model);
        yield {
          type: 'metadata',
          id: generationId,
          model,
          usage: usage || {
            promptTokens: Math.ceil((request.systemPrompt?.length ?? 200) / 4),
            completionTokens: Math.ceil(accumulated.length / 4),
            totalTokens: Math.ceil(((request.systemPrompt?.length ?? 200) + accumulated.length) / 4),
          },
          latencyMs: Date.now() - startTime,
          ttftMs: ttftMs ?? Date.now() - startTime,
          timestamp: Date.now(),
        };
        yield {
          type: 'completed',
          id: generationId,
          model,
          fullContent: accumulated.trim(),
          finishReason: finishReason === 'length' ? 'length' : 'stop',
          timestamp: Date.now(),
        };
        return;
      }

      if (!lastError.startsWith(model)) {
        lastError = `${model}: empty response`;
      }
    }

    yield {
      type: 'failed',
      id: generationId,
      error: sawRateLimit
        ? 'Too many requests right now. Please wait a minute and try again.'
        : 'Could not get a reply right now. Please try again.',
      metadata: { cause: lastError },
      timestamp: Date.now(),
    };
  }

  public async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    return this.mock.embed(request);
  }

  public async classify(request: ClassificationRequest): Promise<ClassificationResponse> {
    return this.mock.classify(request);
  }

  public async isHealthy(): Promise<boolean> {
    return Boolean(this.getApiKey());
  }
}
