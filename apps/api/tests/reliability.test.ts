import { afterEach, describe, expect, it, vi } from 'vitest';
import { tunedDatabaseUrl, usesPooler } from '../src/infrastructure/database/poolUrl.js';
import { configWarnings } from '../src/config/readiness.js';
import { createConcurrencyLimit } from '../src/shared/utils/concurrencyLimit.js';
import { runLockedJob } from '../src/jobs/scheduledJobs.js';
import { redis } from '../src/infrastructure/redis/redis.js';

/** Audit H-7, M-2, M-5, M-8: reliability guards. */

describe('database pool settings (M-8)', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('adds a connection limit and pool timeout, keeps what the URL already sets, and pgbouncer for a Neon pooler', () => {
    const t = new URL(tunedDatabaseUrl('postgresql://u:p@ep-x-pooler.ap-southeast-1.aws.neon.tech/db?sslmode=require')!);
    expect(t.searchParams.get('connection_limit')).toBe('10');
    expect(t.searchParams.get('pool_timeout')).toBe('20');
    expect(t.searchParams.get('pgbouncer')).toBe('true');
    expect(t.searchParams.get('sslmode')).toBe('require');

    vi.stubEnv('DB_CONNECTION_LIMIT', '4');
    const kept = new URL(tunedDatabaseUrl('postgresql://u:p@localhost:5432/db?connection_limit=25&schema=public')!);
    expect(kept.searchParams.get('connection_limit')).toBe('25');
    expect(kept.searchParams.get('pgbouncer')).toBeNull();
    expect(new URL(tunedDatabaseUrl('postgresql://u:p@localhost/db')!).searchParams.get('connection_limit')).toBe('4');

    expect(usesPooler('postgresql://u:p@ep-x-pooler.neon.tech/db')).toBe(true);
    expect(usesPooler('postgresql://u:p@ep-x.neon.tech/db')).toBe(false);
  });
});

describe('production settings check (H-7)', () => {
  it('names each missing setting that breaks a promise to users', () => {
    const warnings = configWarnings({ NODE_ENV: 'production', DATABASE_URL: 'postgresql://u:p@ep-x.neon.tech/db', RUN_SCHEDULED_JOBS_IN_API: 'false' } as NodeJS.ProcessEnv);
    const all = warnings.join('\n');
    expect(all).toMatch(/PUBLIC_API_URL/);
    expect(all).toMatch(/LEGAL_OPERATOR_NAME/);
    expect(all).toMatch(/PUBSUB_PUSH_SERVICE_ACCOUNT/);
    expect(all).toMatch(/pooler/);
    expect(all).toMatch(/SENTRY_DSN/);
    expect(all).toMatch(/account deletions/);
    expect(all).toMatch(/shorter than 32 characters/);

    const fine = configWarnings({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://u:p@ep-x-pooler.neon.tech/db',
      PUBLIC_API_URL: 'https://api.example.com',
      LEGAL_OPERATOR_NAME: 'Owner',
      LEGAL_CONTACT_EMAIL: 'a@b.c',
      PUBSUB_PUSH_SERVICE_ACCOUNT: 'x@y.iam.gserviceaccount.com',
      SENTRY_DSN: 'https://x@sentry.io/1',
      JWT_ACCESS_SECRET: 'a'.repeat(40),
      JWT_REFRESH_SECRET: 'b'.repeat(40),
    } as NodeJS.ProcessEnv);
    expect(fine.filter((w) => !/Email is not set up/.test(w))).toEqual([]);
  });
});

describe('email test mode', () => {
  afterEach(() => vi.unstubAllEnvs());
  it("says when email only reaches the owner (Resend's test sender)", () => {
    vi.stubEnv('RESEND_API_KEY', 'test_key');
    vi.stubEnv('EMAIL_FROM', 'Loveek <onboarding@resend.dev>');
    expect(configWarnings().join('\n')).toMatch(/test mode/);
    vi.stubEnv('EMAIL_FROM', 'Loveek <no-reply@loveek.in>');
    expect(configWarnings().join('\n')).not.toMatch(/test mode|Email is not set up/);
  });
});

describe('background work concurrency (M-5)', () => {
  it('never runs more than the limit at once, and drops work past a full waiting line', async () => {
    const limit = createConcurrencyLimit(2, 1);
    let active = 0;
    let peak = 0;
    const releases: Array<() => void> = [];
    const job = () =>
      new Promise<void>((resolve) => {
        active++;
        peak = Math.max(peak, active);
        releases.push(() => {
          active--;
          resolve();
        });
      });
    const a = limit.run(job);
    const b = limit.run(job);
    const c = limit.run(job); // waits
    expect(await limit.run(job)).toBe(false); // line full → dropped
    expect(limit.stats()).toEqual({ running: 2, waiting: 1 });
    releases.shift()!();
    await a;
    await vi.waitFor(() => expect(releases.length).toBe(2)); // c started
    releases.splice(0).forEach((r) => r());
    expect(await Promise.all([b, c])).toEqual([true, true]);
    expect(peak).toBe(2);
  });
});

describe('scheduled job lock (M-2)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('runs once per lock, and skips (instead of running everywhere) when Redis is unreachable', async () => {
    const name = `test-lock-${Date.now()}`;
    const job = vi.fn(async () => 'done');
    expect(await runLockedJob(name, 10_000, job)).toBe(true);
    expect(await runLockedJob(name, 10_000, job)).toBe(false); // lock still held
    expect(job).toHaveBeenCalledTimes(1);

    vi.spyOn(redis, 'set').mockRejectedValueOnce(new Error('ECONNREFUSED'));
    expect(await runLockedJob(`${name}-down`, 10_000, job)).toBe(false);
    expect(job).toHaveBeenCalledTimes(1);
    await redis.del(`jobs:lock:${name}`);
  });
});
