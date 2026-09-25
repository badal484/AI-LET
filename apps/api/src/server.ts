import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { disconnectDatabase } from './infrastructure/database/prisma.js';
import { disconnectRedis } from './infrastructure/redis/redis.js';
import { API_CONSTANTS } from './config/constants.js';
import { VoiceWebSocketServer } from './modules/voice/realtime/VoiceWebSocketServer.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`🚀 AI Companion Backend service started on port ${env.PORT} [${env.NODE_ENV}]`);
  logger.info(
    `📡 Health endpoints available at http://localhost:${env.PORT}/health and http://localhost:${env.PORT}${env.API_PREFIX}/health`,
  );
});

// Initialize Phase 9 Real-Time Voice WebSocket Server
VoiceWebSocketServer.getInstance().initialize(server);

let isShuttingDown = false;

const gracefulShutdown = async (signal: string): Promise<void> => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.warn(`Received ${signal}, initiating graceful shutdown...`);

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
  logger.error('Uncaught Exception occurred:', { error: err.message, stack: err.stack });
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled Promise Rejection:', { reason });
});
