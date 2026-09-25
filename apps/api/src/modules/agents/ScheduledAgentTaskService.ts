import { ErrorCode } from '@ai-companion/config';
import { ForbiddenError } from '../../shared/errors/AppError.js';
import { HARD_DISABLED_TOOLS } from './toolSafety.js';
import { ScheduledAgentTaskItem } from '@ai-companion/types';
import { UserConsentService } from './UserConsentService.js';
import { ToolRegistry } from './ToolRegistry.js';
import { logger } from '../../shared/utils/logger.js';
import crypto from 'crypto';

export class ScheduledAgentTaskService {
  private static instance: ScheduledAgentTaskService;
  private readonly consentService = UserConsentService.getInstance();
  private readonly toolRegistry = ToolRegistry.getInstance();

  private readonly schedules: Map<string, ScheduledAgentTaskItem> = new Map();

  private constructor() {}

  public static getInstance(): ScheduledAgentTaskService {
    if (!ScheduledAgentTaskService.instance) {
      ScheduledAgentTaskService.instance = new ScheduledAgentTaskService();
    }
    return ScheduledAgentTaskService.instance;
  }

  /**
   * Creates a new scheduled recurring agent task
   */
  public createScheduledTask(
    userId: string,
    objective: string,
    toolSlugs: string[],
    cronSchedule: string,
    characterId?: string,
    timezone: string = 'UTC',
    maxRuns?: number
  ): ScheduledAgentTaskItem {
    const blocked = toolSlugs.find((slug) => HARD_DISABLED_TOOLS.has(slug));
    if (blocked) throw new ForbiddenError(HARD_DISABLED_TOOLS.get(blocked)!.message, ErrorCode.PAYMENT_TOOL_DISABLED);
    const id = `sched_${crypto.randomUUID()}`;
    const nextRunAt = new Date(Date.now() + 60000).toISOString(); // 1 minute from now

    const item: ScheduledAgentTaskItem = {
      id,
      userId,
      characterId,
      taskTemplate: {
        objective,
        toolSlugs,
        arguments: {},
      },
      cronSchedule,
      timezone,
      isEnabled: true,
      nextRunAt,
      lastRunAt: undefined,
      totalRuns: 0,
      maxRuns: maxRuns || 100,
      createdAt: new Date().toISOString(),
    };

    this.schedules.set(id, item);
    logger.info(`Created scheduled agent task '${id}' for user '${userId}' (Schedule: ${cronSchedule})`);
    return item;
  }

  /**
   * Retrieves all scheduled tasks for a user
   */
  public listUserScheduledTasks(userId: string): ScheduledAgentTaskItem[] {
    return Array.from(this.schedules.values()).filter((s) => s.userId === userId);
  }

  /**
   * Toggles enable / disable status of a scheduled task
   */
  public toggleScheduledTask(scheduleId: string, userId: string, isEnabled: boolean): ScheduledAgentTaskItem {
    const item = this.schedules.get(scheduleId);
    if (!item || item.userId !== userId) {
      throw new Error(`Scheduled task '${scheduleId}' not found for user '${userId}'.`);
    }

    item.isEnabled = isEnabled;
    this.schedules.set(scheduleId, item);
    logger.info(`Toggled scheduled task '${scheduleId}' -> isEnabled=${isEnabled}`);
    return item;
  }

  /**
   * Revalidates safety, consent, and tool enablement before triggering a scheduled execution
   */
  public validateScheduledRun(scheduleId: string): { isValid: boolean; reason?: string } {
    const item = this.schedules.get(scheduleId);
    if (!item || !item.isEnabled) {
      return { isValid: false, reason: 'Scheduled task is disabled or does not exist.' };
    }

    if (item.maxRuns && item.totalRuns >= item.maxRuns) {
      item.isEnabled = false;
      return { isValid: false, reason: 'Max runs limit reached for scheduled task.' };
    }

    // Check that all required tools exist and user consent is still active
    for (const slug of item.taskTemplate.toolSlugs) {
      if (HARD_DISABLED_TOOLS.has(slug)) return { isValid: false, reason: HARD_DISABLED_TOOLS.get(slug)!.message };
      const tool = this.toolRegistry.getTool(slug);
      if (!tool || tool.status !== 'enabled') {
        return { isValid: false, reason: `Required tool '${slug}' is currently disabled or unavailable.` };
      }

      if (tool.riskLevel === 'HIGH' || tool.riskLevel === 'CRITICAL') {
        const hasConsent = this.consentService.hasConsent(item.userId, tool.requiredCapability);
        if (!hasConsent) {
          return { isValid: false, reason: `Active consent for capability '${tool.requiredCapability}' is missing or expired.` };
        }
      }
    }

    return { isValid: true };
  }
}
