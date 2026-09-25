import { PrismaClient } from '@prisma/client';
import { logger } from '../../config/logger.js';

class DatabaseConnection {
  private static instance: PrismaClient | null = null;
  private static slowQueryThresholdMs = 500;

  public static getInstance(): PrismaClient {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new PrismaClient({
        log: [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'error' },
          { emit: 'event', level: 'warn' },
        ],
      });

      // Slow query detection (> 500ms) without logging sensitive query arguments
      // @ts-expect-error Prisma event typing
      DatabaseConnection.instance.$on('query', (e: { query: string; duration: number; timestamp: Date }) => {
        if (e.duration >= DatabaseConnection.slowQueryThresholdMs) {
          logger.warn(`[SlowQuery] PostgreSQL query took ${e.duration}ms: ${e.query.substring(0, 200)}...`);
        }
      });

      // @ts-expect-error Prisma event typing
      DatabaseConnection.instance.$on('error', (e: { message: string }) => {
        logger.error(`Prisma Error: ${e.message}`);
      });
    }

    return DatabaseConnection.instance;
  }

  public static async checkHealth(): Promise<{
    isHealthy: boolean;
    latencyMs: number;
    error?: string;
  }> {
    const start = Date.now();
    try {
      const p = DatabaseConnection.getInstance();
      await p.$queryRaw`SELECT 1`;
      return { isHealthy: true, latencyMs: Date.now() - start };
    } catch (err) {
      return {
        isHealthy: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : 'Database connection failed',
      };
    }
  }

  public static async disconnect(): Promise<void> {
    if (DatabaseConnection.instance) {
      await DatabaseConnection.instance.$disconnect();
      DatabaseConnection.instance = null;
      logger.info('Database disconnected cleanly');
    }
  }
}

export const prisma = DatabaseConnection.getInstance();
export const checkDatabaseHealth = DatabaseConnection.checkHealth;
export const disconnectDatabase = DatabaseConnection.disconnect;
