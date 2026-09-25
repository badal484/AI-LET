import { describe, it, expect } from 'vitest';
import { HealthService } from '../src/modules/health/health.service.js';
import { KillSwitchService } from '../src/infrastructure/resilience/KillSwitchService.js';

describe('Health Probes & Kill Switches', () => {
  it('returns valid liveness probe status and event loop lag', async () => {
    const liveness = await HealthService.getLiveness();
    expect(liveness.status).toBe('alive');
    expect(typeof liveness.eventLoopLagMs).toBe('number');
    expect(typeof liveness.uptimeSeconds).toBe('number');
  });

  it('returns valid readiness probe status', async () => {
    const readiness = await HealthService.getReadiness();
    expect(['ready', 'not_ready']).toContain(readiness.status);
    expect(typeof readiness.database.isHealthy).toBe('boolean');
  });

  it('exports valid Prometheus metrics text format', async () => {
    const metrics = await HealthService.getPrometheusMetrics();
    expect(metrics).toContain('# HELP process_uptime_seconds');
    expect(metrics).toContain('database_is_healthy');
    expect(metrics).toContain('redis_is_healthy');
  });

  it('manages operational kill switches safely with defaults', async () => {
    const switches = await KillSwitchService.getAllKillSwitches();
    expect(switches.length).toBeGreaterThanOrEqual(5);

    const isMediaDisabled = await KillSwitchService.isKillSwitchActive('DISABLE_MEDIA_GENERATION');
    expect(typeof isMediaDisabled).toBe('boolean');
  });
});
