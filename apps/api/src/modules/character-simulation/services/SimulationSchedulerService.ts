import { QueueManager } from '../../../infrastructure/queues/QueueManager.js';
import { redis } from '../../../infrastructure/redis/redis.js';
import { logger } from '../../../shared/utils/logger.js';
import { CharacterSimulationCycle } from './CharacterSimulationCycle.js';

export interface ScheduleSimulationJobInput {
  userId: string;
  characterId: string;
  triggerType: 'CONVERSATION' | 'ROUTINE' | 'GOAL_EVENT' | 'MANUAL' | 'RELATIONSHIP';
  triggerEventId?: string;
  delayMs?: number;
}

export class SimulationSchedulerService {
  private static instance: SimulationSchedulerService;

  private constructor() {}

  public static getInstance(): SimulationSchedulerService {
    if (!SimulationSchedulerService.instance) {
      SimulationSchedulerService.instance = new SimulationSchedulerService();
    }
    return SimulationSchedulerService.instance;
  }

  /**
   * Enqueues a simulation evaluation job with loop defense and debouncing.
   */
  public async scheduleSimulationCycle(input: ScheduleSimulationJobInput): Promise<boolean> {
    const { userId, characterId, triggerType, triggerEventId, delayMs = 0 } = input;
    const idempotencyKey = `sim_eval_${userId}_${characterId}_${triggerType}_${Date.now()}`;

    // Loop defense: check max transitions per 5-minute window
    const rateLimitKey = `sim:ratelimit:${userId}:${characterId}`;
    try {
      if (redis.status === 'ready') {
        const count = await redis.incr(rateLimitKey);
        if (count === 1) {
          await redis.expire(rateLimitKey, 300); // 5 min window
        }
        if (count > 20) {
          logger.warn(`SimulationSchedulerService: loop defense triggered for ${userId}:${characterId} (${count} runs in 5m)`);
          return false;
        }
      }
    } catch {
      // Continue safely
    }

    await QueueManager.addJob(
      'character-simulation',
      `eval:${characterId}:${userId}`,
      {
        userId,
        characterId,
        triggerType,
        triggerEventId,
      },
      {
        priority: triggerType === 'CONVERSATION' ? 'CRITICAL' : 'NORMAL',
        idempotencyKey,
        delayMs,
      }
    );

    logger.debug(`SimulationSchedulerService: enqueued simulation job for user '${userId}', character '${characterId}'`);
    return true;
  }

  /**
   * Directly processes a simulation job from worker.
   */
  public async processSimulationJob(data: {
    userId: string;
    characterId: string;
    triggerType: 'CONVERSATION' | 'ROUTINE' | 'GOAL_EVENT' | 'MANUAL' | 'RELATIONSHIP';
    triggerEventId?: string;
  }): Promise<void> {
    await CharacterSimulationCycle.getInstance().executeCycle({
      userId: data.userId,
      characterId: data.characterId,
      triggerType: data.triggerType,
      triggerEventId: data.triggerEventId,
    });
  }
}
