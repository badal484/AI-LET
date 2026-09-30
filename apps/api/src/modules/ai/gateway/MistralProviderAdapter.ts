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
 * Mistral AI (La Plateforme) — OpenAI-compatible chat completions.
 *
 * Model availability depends on the account's plan (some models have a 0 req/min allowance), so a
 * request walks a short chain of models the key can actually use, skipping models that were
 * recently rate-limited or slow. Failures are reported as a `failed` event / thrown error — never
 * replaced by canned text.
 */
export class MistralProviderAdapter implements IAIProviderAdapter {
  public readonly providerName: AIProviderName = 'mistral';
  private readonly mock = new MockAIProviderAdapter();

  private static readonly API_URL = 'https://api.mistral.ai/v1/chat/completions';
  /** Quality → speed. Override the first with MISTRAL_CHAT_MODEL. */
  private static readonly FALLBACK_MODELS = ['ministral-14b-latest', 'ministral-8b-latest', 'ministral-3b-latest'];
  private static readonly FIRST_BYTE_TIMEOUT_MS = 8_000;
  private static readonly ATTEMPT_TIMEOUT_MS = 45_000;
  private static readonly DEGRADED_FOR_MS = 60_000;
  private static readonly degradedUntil = new Map<string, number>();

  private getApiKey(): string | undefined {
    return process.env['MISTRAL_API_KEY'] || undefined;
  }

  public getCapabilities(): AIModelCapability[] {
    return ['chat', 'streaming', 'structured_output', 'multilingual'];
  }

  private static resolveModel(requested?: string): string {
    // Callers may pass another provider's model name (e.g. a character pinned to a Gemini model).
    if (requested && /^(ministral|mistral|magistral|open-mistral|open-mixtral)/.test(requested)) return requested;
    return process.env['MISTRAL_CHAT_MODEL'] || MistralProviderAdapter.FALLBACK_MODELS[0]!;
  }

  private static candidates(primary: string): string[] {
    const chain = [primary, ...MistralProviderAdapter.FALLBACK_MODELS.filter((m) => m !== primary)];
    const now = Date.now();
    const degraded = (m: string) => (MistralProviderAdapter.degradedUntil.get(m) ?? 0) > now;
    return [...chain.filter((m) => !degraded(m)), ...chain.filter(degraded)];
  }

  private static markDegraded(model: string): void {
    MistralProviderAdapter.degradedUntil.set(model, Date.now() + MistralProviderAdapter.DEGRADED_FOR_MS);
  }

  private static buildMessages(request: AIGenerateRequest): Array<{ role: string; content: string }> {
    const system = request.systemPrompt || request.messages.find((m) => m.role === 'system')?.content;
    const rest = request.messages
      .filter((m) => m.role !== 'system' && m.content?.trim())
      .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));
    // Mistral requires the conversation to end with a user message.
    if (rest.length === 0 || rest[rest.length - 1]!.role !== 'user') rest.push({ role: 'user', content: '...' });
    return [...(system ? [{ role: 'system', content: system }] : []), ...rest];
  }

  private static body(request: AIGenerateRequest, model: string, stream: boolean) {
    return JSON.stringify({
      model,
      stream,
      messages: MistralProviderAdapter.buildMessages(request),
      temperature: Math.min(request.temperature ?? 0.8, 1),
      max_tokens: request.maxTokens ?? 1024,
    });
  }

  public async generate(request: AIGenerateRequest): Promise<AIGenerateResponse> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return { ...(await this.mock.generate(request)), provider: 'mistral' };
    }
    const startTime = Date.now();
    let lastError = 'no model attempted';

    for (const model of MistralProviderAdapter.candidates(MistralProviderAdapter.resolveModel(request.model))) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), MistralProviderAdapter.ATTEMPT_TIMEOUT_MS);
      try {
        const res = await fetch(MistralProviderAdapter.API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: MistralProviderAdapter.body(request, model, false),
          signal: ctl.signal,
        });
        if (!res.ok) {
          lastError = `${model}: HTTP ${res.status}`;
          if (res.status === 429 || res.status >= 500) MistralProviderAdapter.markDegraded(model);
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
          id: data.id || `gen_mistral_${Date.now()}`,
          provider: 'mistral',
          model,
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
        if ((err as Error).name === 'AbortError') MistralProviderAdapter.markDegraded(model);
      } finally {
        clearTimeout(timer);
      }
    }
    throw new Error(`Mistral generation failed on all models (${lastError})`);
  }

  public async *stream(request: AIGenerateRequest): AsyncIterable<AIStreamEvent> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      for await (const evt of this.mock.stream(request)) yield evt;
      return;
    }
    const startTime = Date.now();
    const generationId = `gen_mistral_stream_${Date.now()}`;
    const primary = MistralProviderAdapter.resolveModel(request.model);
    yield { type: 'started', id: generationId, model: primary, timestamp: Date.now() };

    let accumulated = '';
    let lastError = 'no model attempted';
    let sawRateLimit = false;

    for (const model of MistralProviderAdapter.candidates(primary)) {
      const ctl = new AbortController();
      const attemptTimer = setTimeout(() => ctl.abort(), MistralProviderAdapter.ATTEMPT_TIMEOUT_MS);
      let firstByteTimer: ReturnType<typeof setTimeout> | undefined = setTimeout(
        () => ctl.abort(),
        MistralProviderAdapter.FIRST_BYTE_TIMEOUT_MS,
      );
      let ttftMs: number | undefined;
      let usage: any = null;
      let finishReason: string | undefined;

      try {
        const res = await fetch(MistralProviderAdapter.API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: MistralProviderAdapter.body(request, model, true),
          signal: ctl.signal,
        });
        if (!res.ok || !res.body) {
          lastError = `${model}: HTTP ${res.status}`;
          if (res.status === 429) sawRateLimit = true;
          if (res.status === 429 || res.status >= 500) MistralProviderAdapter.markDegraded(model);
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
            if (chunk.usage) {
              usage = {
                promptTokens: chunk.usage.prompt_tokens ?? 0,
                completionTokens: chunk.usage.completion_tokens ?? 0,
                totalTokens: chunk.usage.total_tokens ?? 0,
              };
            }
            const choice = chunk.choices?.[0];
            if (choice?.finish_reason) finishReason = choice.finish_reason;
            const delta: string | undefined = choice?.delta?.content;
            if (delta) {
              if (ttftMs === undefined) {
                ttftMs = Date.now() - startTime;
                if (firstByteTimer) clearTimeout(firstByteTimer);
                firstByteTimer = undefined;
              }
              accumulated += delta;
              yield { type: 'delta', id: generationId, delta, timestamp: Date.now() };
            }
          }
        }
      } catch (err) {
        lastError = `${model}: ${(err as Error).name === 'AbortError' ? 'timed out' : (err as Error).message}`;
        if ((err as Error).name === 'AbortError' && ttftMs === undefined) MistralProviderAdapter.markDegraded(model);
      } finally {
        clearTimeout(attemptTimer);
        if (firstByteTimer) clearTimeout(firstByteTimer);
      }

      // Once text reached the caller, never splice another model's answer onto it.
      if (accumulated.trim()) {
        MistralProviderAdapter.degradedUntil.delete(model);
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
      if (!lastError.startsWith(model)) lastError = `${model}: empty response`;
    }

    yield {
      type: 'failed',
      id: generationId,
      error: sawRateLimit
        ? 'Too many messages right now. Please wait a minute and try again.'
        : 'Could not get a reply right now. Please try again.',
      metadata: { cause: lastError },
      timestamp: Date.now(),
    };
  }

  public async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    // Embeddings stay on the existing pipeline (the plan's embedding allowance is not used here).
    return this.mock.embed(request);
  }

  public async classify(request: ClassificationRequest): Promise<ClassificationResponse> {
    return this.mock.classify(request);
  }

  public async isHealthy(): Promise<boolean> {
    return Boolean(this.getApiKey());
  }
}
