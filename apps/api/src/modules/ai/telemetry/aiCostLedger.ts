import { AsyncLocalStorage } from 'node:async_hooks';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../config/logger.js';

/**
 * The real cost of every Gemini call — the reply, rewrites, translations, profile and memory updates,
 * embeddings — written to ai_usage_events. Before this only the main reply was recorded, and with no
 * price for gemini-3.x, so it showed $0. `scripts/costReport.ts` turns it into cost per message and per user.
 */

export type AICostTask = 'chat' | 'profile' | 'memory' | 'embedding' | 'other';

interface AICostContext {
  userId?: string;
  characterId?: string;
  conversationId?: string;
  task: AICostTask;
}

const store = new AsyncLocalStorage<AICostContext>();

/** Everything awaited (or started) from here on is billed to this user/conversation/task. */
export function setAICostContext(ctx: AICostContext): void {
  store.enterWith(ctx);
}

/** Runs `fn` with a different task label (e.g. the background profile update), keeping the user. */
export function withAICostTask<T>(task: AICostTask, extra: Partial<AICostContext>, fn: () => Promise<T>): Promise<T> {
  return store.run({ ...store.getStore(), ...extra, task }, fn);
}

/**
 * USD per million tokens. ESTIMATES from published price trackers (Oct 2026) — check
 * https://ai.google.dev/gemini-api/docs/pricing and update. Flash rates are said to double on 1 Jan 2027.
 * Cached input is assumed at 25% of the input rate (conservative). Thinking tokens bill as output.
 */
const PRICES: Array<{ match: RegExp; input: number; output: number }> = [
  { match: /embedding/, input: 0.15, output: 0 },
  { match: /flash-lite/, input: 0.3, output: 2.5 },
  { match: /flash/, input: 0.75, output: 3.75 },
  { match: /pro/, input: 2.5, output: 15 },
];
const CACHED_SHARE = 0.25;

export function geminiCostUsd(model: string, t: { input: number; cached: number; output: number }): number {
  const price = PRICES.find((p) => p.match.test(model)) ?? PRICES[2]!;
  const fresh = Math.max(0, t.input - t.cached);
  return (fresh * price.input + t.cached * price.input * CACHED_SHARE + t.output * price.output) / 1_000_000;
}

/** Gemini's usageMetadata → one ledger row. Never throws, never blocks the reply. */
export function recordGeminiCall(params: {
  model: string;
  usage: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number; cachedContentTokenCount?: number } | undefined;
  latencyMs: number;
  embedding?: boolean;
}): void {
  const ctx = store.getStore();
  const u = params.usage ?? {};
  const input = u.promptTokenCount ?? 0;
  const cached = u.cachedContentTokenCount ?? 0;
  const thoughts = u.thoughtsTokenCount ?? 0;
  const output = (u.candidatesTokenCount ?? 0) + thoughts;
  if (!input && !output) return;
  const cost = geminiCostUsd(params.model, { input, cached, output });
  void prisma.aIUsageEvent
    .create({
      data: {
        requestId: `gemini_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        provider: 'google',
        model: params.model,
        task: params.embedding ? 'embedding' : (ctx?.task ?? 'other'),
        userId: ctx?.userId ?? null,
        characterId: ctx?.characterId ?? null,
        conversationId: ctx?.conversationId ?? null,
        inputTokens: input,
        outputTokens: output,
        cachedTokens: cached,
        totalTokens: input + output,
        estimatedCost: Number(cost.toFixed(8)),
        currency: 'USD',
        latencyMs: params.latencyMs,
        breakdown: { thoughtsTokens: thoughts, cachedTokens: cached },
      },
    })
    .catch((err: unknown) => logger.warn(`AI cost ledger write failed: ${err instanceof Error ? err.message : 'Unknown'}`));
}
