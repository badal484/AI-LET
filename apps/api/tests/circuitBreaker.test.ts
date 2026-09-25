import { describe, it, expect, beforeEach } from 'vitest';
import { CircuitBreaker } from '../src/infrastructure/resilience/CircuitBreaker.js';

describe('CircuitBreaker Resilience Pattern', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      name: 'test-service',
      failureThreshold: 3,
      cooldownPeriodMs: 200,
      timeoutMs: 500,
    });
    breaker.reset();
  });

  it('starts in CLOSED state and executes successful calls', async () => {
    const stats = breaker.getStats();
    expect(stats.state).toBe('CLOSED');

    const result = await breaker.execute(async () => 'success_data');
    expect(result).toBe('success_data');
    expect(breaker.getStats().successCount).toBe(1);
    expect(breaker.getStats().failureCount).toBe(0);
  });

  it('transitions to OPEN state after reaching failure threshold', async () => {
    const failingAction = async () => {
      throw new Error('Service Unavailable 503');
    };

    // 1st failure
    await expect(breaker.execute(failingAction)).rejects.toThrow('Service Unavailable 503');
    expect(breaker.getStats().state).toBe('CLOSED');

    // 2nd failure
    await expect(breaker.execute(failingAction)).rejects.toThrow('Service Unavailable 503');
    expect(breaker.getStats().state).toBe('CLOSED');

    // 3rd failure -> trips threshold -> OPEN
    await expect(breaker.execute(failingAction)).rejects.toThrow('Service Unavailable 503');
    expect(breaker.getStats().state).toBe('OPEN');

    // Subsequent request in OPEN state should fast-fail without calling action
    let actionCalled = false;
    await expect(
      breaker.execute(async () => {
        actionCalled = true;
        return 'data';
      }),
    ).rejects.toThrow(/is OPEN\. Fast failing/);
    expect(actionCalled).toBe(false);
  });

  it('executes fallback handler when provided', async () => {
    breaker.forceOpen();

    const fallbackResult = await breaker.execute(
      async () => 'primary_result',
      async () => 'safe_fallback_result',
    );

    expect(fallbackResult).toBe('safe_fallback_result');
  });

  it('transitions from OPEN to HALF_OPEN after cooldown period and resets to CLOSED on success', async () => {
    breaker.forceOpen();
    expect(breaker.getStats().state).toBe('OPEN');

    // Wait for cooldown
    await new Promise((r) => setTimeout(r, 250));

    // Next request should test in HALF_OPEN and succeed -> transition back to CLOSED
    const result = await breaker.execute(async () => 'recovered_data');
    expect(result).toBe('recovered_data');
    expect(breaker.getStats().state).toBe('CLOSED');
    expect(breaker.getStats().failureCount).toBe(0);
  });
});
