import { QueueManager } from './infrastructure/queues/QueueManager.js';
import { AccountDeletionService } from './modules/privacy/services/AccountDeletionService.js';
import { SocialIntegrityService } from './modules/social/lifecycle/SocialIntegrityService.js';
import {
  SocialEvents,
  registerSocialEventHandlers,
  ScheduledSocialActionService,
  SocialMessagingService,
  SocialNotificationService,
} from './modules/social/index.js';
import { disconnectDatabase } from './infrastructure/database/prisma.js';
import { disconnectRedis } from './infrastructure/redis/redis.js';
import { logger } from './config/logger.js';
import { env } from './config/env.js';

logger.info(`⚙️  AI Companion Background Queue Worker process starting [${env.NODE_ENV}]...`);

// 1. Register Chat AI Job Processor
QueueManager.registerWorker('chat-ai', async (job) => {
  logger.info(`[Worker:chat-ai] Processing chat AI job ${job.id}`, { data: job.data });
  // Simulated processing delay / AI call
  await new Promise((resolve) => setTimeout(resolve, 100));
  return { status: 'SUCCESS', jobId: job.id };
}, 10);

// 2. Register Memory Extraction Processor
QueueManager.registerWorker('memory-extraction', async (job) => {
  logger.info(`[Worker:memory-extraction] Extracting memory entities for conversation ${job.data?.conversationId}`);
  await new Promise((resolve) => setTimeout(resolve, 50));
  return { status: 'SUCCESS' };
}, 5);

// 3. Register Notification Delivery Processor
QueueManager.registerWorker('notifications', async (job) => {
  logger.info(`[Worker:notifications] Dispatching push notification to user ${job.data?.userId}`);
  await new Promise((resolve) => setTimeout(resolve, 30));
  return { status: 'DISPATCHED' };
}, 10);

// 4. Register Discovery Indexing Processor
QueueManager.registerWorker('discovery-indexing', async (job) => {
  logger.info(`[Worker:discovery-indexing] Indexing character discovery document ${job.data?.characterId}`);
  await new Promise((resolve) => setTimeout(resolve, 50));
  return { status: 'INDEXED' };
}, 4);

// 5. Register Billing Webhooks Processor
QueueManager.registerWorker('billing-webhooks', async (job) => {
  logger.info(`[Worker:billing-webhooks] Processing purchase webhook event ${job.data?.eventId}`);
  await new Promise((resolve) => setTimeout(resolve, 80));
  return { status: 'PROCESSED' };
}, 5);

// 6. Register Media Generation Processor
QueueManager.registerWorker('media-generation', async (job) => {
  logger.info(`[Worker:media-generation] Processing media generation job ${job.id}`);
  await new Promise((resolve) => setTimeout(resolve, 100));
  return { status: 'GENERATED' };
}, 2);

// 7. Register Analytics Events Processor
QueueManager.registerWorker('analytics-events', async (job) => {
  logger.info(`[Worker:analytics-events] Ingesting analytics batch of ${job.data?.events?.length || 1} events`);
  await new Promise((resolve) => setTimeout(resolve, 20));
  return { status: 'INGESTED' };
}, 8);

// 8. Phase 24 social: notification fanout in batches (never synchronous in API requests)
registerSocialEventHandlers();
QueueManager.registerWorker('social-fanout', async (job) => {
  const result = await SocialNotificationService.processFanoutBatch(job.data);
  return { status: 'FANNED_OUT', ...result };
}, 4);

// 9. Phase 24 social: scheduled creator/character actions (fully re-validated at execution time)
QueueManager.registerWorker('social-actions', async (job) => {
  return ScheduledSocialActionService.process(job.data);
}, 2);

// Sweeper: recovers lost scheduled jobs and expires stale message requests.
const socialSweeper = setInterval(() => {
  Promise.all([ScheduledSocialActionService.enqueueDue(), SocialMessagingService.expireStaleRequests()])
    .then(([due, expired]) => {
      if (due || expired) logger.info('[Worker:social-sweeper] swept', { due, expired });
    })
    .catch((err) => logger.warn('[Worker:social-sweeper] sweep failed', { error: err instanceof Error ? err.message : err }));
}, 5 * 60 * 1000);
socialSweeper.unref();

/** Runs a periodic job without overlap; failures are logged and never crash the worker. */
function every(name: string, ms: number, job: () => Promise<unknown>): NodeJS.Timeout {
  let running = false;
  const t = setInterval(() => {
    if (running) return;
    running = true;
    job()
      .then((r) => r && logger.debug(`[Worker:${name}]`, { result: r }))
      .catch((err) => logger.error(`[Worker:${name}] failed`, { error: err instanceof Error ? err.message : err }))
      .finally(() => {
        running = false;
      });
  }, ms);
  t.unref();
  return t;
}

// Transactional outbox relay (at-least-once; consumers are idempotent via receipts).
every('social-outbox-relay', 5_000, () => SocialEvents.relayPending(200));
every('social-outbox-retention', 24 * 3_600_000, () => SocialEvents.purgeExpired());
// Account deletion pipeline (leased, resumable) and its reconciliation.
every('account-deletion', 60_000, () => AccountDeletionService.processDue(10));
every('account-deletion-reconcile', 15 * 60_000, () => AccountDeletionService.reconcile());
// Social integrity checks (report + unambiguous repairs only).
every('social-integrity', 60 * 60_000, () => SocialIntegrityService.run({ repair: true }));

logger.info('✅ All background queue workers initialized and listening for jobs.');

// Graceful Worker Process Shutdown
let isWorkerShuttingDown = false;

const shutdownWorker = async (signal: string) => {
  if (isWorkerShuttingDown) return;
  isWorkerShuttingDown = true;

  logger.warn(`[Worker] Received ${signal}, starting graceful worker shutdown...`);

  const forceTimer = setTimeout(() => {
    logger.error('[Worker] Graceful shutdown timeout exceeded, forcing exit');
    process.exit(1);
  }, env.SHUTDOWN_TIMEOUT_MS);

  try {
    await QueueManager.closeAll();
    await Promise.allSettled([disconnectDatabase(), disconnectRedis()]);
    logger.info('[Worker] All workers and connections drained and stopped cleanly.');
    clearTimeout(forceTimer);
    process.exit(0);
  } catch (err) {
    logger.error('[Worker] Error during worker shutdown', { error: err });
    clearTimeout(forceTimer);
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdownWorker('SIGTERM'));
process.on('SIGINT', () => shutdownWorker('SIGINT'));
