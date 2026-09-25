import { redisClient } from '../../../infrastructure/redis/redisClient.js';
import { AICircuitBreakerStatus } from '@ai-companion/types';
import { SYSTEM_CONSTANTS } from '@ai-companion/config';
import { logger } from '../../../shared/utils/logger.js';

interface InMemoryBreakerState {
  failures: number;
  successes: number;
  lastFailureTime: number;
  state: AICircuitBreakerStatus;
}

export class CircuitBreakerService {
  private static instance: CircuitBreakerService;
  private localStates: Map<string, InMemoryBreakerState> = new Map();

  private readonly failureThreshold = 5;
  private readonly recoveryTimeoutMs = (SYSTEM_CONSTANTS.AI_QUALITY?.CIRCUIT_BREAKER?.COOLDOWN_SECONDS || 30) * 1000;
  private readonly canarySuccessThreshold = SYSTEM_CONSTANTS.AI_QUALITY?.CIRCUIT_BREAKER?.HALF_OPEN_SUCCESS_REQUIRED || 2;

  private constructor() {}

  public static getInstance(): CircuitBreakerService {
    if (!CircuitBreakerService.instance) {
      CircuitBreakerService.instance = new CircuitBreakerService();
    }
    return CircuitBreakerService.instance;
  }

  private getKey(provider: string, model: string): string {
    return `circuit:${provider}:${model}`;
  }

  public async getStatus(provider: string, model: string): Promise<AICircuitBreakerStatus> {
    const key = this.getKey(provider, model);

    // Try Redis first
    if (redisClient.isOpen) {
      try {
        const state = await redisClient.get(`${key}:state`);
        const lastFail = await redisClient.get(`${key}:last_failure`);
        if (state === 'OPEN') {
          const lastFailTime = lastFail ? parseInt(lastFail, 10) : 0;
          if (Date.now() - lastFailTime > this.recoveryTimeoutMs) {
            // Transition to HALF_OPEN
            await redisClient.set(`${key}:state`, 'HALF_OPEN');
            return 'HALF_OPEN';
          }
          return 'OPEN';
        }
        if (state === 'HALF_OPEN') return 'HALF_OPEN';
        return 'CLOSED';
      } catch (err: any) {
        logger.warn(`CircuitBreaker redis check failed, using local: ${err?.message}`);
      }
    }

    // Local fallback
    let local = this.localStates.get(key);
    if (!local) {
      local = { failures: 0, successes: 0, lastFailureTime: 0, state: 'CLOSED' };
      this.localStates.set(key, local);
    }

    if (local.state === 'OPEN') {
      if (Date.now() - local.lastFailureTime > this.recoveryTimeoutMs) {
        local.state = 'HALF_OPEN';
        local.successes = 0;
      }
    }

    return local.state;
  }

  public async recordSuccess(provider: string, model: string): Promise<void> {
    const key = this.getKey(provider, model);

    if (redisClient.isOpen) {
      try {
        const state = await redisClient.get(`${key}:state`);
        if (state === 'HALF_OPEN') {
          const successes = await redisClient.incr(`${key}:canary_successes`);
          if (successes >= this.canarySuccessThreshold) {
            await redisClient.set(`${key}:state`, 'CLOSED');
            await redisClient.del(`${key}:failures`);
            await redisClient.del(`${key}:canary_successes`);
            logger.info(`Circuit breaker reset to CLOSED for ${provider}/${model}`);
          }
        } else {
          await redisClient.del(`${key}:failures`);
        }
      } catch (err: any) {
        logger.warn(`CircuitBreaker redis recordSuccess failed: ${err?.message}`);
      }
    }

    const local = this.localStates.get(key);
    if (local) {
      if (local.state === 'HALF_OPEN') {
        local.successes++;
        if (local.successes >= this.canarySuccessThreshold) {
          local.state = 'CLOSED';
          local.failures = 0;
          local.successes = 0;
        }
      } else {
        local.failures = 0;
      }
    }
  }

  public async recordFailure(provider: string, model: string): Promise<void> {
    const key = this.getKey(provider, model);
    const now = Date.now();

    if (redisClient.isOpen) {
      try {
        const failures = await redisClient.incr(`${key}:failures`);
        await redisClient.set(`${key}:last_failure`, now.toString());
        await redisClient.expire(`${key}:failures`, 120);

        if (failures >= this.failureThreshold) {
          await redisClient.set(`${key}:state`, 'OPEN');
          logger.warn(`Circuit breaker tripped to OPEN for ${provider}/${model} (${failures} failures)`);
        }
      } catch (err: any) {
        logger.warn(`CircuitBreaker redis recordFailure failed: ${err?.message}`);
      }
    }

    let local = this.localStates.get(key);
    if (!local) {
      local = { failures: 0, successes: 0, lastFailureTime: 0, state: 'CLOSED' };
      this.localStates.set(key, local);
    }

    local.failures++;
    local.lastFailureTime = now;

    if (local.failures >= this.failureThreshold || local.state === 'HALF_OPEN') {
      local.state = 'OPEN';
      logger.warn(`Circuit breaker tripped to OPEN locally for ${provider}/${model}`);
    }
  }

  public async reset(provider: string, model: string): Promise<void> {
    const key = this.getKey(provider, model);
    if (redisClient.isOpen) {
      try {
        await redisClient.del(`${key}:state`);
        await redisClient.del(`${key}:failures`);
        await redisClient.del(`${key}:last_failure`);
        await redisClient.del(`${key}:canary_successes`);
      } catch {
        // ignore
      }
    }
    this.localStates.set(key, { failures: 0, successes: 0, lastFailureTime: 0, state: 'CLOSED' });
  }
}
