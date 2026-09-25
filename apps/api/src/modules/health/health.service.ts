import { checkDatabaseHealth } from '../../infrastructure/database/prisma.js';
import { checkRedisHealth } from '../../infrastructure/redis/redis.js';
import { CircuitBreaker } from '../../infrastructure/resilience/CircuitBreaker.js';
import { QueueManager } from '../../infrastructure/queues/QueueManager.js';
import { KillSwitchService } from '../../infrastructure/resilience/KillSwitchService.js';
import { env } from '../../config/env.js';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptimeSeconds: number;
  timestamp: string;
  environment: string;
  version: string;
  services: {
    database: { isHealthy: boolean; latencyMs: number; error?: string };
    redis: { isHealthy: boolean; latencyMs: number; error?: string };
  };
}

export interface DeepDiagnosticsResult extends HealthCheckResult {
  host: {
    memoryRssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
    eventLoopLagMs: number;
  };
  circuitBreakers: Array<{
    name: string;
    state: string;
    failureCount: number;
    lastFailureAt: string | null;
  }>;
  queues: Array<{
    name: string;
    waiting: number;
    active: number;
    failed: number;
    dlqCount: number;
  }>;
  killSwitches: Array<{
    key: string;
    isEnabled: boolean;
  }>;
}

export class HealthService {
  /**
   * Fast Liveness Probe: Verifies Node.js process is executing and event loop is responsive.
   */
  public static async getLiveness(): Promise<{ status: 'alive'; eventLoopLagMs: number; uptimeSeconds: number }> {
    const start = Date.now();
    await new Promise((r) => setImmediate(r));
    const lagMs = Date.now() - start;

    return {
      status: 'alive',
      eventLoopLagMs: lagMs,
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  /**
   * Fast Readiness Probe: Verifies database is reachable to accept user traffic.
   */
  public static async getReadiness(): Promise<{ status: 'ready' | 'not_ready'; database: { isHealthy: boolean; latencyMs: number } }> {
    const dbHealth = await checkDatabaseHealth();
    return {
      status: dbHealth.isHealthy ? 'ready' : 'not_ready',
      database: {
        isHealthy: dbHealth.isHealthy,
        latencyMs: dbHealth.latencyMs,
      },
    };
  }

  /**
   * Standard Health Check Endpoint.
   */
  public static async getHealth(): Promise<HealthCheckResult> {
    const [dbHealth, redisHealth] = await Promise.all([checkDatabaseHealth(), checkRedisHealth()]);

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (!dbHealth.isHealthy && !redisHealth.isHealthy) {
      status = 'unhealthy';
    } else if (!dbHealth.isHealthy || !redisHealth.isHealthy) {
      status = 'degraded';
    }

    return {
      status,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      version: '0.1.0',
      services: {
        database: dbHealth,
        redis: redisHealth,
      },
    };
  }

  /**
   * Deep Diagnostics: Comprehensive dependency health inspection.
   */
  public static async getDeepDiagnostics(): Promise<DeepDiagnosticsResult> {
    const startLoop = Date.now();
    await new Promise((r) => setImmediate(r));
    const eventLoopLagMs = Date.now() - startLoop;

    const mem = process.memoryUsage();

    const [health, queueMetrics, killSwitches] = await Promise.all([
      this.getHealth(),
      QueueManager.getQueueMetrics(),
      KillSwitchService.getAllKillSwitches(),
    ]);

    const circuitBreakers = CircuitBreaker.getAllStats().map((cb) => ({
      name: cb.name,
      state: cb.state,
      failureCount: cb.failureCount,
      lastFailureAt: cb.lastFailureAt,
    }));

    return {
      ...health,
      host: {
        memoryRssMb: Math.round(mem.rss / (1024 * 1024)),
        heapUsedMb: Math.round(mem.heapUsed / (1024 * 1024)),
        heapTotalMb: Math.round(mem.heapTotal / (1024 * 1024)),
        eventLoopLagMs,
      },
      circuitBreakers,
      queues: queueMetrics.map((q) => ({
        name: q.name,
        waiting: q.waiting,
        active: q.active,
        failed: q.failed,
        dlqCount: q.dlqCount,
      })),
      killSwitches: killSwitches.map((ks) => ({
        key: ks.key,
        isEnabled: ks.isEnabled,
      })),
    };
  }

  /**
   * Prometheus format metrics text for scraping.
   */
  public static async getPrometheusMetrics(): Promise<string> {
    const mem = process.memoryUsage();
    const [dbHealth, redisHealth, queueMetrics] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth(),
      QueueManager.getQueueMetrics(),
    ]);

    const lines: string[] = [
      '# HELP process_uptime_seconds Total process uptime in seconds',
      '# TYPE process_uptime_seconds gauge',
      `process_uptime_seconds ${process.uptime()}`,
      '',
      '# HELP nodejs_heap_size_used_bytes Total heap memory currently used in bytes',
      '# TYPE nodejs_heap_size_used_bytes gauge',
      `nodejs_heap_size_used_bytes ${mem.heapUsed}`,
      '',
      '# HELP nodejs_memory_rss_bytes Resident Set Size in bytes',
      '# TYPE nodejs_memory_rss_bytes gauge',
      `nodejs_memory_rss_bytes ${mem.rss}`,
      '',
      '# HELP database_is_healthy 1 if database reachable, 0 otherwise',
      '# TYPE database_is_healthy gauge',
      `database_is_healthy ${dbHealth.isHealthy ? 1 : 0}`,
      `database_latency_ms ${dbHealth.latencyMs}`,
      '',
      '# HELP redis_is_healthy 1 if redis reachable, 0 otherwise',
      '# TYPE redis_is_healthy gauge',
      `redis_is_healthy ${redisHealth.isHealthy ? 1 : 0}`,
      `redis_latency_ms ${redisHealth.latencyMs}`,
    ];

    for (const q of queueMetrics) {
      lines.push(
        `queue_waiting_jobs{queue="${q.name}"} ${q.waiting}`,
        `queue_active_jobs{queue="${q.name}"} ${q.active}`,
        `queue_failed_jobs{queue="${q.name}"} ${q.failed}`,
        `queue_dlq_jobs{queue="${q.name}"} ${q.dlqCount}`,
      );
    }

    return lines.join('\n');
  }
}
