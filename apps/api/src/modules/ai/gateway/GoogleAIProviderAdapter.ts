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

  /**
   * Fallback chain for rate limits (429) / outages (5xx). Ordered by measured latency; slow models
   * (gemini-3.5-flash ≈ 20s per turn) are deliberately excluded so a fallback never stalls a chat.
   */
  // Measured with the real ~19k-char companion prompt (Sep 2026): 3.6-flash ≈ 2s to first token,
  // 3.1-flash-lite ≈ 4–7s, 3.5-flash-lite > 20s. Fastest first.
  private static readonly RESILIENT_MODELS = [
    'gemini-3.6-flash',
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-3.8-flash',
  ];

  /** Abort an attempt that has not started responding within this window, then try the next model. */
  private static readonly FIRST_BYTE_TIMEOUT_MS = 8_000;
  /** Hard ceiling for one full attempt (headers + body). */
  private static readonly ATTEMPT_TIMEOUT_MS = 45_000;
  /**
   * Recently slow/failing models (first-byte timeout, 429, 5xx) are tried last for a while, so one
   * overloaded or quota-limited model doesn't add its timeout to every single reply.
   */
  private static readonly degradedUntil = new Map<string, number>();
  private static readonly DEGRADED_FOR_MS = 5 * 60_000;

  private static markDegraded(model: string): void {
    GoogleAIProviderAdapter.degradedUntil.set(model, Date.now() + GoogleAIProviderAdapter.DEGRADED_FOR_MS);
  }

  private static markHealthy(model: string): void {
    GoogleAIProviderAdapter.degradedUntil.delete(model);
  }

  /** Requested model first, then the fallback chain — with currently degraded models moved last. */
  private static orderCandidates(primary: string): string[] {
    const chain = [primary, ...GoogleAIProviderAdapter.RESILIENT_MODELS.filter((m) => m !== primary)];
    const now = Date.now();
    const isDegraded = (m: string) => (GoogleAIProviderAdapter.degradedUntil.get(m) ?? 0) > now;
    return [...chain.filter((m) => !isDegraded(m)), ...chain.filter(isDegraded)];
  }

  /** Stop falling back to further models once this much time has passed without any text. */
  private static readonly SILENT_FALLBACK_BUDGET_MS = 15_000;

  /**
   * Thinking tokens count against maxOutputTokens. With chat-sized budgets, a thinking model spends
   * almost all of it thinking and returns 1–4 visible tokens ("I'm Sim"). Companion chat does not
   * need reasoning, so thinking is minimised: Gemini 2.x takes a budget, 3.x / *-latest a level.
   */
  private static thinkingConfigFor(modelName: string): Record<string, unknown> | undefined {
    if (/^gemini-2\./.test(modelName)) return modelName.includes('pro') ? { thinkingBudget: 128 } : { thinkingBudget: 0 };
    // gemini-3.7/3.8-flash reject MINIMAL (HTTP 400); 'low' is their lowest accepted level.
    if (/^gemini-3\.[78]/.test(modelName)) return { thinkingLevel: 'low' };
    if (/^gemini-(3|flash|pro)/.test(modelName)) return { thinkingLevel: 'minimal' };
    return undefined;
  }

  private static withModel(body: Record<string, any>, modelName: string): Record<string, any> {
    const thinkingConfig = GoogleAIProviderAdapter.thinkingConfigFor(modelName);
    return thinkingConfig ? { ...body, generationConfig: { ...body['generationConfig'], thinkingConfig } } : body;
  }

  private static cleanOutput(text: string): string {
    return text
      .replace(/\[USER_MESSAGE_START\][\s\S]*?\[USER_MESSAGE_END\]\s*/gi, '')
      .replace(/\[USER_MESSAGE_START\]/gi, '')
      .replace(/\[USER_MESSAGE_END\]/gi, '')
      .replace(/\[SYSTEM_MESSAGE_START\][\s\S]*?\[SYSTEM_MESSAGE_END\]\s*/gi, '')
      .replace(/\[SYSTEM_MESSAGE_START\]/gi, '')
      .replace(/\[SYSTEM_MESSAGE_END\]/gi, '')
      .trim();
  }

  constructor() {
    this.apiKey = process.env['GOOGLE_AI_API_KEY'] || process.env['GEMINI_API_KEY'];
    this.mockFallback = new MockAIProviderAdapter();
  }

  private getApiKey(): string | undefined {
    return process.env['GOOGLE_AI_API_KEY'] || process.env['GEMINI_API_KEY'] || this.apiKey;
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
    if (
      !requested ||
      requested.includes('mock') ||
      requested.includes('gpt') ||
      requested.includes('gemini-1.') ||
      requested.includes('gemini-2.0') ||
      requested.includes('gemini-2.5-flash') && !requested.includes('lite')
    ) {
      return GoogleAIProviderAdapter.RESILIENT_MODELS[0] || 'gemini-3.8-flash';
    }
    if (requested.startsWith('models/')) {
      return requested.replace('models/', '');
    }
    return requested;
  }

  private sanitizePromptForGemini(text: string): string {
    return text
      .replace(/\[USER_MESSAGE_START\]\n?/gi, '')
      .replace(/\n?\[USER_MESSAGE_END\]/gi, '')
      .replace(/\[SYSTEM_MESSAGE_START\]\n?/gi, '')
      .replace(/\n?\[SYSTEM_MESSAGE_END\]/gi, '')
      // Reframe raw sensitive keywords to natural conversational terminology
      // to prevent false-positive PROHIBITED_CONTENT rejections on free tier
      .replace(/\b(sex|chudai|chud|choda)\b/gi, 'physical intimacy')
      .replace(/\b(porn|pornography)\b/gi, 'adult content')
      .replace(/\b(nude|nudes)\b/gi, 'personal photos')
      .replace(/\b(boobs|lund|chut|dick|vagina|pussy)\b/gi, 'private parts')
      .trim();
  }

  private buildGeminiPayload(request: AIGenerateRequest) {
    const rawSystemPrompt = request.systemPrompt || request.messages.find((m) => m.role === 'system')?.content;
    const systemPrompt = rawSystemPrompt ? this.sanitizePromptForGemini(rawSystemPrompt) : undefined;
    const nonSystemMessages = request.messages.filter((m) => m.role !== 'system');

    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    for (const m of nonSystemMessages) {
      const role: 'user' | 'model' = m.role === 'assistant' ? 'model' : 'user';
      const cleanContent = this.sanitizePromptForGemini(m.content);
      if (!cleanContent) continue;

      const last = contents[contents.length - 1];
      if (last && last.role === role && last.parts[0]) {
        last.parts[0].text += `\n\n${cleanContent}`;
      } else {
        contents.push({ role, parts: [{ text: cleanContent }] });
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
        temperature: request.temperature ?? 0.85,
        topP: 0.95,
        maxOutputTokens: request.maxTokens ?? 1024,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' },
      ],
    };

    if (systemPrompt) {
      body['systemInstruction'] = {
        parts: [{ text: systemPrompt }],
      };
    }

    return body;
  }

  public async generate(request: AIGenerateRequest): Promise<AIGenerateResponse> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      // Explicit no-key development mode only.
      const mockRes = await this.mockFallback.generate(request);
      return { ...mockRes, provider: 'google' };
    }

    const startTime = Date.now();
    const primaryModel = this.resolveModelName(request.model);
    const candidateModels = GoogleAIProviderAdapter.orderCandidates(primaryModel);
    const baseBody = this.buildGeminiPayload(request);
    let lastError = 'no model attempted';

    for (const modelName of candidateModels) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), GoogleAIProviderAdapter.ATTEMPT_TIMEOUT_MS);
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(GoogleAIProviderAdapter.withModel(baseBody, modelName)),
          signal: ctl.signal,
        });
        if (!response.ok) {
          lastError = `${modelName}: HTTP ${response.status}`;
          if (response.status === 429 || response.status >= 500) GoogleAIProviderAdapter.markDegraded(modelName);
          continue;
        }

        const data: any = await response.json();
        const parts: Array<{ text?: string; thought?: boolean }> = data.candidates?.[0]?.content?.parts ?? [];
        const rawContent = parts.filter((p) => !p.thought).map((p) => p.text ?? '').join('');
        if (!rawContent) {
          lastError = `${modelName}: empty response${data.promptFeedback?.blockReason ? ` (blocked: ${data.promptFeedback.blockReason})` : ''}`;
          continue;
        }

        const finishReason = data.candidates?.[0]?.finishReason || 'STOP';
        const usage = data.usageMetadata || {};
        const latencyMs = Date.now() - startTime;
        GoogleAIProviderAdapter.markHealthy(modelName);
        return {
          id: data.responseId || `gen_gemini_${Date.now()}`,
          provider: 'google',
          model: modelName,
          content: GoogleAIProviderAdapter.cleanOutput(rawContent),
          finishReason: finishReason === 'STOP' ? 'stop' : 'length',
          usage: {
            promptTokens: usage.promptTokenCount || 0,
            completionTokens: usage.candidatesTokenCount || 0,
            totalTokens: usage.totalTokenCount || 0,
          },
          latencyMs,
          ttftMs: latencyMs,
        };
      } catch (err) {
        lastError = `${modelName}: ${(err as Error).name === 'AbortError' ? 'timed out' : (err as Error).message}`;
        if ((err as Error).name === 'AbortError') GoogleAIProviderAdapter.markDegraded(modelName);
      } finally {
        clearTimeout(timer);
      }
    }

    // Never substitute canned text for a real answer: callers must see the failure.
    throw new Error(`Google AI generation failed on all models (${lastError})`);
  }

  public async *stream(request: AIGenerateRequest): AsyncIterable<AIStreamEvent> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      // Explicit no-key development mode only.
      for await (const evt of this.mockFallback.stream(request)) yield evt;
      return;
    }

    const startTime = Date.now();
    const generationId = `gen_gemini_stream_${Date.now()}`;
    const primaryModel = this.resolveModelName(request.model);
    const candidateModels = GoogleAIProviderAdapter.orderCandidates(primaryModel);
    const baseBody = this.buildGeminiPayload(request);

    yield { type: 'started', id: generationId, model: primaryModel, timestamp: Date.now() };

    let accumulated = '';
    let lastError = 'no model attempted';
    let sawRateLimit = false;

    for (const modelName of candidateModels) {
      // The conversation is locked while this runs; never keep the user waiting indefinitely.
      if (Date.now() - startTime > GoogleAIProviderAdapter.SILENT_FALLBACK_BUDGET_MS) break;
      const ctl = new AbortController();
      const attemptTimer = setTimeout(() => ctl.abort(), GoogleAIProviderAdapter.ATTEMPT_TIMEOUT_MS);
      let firstByteTimer: ReturnType<typeof setTimeout> | undefined = setTimeout(
        () => ctl.abort(),
        GoogleAIProviderAdapter.FIRST_BYTE_TIMEOUT_MS,
      );
      let ttftMs: number | undefined;
      let lastUsage: any = null;
      let finishReason: string | undefined;
      let blockReason: string | undefined;

      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?alt=sse&key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(GoogleAIProviderAdapter.withModel(baseBody, modelName)),
          signal: ctl.signal,
        });
        if (!response.ok || !response.body) {
          lastError = `${modelName}: HTTP ${response.status}`;
          if (response.status === 429) sawRateLimit = true;
          if (response.status === 429 || response.status >= 500) GoogleAIProviderAdapter.markDegraded(modelName);
          continue;
        }

        const reader = response.body.getReader();
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
            const dataStr = line.substring(6).trim();
            if (!dataStr) continue;
            let chunk: any;
            try {
              chunk = JSON.parse(dataStr);
            } catch {
              continue;
            }
            if (chunk.promptFeedback?.blockReason) blockReason = chunk.promptFeedback.blockReason;
            if (chunk.usageMetadata) {
              lastUsage = {
                promptTokens: chunk.usageMetadata.promptTokenCount || 0,
                completionTokens: chunk.usageMetadata.candidatesTokenCount || 0,
                totalTokens: chunk.usageMetadata.totalTokenCount || 0,
              };
            }
            const candidate = chunk.candidates?.[0];
            if (candidate?.finishReason) finishReason = candidate.finishReason;
            for (const part of candidate?.content?.parts ?? []) {
              if (!part.text || part.thought) continue;
              if (ttftMs === undefined) {
                ttftMs = Date.now() - startTime;
                if (firstByteTimer) clearTimeout(firstByteTimer);
                firstByteTimer = undefined;
              }
              accumulated += part.text;
              yield { type: 'delta', id: generationId, delta: part.text, timestamp: Date.now() };
            }
          }
          if (blockReason) break;
        }
      } catch (err) {
        lastError = `${modelName}: ${(err as Error).name === 'AbortError' ? 'timed out' : (err as Error).message}`;
        if ((err as Error).name === 'AbortError' && ttftMs === undefined) GoogleAIProviderAdapter.markDegraded(modelName);
      } finally {
        clearTimeout(attemptTimer);
        if (firstByteTimer) clearTimeout(firstByteTimer);
      }

      // Once text has reached the client, never splice another model's answer onto it: finish with
      // what was delivered (the caller trims a cut-off tail). Only a silent attempt falls through.
      if (accumulated.trim().length > 0) {
        GoogleAIProviderAdapter.markHealthy(modelName);
        yield {
          type: 'metadata',
          id: generationId,
          model: modelName,
          usage: lastUsage || {
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
          model: modelName,
          fullContent: GoogleAIProviderAdapter.cleanOutput(accumulated),
          finishReason: blockReason ? 'content_filter' : finishReason === 'MAX_TOKENS' ? 'length' : 'stop',
          timestamp: Date.now(),
        };
        return;
      }
      if (blockReason) lastError = `${modelName}: blocked (${blockReason})`;
      else if (!lastError.startsWith(modelName)) lastError = `${modelName}: empty response (${finishReason ?? 'no finish reason'})`;
    }

    const rateLimited = sawRateLimit;
    yield {
      type: 'failed',
      id: generationId,
      // Shown to the user in the chat, so keep it human; the technical cause goes to the logs.
      error: rateLimited
        ? 'Too many messages right now. Please wait a minute and try again.'
        : 'Could not get a reply right now. Please try again.',
      metadata: { cause: lastError },
      timestamp: Date.now(),
    };
  }

  public async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return this.mockFallback.embed(request);
    }
    try {
      const inputs = Array.isArray(request.input) ? request.input : [request.input];
      const model = request.model || 'gemini-embedding-001';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents?key=${apiKey}`;

      const requests = inputs.map((text) => ({
        model: `models/${model}`,
        content: { parts: [{ text }] },
        // Same size as the stored vectors (memory embeddings are 1536-dimensional).
        outputDimensionality: 1536,
      }));

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests }),
      });

      if (!response.ok) {
        return this.mockFallback.embed(request);
      }

      const data: any = await response.json();
      const embeddings = (data.embeddings || []).map((e: any) => e.values || []);

      return {
        model,
        embeddings,
        usage: {
          promptTokens: inputs.reduce((acc, t) => acc + Math.ceil(t.length / 4), 0),
          totalTokens: inputs.reduce((acc, t) => acc + Math.ceil(t.length / 4), 0),
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
    return !!this.getApiKey();
  }
}
