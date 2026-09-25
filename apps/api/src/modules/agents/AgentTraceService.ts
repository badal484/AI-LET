import { AgentTaskTrace, AgentTaskItem, AgentPlan } from '@ai-companion/types';
import { logger } from '../../shared/utils/logger.js';

export class AgentTraceService {
  private static instance: AgentTraceService;

  private readonly traces: Map<string, AgentTaskTrace> = new Map();

  private constructor() {}

  public static getInstance(): AgentTraceService {
    if (!AgentTraceService.instance) {
      AgentTraceService.instance = new AgentTraceService();
    }
    return AgentTraceService.instance;
  }

  /**
   * Records a complete agent task execution trace for forensics and billing
   */
  public recordTaskTrace(task: AgentTaskItem, plan: AgentPlan, stepsExecution: AgentTaskTrace['stepsExecution']): AgentTaskTrace {
    const totalCostUsd = stepsExecution.reduce((sum, s) => sum + s.costUsd, 0) + plan.estimatedCostUsd;
    const totalDurationMs = stepsExecution.reduce((sum, s) => sum + s.durationMs, 0);

    const trace: AgentTaskTrace = {
      taskId: task.id,
      plan,
      stepsExecution,
      totalDurationMs,
      totalCostUsd: Math.round(totalCostUsd * 1000) / 1000,
      finalStatus: task.status,
    };

    this.traces.set(task.id, trace);
    logger.info(`Recorded agent task trace for task '${task.id}' (Total Cost: $${trace.totalCostUsd})`);
    return trace;
  }

  /**
   * Retrieves a task trace by ID
   */
  public getTrace(taskId: string): AgentTaskTrace | undefined {
    return this.traces.get(taskId);
  }

  /**
   * Lists recent agent task traces for the admin dashboard
   */
  public listRecentTraces(limit: number = 20): AgentTaskTrace[] {
    return Array.from(this.traces.values()).slice(0, limit);
  }
}
