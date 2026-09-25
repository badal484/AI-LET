import { logger } from '../../../config/logger.js';
import { redis } from '../../../infrastructure/redis/redis.js';

export interface AbuseRiskEvaluation {
  isAllowed: boolean;
  action: 'ALLOW' | 'THROTTLE' | 'BLOCK';
  riskScore: number;
  abuseType?: string;
  retryAfterSeconds?: number;
  reason?: string;
}

export class AbusePreventionService {
  private static readonly BURST_WINDOW_SECONDS = 60;
  private static readonly MAX_BURST_PROMPTS_PER_MIN = 30;
  private static readonly MAX_CREATOR_CHARS_PER_HOUR = 20;
  private static readonly MAX_REPORTS_PER_HOUR = 15;

  /**
   * Evaluates generation velocity and AI token abuse.
   */
  public static async evaluatePromptVelocity(userId: string): Promise<AbuseRiskEvaluation> {
    const key = `abuse:prompts:${userId}`;
    try {
      const current = await redis.incr(key);
      if (current === 1) {
        await redis.expire(key, this.BURST_WINDOW_SECONDS);
      }

      if (current > this.MAX_BURST_PROMPTS_PER_MIN) {
        logger.warn(`Prompt velocity limit exceeded for user ${userId}: ${current} requests/min`);
        return {
          isAllowed: false,
          action: 'THROTTLE',
          riskScore: 0.85,
          abuseType: 'PROMPT_SPAM_BURST',
          retryAfterSeconds: 30,
          reason: 'Too many rapid message requests. Please wait a moment.',
        };
      }

      return { isAllowed: true, action: 'ALLOW', riskScore: current / this.MAX_BURST_PROMPTS_PER_MIN };
    } catch (err) {
      logger.error('Redis error in evaluatePromptVelocity, allowing gracefully', { err });
      return { isAllowed: true, action: 'ALLOW', riskScore: 0 };
    }
  }

  /**
   * Evaluates creator character creation velocity.
   */
  public static async evaluateCharacterCreationVelocity(userId: string): Promise<AbuseRiskEvaluation> {
    const key = `abuse:creator:char_create:${userId}`;
    try {
      const current = await redis.incr(key);
      if (current === 1) {
        await redis.expire(key, 3600); // 1 hour window
      }

      if (current > this.MAX_CREATOR_CHARS_PER_HOUR) {
        logger.warn(`Creator character creation spam limit exceeded for user ${userId}: ${current} chars/hr`);
        return {
          isAllowed: false,
          action: 'BLOCK',
          riskScore: 0.9,
          abuseType: 'CREATOR_SPAM_CREATION',
          retryAfterSeconds: 3600,
          reason: 'Character creation limit reached for this hour. Please try again later.',
        };
      }

      return { isAllowed: true, action: 'ALLOW', riskScore: current / this.MAX_CREATOR_CHARS_PER_HOUR };
    } catch (err) {
      logger.error('Redis error in evaluateCharacterCreationVelocity, allowing gracefully', { err });
      return { isAllowed: true, action: 'ALLOW', riskScore: 0 };
    }
  }

  /**
   * Evaluates reporting spam and mass brigading.
   */
  public static async evaluateReportVelocity(userId: string): Promise<AbuseRiskEvaluation> {
    const key = `abuse:reports:${userId}`;
    try {
      const current = await redis.incr(key);
      if (current === 1) {
        await redis.expire(key, 3600); // 1 hour window
      }

      if (current > this.MAX_REPORTS_PER_HOUR) {
        logger.warn(`Report velocity limit exceeded for user ${userId}: ${current} reports/hr`);
        return {
          isAllowed: false,
          action: 'THROTTLE',
          riskScore: 0.8,
          abuseType: 'REPORT_BRIGADING',
          retryAfterSeconds: 1800,
          reason: 'You have submitted multiple reports recently. Our safety team is actively investigating.',
        };
      }

      return { isAllowed: true, action: 'ALLOW', riskScore: current / this.MAX_REPORTS_PER_HOUR };
    } catch (err) {
      logger.error('Redis error in evaluateReportVelocity, allowing gracefully', { err });
      return { isAllowed: true, action: 'ALLOW', riskScore: 0 };
    }
  }
}
