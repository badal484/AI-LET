import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import * as prismaInfra from '../src/infrastructure/database/prisma.js';
import * as redisInfra from '../src/infrastructure/redis/redis.js';

describe('Health Endpoints Integration', () => {
  const app = createApp();

  it('GET /health/live returns alive status with 200', async () => {
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('alive');
  });

  it('GET /health returns health metrics payload', async () => {
    vi.spyOn(prismaInfra, 'checkDatabaseHealth').mockResolvedValue({
      isHealthy: true,
      latencyMs: 5,
    });
    vi.spyOn(redisInfra, 'checkRedisHealth').mockResolvedValue({ isHealthy: true, latencyMs: 2 });

    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('healthy');
    expect(res.body.data.services.database.isHealthy).toBe(true);
    expect(res.body.data.services.redis.isHealthy).toBe(true);
  });

  it('GET /api/v1/health returns same health payload under versioned prefix', async () => {
    vi.spyOn(prismaInfra, 'checkDatabaseHealth').mockResolvedValue({
      isHealthy: true,
      latencyMs: 4,
    });
    vi.spyOn(redisInfra, 'checkRedisHealth').mockResolvedValue({ isHealthy: true, latencyMs: 1 });

    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /invalid-route returns 404 standard error envelope', async () => {
    const res = await request(app).get('/non-existent-route');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.headers['x-correlation-id']).toBeDefined();
  });
});
