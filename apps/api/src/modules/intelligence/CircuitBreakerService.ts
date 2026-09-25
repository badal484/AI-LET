import { CircuitBreakerStatus, CircuitBreakerUpdateInput } from '@ai-companion/types';
import { INTELLIGENCE_CONSTANTS } from '@ai-companion/config';
import { logger } from '../../shared/utils/logger.js';

export class CircuitBreakerService {
  private static instance: CircuitBreakerService;

  private readonly breakers: Map<string, CircuitBreakerStatus> = new Map();

  private constructor() {
    this.initializeDefaultBreakers();
  }

  public static getInstance(): CircuitBreakerService {
    if (!CircuitBreakerService.instance) {
      CircuitBreakerService.instance = new CircuitBreakerService();
    }
    return CircuitBreakerService.instance;
  }

  private initializeDefaultBreakers() {
    const defaults: CircuitBreakerStatus[] = [
      {
        name: 'AI_COST_CIRCUIT_BREAKER',
        isTripped: false,
        threshold: INTELLIGENCE_CONSTANTS.CIRCUIT_BREAKERS.DAILY_COST_LIMIT_USD,
        currentValue: 42.15,
        metricUnit: 'USD/day',
        trippedAt: null,
        actionTaken: 'Gracefully degrades heavy models to lightweight/fast fallback',
      },
      {
        name: 'AI_QUALITY_CIRCUIT_BREAKER',
        isTripped: false,
        threshold: INTELLIGENCE_CONSTANTS.CIRCUIT_BREAKERS.QUALITY_MIN_COMPOSITE_SCORE,
        currentValue: 0.88,
        metricUnit: 'Composite Rubric Score (0-1)',
        trippedAt: null,
        actionTaken: 'Halts canary rollout and reverts to stable baseline model',
      },
      {
        name: 'SAFETY_REGRESSION_CIRCUIT_BREAKER',
        isTripped: false,
        threshold: INTELLIGENCE_CONSTANTS.CIRCUIT_BREAKERS.SAFETY_INCIDENT_MAX_PER_HOUR,
        currentValue: 0,
        metricUnit: 'Incidents/hour',
        trippedAt: null,
        actionTaken: 'Immediately halts deployment and alerts on-call safety commander',
      },
    ];

    for (const b of defaults) {
      this.breakers.set(b.name, b);
    }
  }

  /**
   * Retrieves all circuit breaker statuses
   */
  public getStatuses(): CircuitBreakerStatus[] {
    return Array.from(this.breakers.values());
  }

  /**
   * Checks if a specific circuit breaker is currently tripped
   */
  public isTripped(name: string): boolean {
    const breaker = this.breakers.get(name);
    return breaker ? breaker.isTripped : false;
  }

  /**
   * Records a spend increment and checks against cost threshold
   */
  public recordSpend(costUsd: number): boolean {
    const breaker = this.breakers.get('AI_COST_CIRCUIT_BREAKER');
    if (!breaker) return false;

    breaker.currentValue = Math.round((breaker.currentValue + costUsd) * 1000) / 1000;
    if (breaker.currentValue >= breaker.threshold && !breaker.isTripped) {
      breaker.isTripped = true;
      breaker.trippedAt = new Date().toISOString();
      logger.warn(`AI_COST_CIRCUIT_BREAKER TRIPPED! Daily cost: $${breaker.currentValue} (Threshold: $${breaker.threshold})`);
    }

    return breaker.isTripped;
  }

  /**
   * Updates or overrides a circuit breaker status
   */
  public updateStatus(input: CircuitBreakerUpdateInput): CircuitBreakerStatus {
    let breaker = this.breakers.get(input.name);
    if (!breaker) {
      breaker = {
        name: input.name,
        isTripped: input.isTripped,
        threshold: input.threshold || 100,
        currentValue: 0,
        metricUnit: 'unit',
        trippedAt: input.isTripped ? new Date().toISOString() : null,
        actionTaken: 'Custom manual circuit action',
      };
    } else {
      breaker.isTripped = input.isTripped;
      if (input.threshold !== undefined) breaker.threshold = input.threshold;
      breaker.trippedAt = input.isTripped ? new Date().toISOString() : null;
    }

    this.breakers.set(breaker.name, breaker);
    logger.info(`Circuit breaker [${breaker.name}] updated: isTripped=${breaker.isTripped} (Reason: ${input.reason})`);
    return breaker;
  }
}
