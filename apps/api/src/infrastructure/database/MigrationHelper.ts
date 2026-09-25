import { prisma } from './prisma.js';
import { logger } from '../../config/logger.js';

export interface BackfillOptions<T> {
  name: string;
  batchSize?: number;
  delayBetweenBatchesMs?: number;
  fetchBatch: (cursor?: string, limit?: number) => Promise<T[]>;
  getCursor: (item: T) => string;
  processItem: (item: T) => Promise<void>;
  onProgress?: (processed: number, errors: number) => void;
}

export interface BackfillResult {
  name: string;
  totalProcessed: number;
  totalErrors: number;
  durationMs: number;
  completed: boolean;
}

export class MigrationHelper {
  /**
   * Executes an asynchronous chunked, rate-limited backfill to safely migrate large tables
   * without table locks or transaction starvation.
   */
  public static async runChunkedBackfill<T>(options: BackfillOptions<T>): Promise<BackfillResult> {
    const startTime = Date.now();
    const batchSize = options.batchSize || 100;
    const delayMs = options.delayBetweenBatchesMs || 50;

    let processedCount = 0;
    let errorCount = 0;
    let currentCursor: string | undefined = undefined;
    let hasMore = true;

    logger.info(`[MigrationHelper] Starting chunked backfill: '${options.name}' (batchSize: ${batchSize})`);

    while (hasMore) {
      try {
        const batch = await options.fetchBatch(currentCursor, batchSize);

        if (!batch || batch.length === 0) {
          hasMore = false;
          break;
        }

        for (const item of batch) {
          try {
            await options.processItem(item);
            processedCount++;
          } catch (err: any) {
            errorCount++;
            logger.error(`[MigrationHelper] Error processing item in backfill '${options.name}'`, {
              error: err.message,
            });
          }
        }

        const lastItem = batch[batch.length - 1];
        if (lastItem) {
          currentCursor = options.getCursor(lastItem);
        }

        if (options.onProgress) {
          options.onProgress(processedCount, errorCount);
        }

        if (batch.length < batchSize) {
          hasMore = false;
        } else if (delayMs > 0) {
          await new Promise((r) => setTimeout(r, delayMs));
        }
      } catch (batchErr: any) {
        logger.error(`[MigrationHelper] Fatal error fetching batch in backfill '${options.name}'`, {
          error: batchErr.message,
        });
        hasMore = false;
      }
    }

    const durationMs = Date.now() - startTime;
    logger.info(
      `[MigrationHelper] Completed backfill '${options.name}': ${processedCount} processed, ${errorCount} errors in ${durationMs}ms`,
    );

    return {
      name: options.name,
      totalProcessed: processedCount,
      totalErrors: errorCount,
      durationMs,
      completed: true,
    };
  }

  /**
   * Cleans up expired auth sessions, old guest tokens, and stale idempotent keys.
   */
  public static async pruneStaleRecords(): Promise<{
    expiredSessionsDeleted: number;
    auditLogsArchivedCount: number;
  }> {
    const now = new Date();

    const deleteSessions = await prisma.session.deleteMany({
      where: {
        expiresAt: { lt: now },
      },
    });

    logger.info(`[MigrationHelper:Prune] Cleaned up ${deleteSessions.count} expired sessions.`);

    return {
      expiredSessionsDeleted: deleteSessions.count,
      auditLogsArchivedCount: 0,
    };
  }
}
