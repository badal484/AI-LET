import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { runRetention } from '../src/jobs/retention.js';
import { rid } from './fixtures.js';

/** Nightly clean-up: old AI usage is folded into daily totals (kept for good) and removed; recent rows stay. */
describe('retention', () => {
  const model = `test-model-${rid()}`;
  const now = new Date('2026-10-17T21:30:00Z'); // 3 am IST the next day
  const old = new Date('2026-06-01T06:00:00Z'); // > 90 days before `now`, 1 June in India
  afterAll(async () => {
    await prisma.aIUsageEvent.deleteMany({ where: { model } });
    await prisma.aIUsageDaily.deleteMany({ where: { model } });
  });

  it('folds old AI usage into daily totals, removes it, keeps recent rows, never double-counts', async () => {
    const row = (createdAt: Date, input: number) =>
      prisma.aIUsageEvent.create({
        data: { requestId: rid(), provider: 'google', model, task: 'chat', inputTokens: input, outputTokens: 10, cachedTokens: 5, totalTokens: input + 10, estimatedCost: 0.001, createdAt },
      });
    await row(old, 100);
    await row(old, 300);
    await row(new Date(now.getTime() - 5 * 86_400_000), 999);

    const first = await runRetention(now);
    expect(first['ai_usage_events']).toBeGreaterThanOrEqual(2);
    expect(await prisma.aIUsageEvent.count({ where: { model } })).toBe(1); // the recent one stays

    const day = await prisma.aIUsageDaily.findFirst({ where: { model, task: 'chat' } });
    expect(day?.calls).toBe(2);
    expect(Number(day?.inputTokens)).toBe(400);
    expect(Number(day?.cachedTokens)).toBe(10);
    expect(day?.costUsd).toBeCloseTo(0.002, 6);
    expect(day?.day.toISOString().slice(0, 10)).toBe('2026-06-01');

    await runRetention(now); // a second night: nothing left to fold, totals unchanged
    expect((await prisma.aIUsageDaily.findFirst({ where: { model, task: 'chat' } }))?.calls).toBe(2);
  });
});
