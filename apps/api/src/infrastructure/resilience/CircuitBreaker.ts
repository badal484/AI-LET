import { logger } from '../../config/logger.js';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  name: string;
  failureThreshold?: number; // e.g., 5 consecutive failures
  cooldownPeriodMs?: number; // e.g., 30000 ms (30s) before half-open test
  timeoutMs?: number; // per-call timeout
  fallback?: <T>(err: Error) => Promise<T> | T;
}

export interface CircuitBreakerStats {
  name: string;
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureAt: string | null;
  lastStateChangeAt: string;
}

export class CircuitBreaker {
  private static registry: Map<string, CircuitBreaker> = new Map();

  public readonly name: string;
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private readonly failureThreshold: number;
  private readonly cooldownPeriodMs: number;
  private readonly timeoutMs: number;
  private lastFailureTime: number | null = null;
  private lastStateChangeTime: number = Date.now();

  constructor(options: CircuitBreakerOptions) {
    this.name = options.name;
    this.failureThreshold = options.failureThreshold || 5;
    this.cooldownPeriodMs = options.cooldownPeriodMs || 30000;
    this.timeoutMs = options.timeoutMs || 15000;

    CircuitBreaker.registry.set(this.name, this);
  }

  public static get(name: string): CircuitBreaker | undefined {
    return CircuitBreaker.registry.get(name);
  }

  public static getAllStats(): CircuitBreakerStats[] {
    return Array.from(CircuitBreaker.registry.values()).map(cb => cb.getStats());
  }

  public static resetAll(): void {
    for (const cb of CircuitBreaker.registry.values()) {
      cb.reset();
    }
  }

  public getStats(): CircuitBreakerStats {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureAt: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
      lastStateChangeAt: new Date(this.lastStateChangeTime).toISOString(),
    };
  }

  public reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.lastStateChangeTime = Date.now();
    logger.info(`[CircuitBreaker:${this.name}] Manually reset to CLOSED state`);
  }

  public forceOpen(): void {
    this.state = 'OPEN';
    this.lastFailureTime = Date.now();
    this.lastStateChangeTime = Date.now();
    logger.warn(`[CircuitBreaker:${this.name}] Forced OPEN state`);
  }

  public async execute<T>(action: () => Promise<T>, fallback?: (err: Error) => Promise<T> | T): Promise<T> {
    const now = Date.now();

    // Check if cooldown has passed while OPEN -> switch to HALF_OPEN
    if (this.state === 'OPEN') {
      const referenceTime = this.lastFailureTime || this.lastStateChangeTime;
      if (now - referenceTime >= this.cooldownPeriodMs) {
        this.state = 'HALF_OPEN';
        this.lastStateChangeTime = now;
        logger.info(`[CircuitBreaker:${this.name}] Cooldown expired. Testing health in HALF_OPEN state.`);
      } else {
        const error = new Error(`Circuit breaker '${this.name}' is OPEN. Fast failing request.`);
        logger.warn(`[CircuitBreaker:${this.name}] Request rejected in OPEN state`);
        if (fallback) {
          return fallback(error);
        }
        throw error;
      }
    }

    try {
      // Execute with timeout deadline
      const result = await this.executeWithTimeout(action, this.timeoutMs);
      this.onSuccess();
      return result;
    } catch (err: any) {
      this.onFailure(err);
      if (fallback) {
        logger.info(`[CircuitBreaker:${this.name}] Invoking fallback handler`);
        return fallback(err);
      }
      throw err;
    }
  }

  private onSuccess(): void {
    this.successCount++;
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.failureCount = 0;
      this.lastStateChangeTime = Date.now();
      logger.info(`[CircuitBreaker:${this.name}] Test request succeeded! Circuit CLOSED.`);
    }
  }

  private onFailure(err: Error): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN' || this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.lastStateChangeTime = Date.now();
      logger.error(`[CircuitBreaker:${this.name}] Failure threshold reached (${this.failureCount} errors). Circuit OPENED!`, {
        error: err.message,
      });
    }
  }

  private executeWithTimeout<T>(action: () => Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let timer: NodeJS.Timeout | null = setTimeout(() => {
        timer = null;
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      action()
        .then(res => {
          if (timer) {
            clearTimeout(timer);
            resolve(res);
          }
        })
        .catch(err => {
          if (timer) {
            clearTimeout(timer);
            reject(err);
          }
        });
    });
  }
}
