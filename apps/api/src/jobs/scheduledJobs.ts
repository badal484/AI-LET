import { redis } from '../infrastructure/redis/redis.js';
import { AccountDeletionService } from '../modules/privacy/services/AccountDeletionService.js';
import { processDueCampaigns } from '../modules/console/campaigns.service.js';
import { runProactiveRound } from '../modules/notifications/services/proactiveRound.service.js';
import { ProactiveSchedulerService } from '../modules/notifications/services/proactiveScheduler.service.js';
import { recordJobRun } from '../modules/console/health.js';
import { logger } from '../config/logger.js';
import { reportError } from '../infrastructure/monitoring/sentry.js';

/**
 * The periodic jobs: account deletions (a promise to the user — DPDP Act / Google Play), reminders,
 * characters texting first and admin campaigns.
 *
 * They run in the worker. Without a worker (Render's free plan has none) the API runs them instead
 * (RUN_SCHEDULED_JOBS_IN_API=true), otherwise accounts would never be deleted and reminders never sent.
 * Each run takes a short Redis lock, so the API and a worker — or two API instances — never run the same
 * job at the same time.
 */

/** Key the worker refreshes while it runs; the API uses it to decide whether to queue work for it. */
export const WORKER_ALIVE_KEY = 'worker:alive';

/** Runs a periodic job without overlap; failures are logged and never crash the process. */
function every(name: string, ms: number, job: () => Promise<unknown>): NodeJS.Timeout {
  let running = false;
  const t = setInterval(() => {
    if (running) return;
    running = true;
    void (async () => {
      // One runner per tick across all processes; the lock expires on its own if a process dies.
      const got = await redis.set(`jobs:lock:${name}`, '1', 'PX', Math.max(ms - 1_000, 5_000), 'NX').catch(() => 'OK');
      if (got !== 'OK') return;
      try {
        const r = await job();
        if (r) logger.debug(`[Jobs:${name}]`, { result: r });
        void recordJobRun(name, ms, true);
      } catch (err) {
        logger.error(`[Jobs:${name}] failed`, { error: err instanceof Error ? err.message : err });
        reportError(err, { job: name });
        void recordJobRun(name, ms, false, err instanceof Error ? err.message : String(err));
      }
    })().finally(() => {
      running = false;
    });
  }, ms);
  t.unref();
  return t;
}

export function startScheduledJobs(where: 'worker' | 'api'): void {
  // Account deletion pipeline (leased, resumable) and its reconciliation.
  every('account-deletion', 60_000, () => AccountDeletionService.processDue(10));
  every('account-deletion-reconcile', 15 * 60_000, () => AccountDeletionService.reconcile());
  // Admin notification campaigns: scheduled ones, each person's local hour, people waiting out quiet hours.
  every('notification-campaigns', 60_000, () => processDueCampaigns());
  // Characters texting first: one decision per person (admin switch in Settings), and reminders people asked for.
  every('text-first', 15 * 60_000, () => runProactiveRound());
  every('reminders', 60_000, () => ProactiveSchedulerService.processDueReminders());
  every('proactive-expire', 60 * 60_000, () => ProactiveSchedulerService.expireStaleActions());
  logger.info(`⏱️  Scheduled jobs running in the ${where}`);
}

/** The worker says it's alive every 30 s (expires after 90 s), so the API knows it can queue work for it. */
export function startWorkerHeartbeat(): void {
  const beat = () => void redis.set(WORKER_ALIVE_KEY, new Date().toISOString(), 'EX', 90).catch(() => undefined);
  beat();
  setInterval(beat, 30_000).unref();
}
