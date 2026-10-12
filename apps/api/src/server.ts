import { createApp } from './app.js';
import { Realtime } from './infrastructure/realtime/realtime.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { disconnectDatabase } from './infrastructure/database/prisma.js';
import { disconnectRedis } from './infrastructure/redis/redis.js';
import { API_CONSTANTS } from './config/constants.js';
import { flushSentry, initSentry, reportError } from './infrastructure/monitoring/sentry.js';

initSentry('api');
const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`🚀 AI Companion Backend service started on port ${env.PORT} [${env.NODE_ENV}]`);
  logger.info(
    `📡 Health endpoints available at http://localhost:${env.PORT}/health and http://localhost:${env.PORT}${env.API_PREFIX}/health`,
  );
});
// Live updates for open apps (typing in the Chats list, new messages, unread counts).
Realtime.attach(server);

// Render's free plan sleeps the API after 15 minutes without outside requests, and waking takes ~1 minute
// (sign-in fails meanwhile). On Render (RENDER_EXTERNAL_URL is set by Render) it calls its own public
// address every 10 minutes, which counts as a visit. /health/live doesn't touch the database, so Neon can
// still sleep. KEEP_AWAKE=false turns it off — not needed on a paid Render plan.
const publicUrl = process.env['RENDER_EXTERNAL_URL'];
if (publicUrl && process.env['KEEP_AWAKE'] !== 'false') {
  const ping = () => void fetch(`${publicUrl}/health/live`, { signal: AbortSignal.timeout(30_000) }).catch(() => undefined);
  setInterval(ping, 10 * 60_000).unref();
  logger.info(`Keep-awake: pinging ${publicUrl}/health/live every 10 minutes`);
}


let isShuttingDown = false;

const gracefulShutdown = async (signal: string): Promise<void> => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.warn(`Received ${signal}, initiating graceful shutdown...`);
  await flushSentry();

  const forceTimer = setTimeout(() => {
    logger.error('Graceful shutdown timeout exceeded, forcing exit');
    process.exit(1);
  }, API_CONSTANTS.SHUTDOWN.GRACEFUL_TIMEOUT_MS);

  server.close(async () => {
    logger.info('HTTP server closed, draining connections...');
    try {
      await Promise.allSettled([disconnectDatabase(), disconnectRedis()]);
      logger.info('Infrastructure connections closed cleanly');
      clearTimeout(forceTimer);
      process.exit(0);
    } catch (err) {
      logger.error('Error during infrastructure disconnection', { error: err });
      clearTimeout(forceTimer);
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err: Error) => {
  reportError(err, { kind: 'uncaughtException' });
  logger.error('Uncaught Exception occurred:', { error: err.message, stack: err.stack });
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason: unknown) => {
  reportError(reason, { kind: 'unhandledRejection' });
  logger.error('Unhandled Promise Rejection:', { reason });
});
