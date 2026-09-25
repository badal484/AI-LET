import { Queue, Worker, Job } from 'bullmq';
import { redis } from '../redis/redis.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

export type QueueName =
  | 'billing-webhooks'
  | 'notifications'
  | 'chat-ai'
  | 'memory-extraction'
  | 'media-generation'
  | 'analytics-events'
  | 'discovery-indexing'
  | 'social-fanout'
  | 'social-actions'
  | 'character-simulation'
  | 'simulation-evaluation'
  | 'routine-scheduler'
  | 'simulation-reconciliation'
  | 'simulation-cleanup';

export type JobPriority = 'CRITICAL' | 'NORMAL' | 'LOW';

export type JobErrorCategory = 'TRANSIENT' | 'PERMANENT' | 'AUTHENTICATION' | 'RATE_LIMITED' | 'UNKNOWN';

export interface DeadLetterJobSummary {
  id: string;
  queueName: QueueName;
  name: string;
  data: any;
  errorCategory: JobErrorCategory;
  failedReason: string;
  attemptsMade: number;
  timestamp: string;
}

export class QueueManager {
  private static queues: Map<QueueName, Queue> = new Map();
  private static workers: Map<QueueName, Worker> = new Map();
  private static deadLetterStore: Map<string, DeadLetterJobSummary> = new Map();

  private static getRedisConnection() {
    return {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD || undefined,
      db: env.REDIS_DB,
    };
  }

  /**
   * Initializes or retrieves a named BullMQ queue with configured retry and retention policies.
   */
  public static getQueue(name: QueueName): Queue {
    if (this.queues.has(name)) {
      return this.queues.get(name)!;
    }

    const queue = new Queue(name, {
      connection: this.getRedisConnection(),
      defaultJobOptions: {
        attempts: name === 'billing-webhooks' ? 5 : 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: { count: 1000, age: 3600 * 24 }, // retain 24h
        removeOnFail: false, // retain failed jobs for DLQ inspection
      },
    });

    this.queues.set(name, queue);
    return queue;
  }

  /**
   * Enqueues a job with priority and idempotency key support.
   */
  public static async addJob<T = any>(
    queueName: QueueName,
    jobName: string,
    data: T,
    options: {
      priority?: JobPriority;
      idempotencyKey?: string;
      delayMs?: number;
    } = {},
  ): Promise<Job<T> | null> {
    const queue = this.getQueue(queueName);

    // Idempotency check: if key already processed in last 1 hour, skip duplicate
    if (options.idempotencyKey) {
      const lockKey = `queue:idempotency:${queueName}:${options.idempotencyKey}`;
      const existing = await redis.get(lockKey);
      if (existing) {
        logger.warn(`[QueueManager] Duplicate job '${jobName}' suppressed by idempotency key: ${options.idempotencyKey}`);
        return null;
      }
      // Set lock with 1h TTL
      await redis.set(lockKey, 'ENQUEUED', 'EX', 3600);
    }

    const priorityValue =
      options.priority === 'CRITICAL' ? 1 : options.priority === 'LOW' ? 10 : 5;

    const job = await queue.add(jobName, data, {
      priority: priorityValue,
      delay: options.delayMs || 0,
      jobId: options.idempotencyKey || undefined,
    });

    return job;
  }

  /**
   * Categorizes errors to prevent infinite retries on permanent failures.
   */
  public static categorizeError(err: Error): JobErrorCategory {
    const msg = err.message.toLowerCase();
    if (msg.includes('rate limit') || msg.includes('429')) return 'RATE_LIMITED';
    if (msg.includes('401') || msg.includes('403') || msg.includes('unauthorized') || msg.includes('forbidden')) {
      return 'AUTHENTICATION';
    }
    if (msg.includes('validation') || msg.includes('not found') || msg.includes('invalid') || msg.includes('schema')) {
      return 'PERMANENT';
    }
    if (msg.includes('timeout') || msg.includes('econnrefused') || msg.includes('500') || msg.includes('502') || msg.includes('503')) {
      return 'TRANSIENT';
    }
    return 'UNKNOWN';
  }

  /**
   * Registers a worker processor with error tracking and Dead Letter Queue capturing.
   */
  public static registerWorker<T = any>(
    queueName: QueueName,
    processor: (job: Job<T>) => Promise<any>,
    concurrency = 5,
  ): Worker<T> {
    if (this.workers.has(queueName)) {
      return this.workers.get(queueName) as Worker<T>;
    }

    const worker = new Worker<T>(
      queueName,
      async (job) => {
        try {
          return await processor(job);
        } catch (err: any) {
          const category = this.categorizeError(err);
          logger.error(`[QueueWorker:${queueName}] Job ${job.id} (${job.name}) failed: [${category}] ${err.message}`);

          // If permanent error, do not retry further
          if (category === 'PERMANENT' || category === 'AUTHENTICATION') {
            job.discard(); // prevents further BullMQ retries
          }

          throw err;
        }
      },
      {
        connection: this.getRedisConnection(),
        concurrency,
        limiter: {
          max: queueName === 'chat-ai' ? 50 : 200,
          duration: 1000,
        },
      },
    );

    worker.on('failed', (job, err) => {
      if (!job) return;
      if (job.attemptsMade >= (job.opts.attempts || 3) || this.categorizeError(err) === 'PERMANENT') {
        const errorCategory = this.categorizeError(err);
        const dlqEntry: DeadLetterJobSummary = {
          id: String(job.id),
          queueName,
          name: job.name,
          data: job.data,
          errorCategory,
          failedReason: err.message,
          attemptsMade: job.attemptsMade,
          timestamp: new Date().toISOString(),
        };

        this.deadLetterStore.set(dlqEntry.id, dlqEntry);
        logger.error(`[QueueDLQ] Job ${job.id} moved to Dead Letter Queue`, {
          queueName,
          errorCategory,
          reason: err.message,
        });
      }
    });

    this.workers.set(queueName, worker);
    return worker;
  }

  /**
   * Admin API: Returns all DLQ jobs across queues.
   */
  public static getDeadLetterJobs(): DeadLetterJobSummary[] {
    return Array.from(this.deadLetterStore.values());
  }

  /**
   * Admin API: Retries a job from the DLQ.
   */
  public static async retryDeadLetterJob(jobId: string): Promise<boolean> {
    const job = this.deadLetterStore.get(jobId);
    if (!job) return false;

    await this.addJob(job.queueName, job.name, job.data, {
      priority: 'CRITICAL',
    });

    this.deadLetterStore.delete(jobId);
    logger.info(`[QueueDLQ] Job ${jobId} re-enqueued for retry`);
    return true;
  }

  /**
   * Admin API: Clears a DLQ job.
   */
  public static clearDeadLetterJob(jobId: string): boolean {
    return this.deadLetterStore.delete(jobId);
  }

  /**
   * Retrieves live metrics (waiting, active, completed, failed) across all registered queues.
   */
  public static async getQueueMetrics(): Promise<
    Array<{
      name: QueueName;
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
      dlqCount: number;
    }>
  > {
    const queueNames: QueueName[] = [
      'billing-webhooks',
      'notifications',
      'chat-ai',
      'memory-extraction',
      'media-generation',
      'analytics-events',
      'discovery-indexing',
    ];

    const results = await Promise.all(
      queueNames.map(async (name) => {
        const queue = this.getQueue(name);
        try {
          const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
          const dlqCount = Array.from(this.deadLetterStore.values()).filter(j => j.queueName === name).length;
          return {
            name,
            waiting: counts['waiting'] || 0,
            active: counts['active'] || 0,
            completed: counts['completed'] || 0,
            failed: counts['failed'] || 0,
            delayed: counts['delayed'] || 0,
            dlqCount,
          };
        } catch {
          return {
            name,
            waiting: 0,
            active: 0,
            completed: 0,
            failed: 0,
            delayed: 0,
            dlqCount: 0,
          };
        }
      }),
    );

    return results;
  }

  /**
   * Gracefully shuts down all queue workers and closes connections.
   */
  public static async closeAll(): Promise<void> {
    logger.info('[QueueManager] Draining and closing workers and queues...');
    const workerPromises = Array.from(this.workers.values()).map(w => w.close());
    const queuePromises = Array.from(this.queues.values()).map(q => q.close());
    await Promise.allSettled([...workerPromises, ...queuePromises]);
    logger.info('[QueueManager] All queues and workers closed cleanly.');
  }
}
