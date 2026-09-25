import crypto from 'crypto';
import {
  AgentTaskItem,
  CreateAgentTaskInput,
  AgentPlan,
  AgentTaskBounds,
  HighRiskConfirmationRequest,
  ConfirmStepInput,
} from '@ai-companion/types';
import { AGENT_CONSTANTS } from '@ai-companion/config';
import { AgentTaskStateMachine } from './AgentTaskStateMachine.js';
import { AgentPlanner } from './AgentPlanner.js';
import { ToolExecutionGateway } from './ToolExecutionGateway.js';
import { HighRiskConfirmationService } from './HighRiskConfirmationService.js';
import { prisma } from '../../infrastructure/database/prisma.js';
import { logger } from '../../shared/utils/logger.js';
import { NotFoundError, ForbiddenError } from '../../shared/errors/AppError.js';
import { ErrorCode } from '@ai-companion/config';

export interface AgentTaskExecutionResult {
  task: AgentTaskItem;
  plan: AgentPlan;
  confirmationRequired?: HighRiskConfirmationRequest;
  executionLogs: string[];
}

export class AgentTaskService {
  private static instance: AgentTaskService;
  private readonly planner = AgentPlanner.getInstance();
  private readonly gateway = ToolExecutionGateway.getInstance();
  private readonly confirmationService = HighRiskConfirmationService.getInstance();

  private readonly taskCache: Map<string, AgentTaskItem> = new Map();
  private readonly planCache: Map<string, AgentPlan> = new Map();

  private constructor() {}

  public static getInstance(): AgentTaskService {
    if (!AgentTaskService.instance) {
      AgentTaskService.instance = new AgentTaskService();
    }
    return AgentTaskService.instance;
  }

  /**
   * Creates and initializes a new Agent Task with durable database persistence.
   */
  public async createTask(userId: string, input: CreateAgentTaskInput): Promise<AgentTaskExecutionResult> {
    const taskId = `task_${crypto.randomUUID()}`;
    const now = Date.now();
    const bounds: AgentTaskBounds = {
      maxSteps: input.bounds?.maxSteps || AGENT_CONSTANTS.DEFAULT_BOUNDS.MAX_STEPS,
      maxToolCalls: input.bounds?.maxToolCalls || AGENT_CONSTANTS.DEFAULT_BOUNDS.MAX_TOOL_CALLS,
      maxDurationMs: input.bounds?.maxDurationMs || AGENT_CONSTANTS.DEFAULT_BOUNDS.MAX_DURATION_MS,
      maxTokens: input.bounds?.maxTokens || AGENT_CONSTANTS.DEFAULT_BOUNDS.MAX_TOKENS,
      maxCostUsd: input.bounds?.maxCostUsd || AGENT_CONSTANTS.DEFAULT_BOUNDS.MAX_COST_USD,
      maxRetries: input.bounds?.maxRetries || AGENT_CONSTANTS.DEFAULT_BOUNDS.MAX_RETRIES,
      maxParallelTools: input.bounds?.maxParallelTools || AGENT_CONSTANTS.DEFAULT_BOUNDS.MAX_PARALLEL_TOOLS,
    };

    const task: AgentTaskItem = {
      id: taskId,
      userId,
      characterId: input.characterId ?? null,
      conversationId: input.conversationId,
      status: 'created',
      taskType: input.taskType || 'WORKFLOW',
      objective: input.objective,
      bounds,
      currentStepIndex: 0,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + bounds.maxDurationMs).toISOString(),
      metadata: input.metadata,
    };

    this.taskCache.set(taskId, task);

    // Generate and validate plan
    AgentTaskStateMachine.assertTransition(task.status, 'planning', taskId);
    task.status = 'planning';
    task.startedAt = new Date().toISOString();

    const plan = await this.planner.generatePlan(taskId, task.objective, task.characterId || undefined, bounds);
    task.planId = plan.planId;
    this.planCache.set(plan.planId, plan);

    try {
      await prisma.agentTaskRecord.create({
        data: {
          id: taskId,
          userId,
          characterId: task.characterId,
          conversationId: task.conversationId,
          taskType: task.taskType,
          objective: task.objective,
          status: task.status,
          currentStepIndex: 0,
          bounds: bounds as any,
          planId: plan.planId,
          estimatedCostUsd: plan.estimatedCostUsd,
          actualCostUsd: 0.0,
          startedAt: new Date(),
          expiresAt: new Date(task.expiresAt),
          metadata: (input.metadata as any) || undefined,
        },
      });

      await prisma.agentPlanRecord.create({
        data: {
          id: plan.planId,
          taskId,
          objective: plan.objective,
          steps: plan.steps as any,
          estimatedCostUsd: plan.estimatedCostUsd,
          estimatedDurationMs: plan.estimatedDurationMs,
          requiredPermissions: plan.requiredPermissions as any,
          riskLevel: plan.riskLevel,
          generatedByModel: plan.generatedByModel,
          promptVersion: plan.promptVersion,
        },
      });
    } catch (err: any) {
      logger.warn(`AgentTaskService: DB persistence warning: ${err.message}`);
    }

    logger.info(`Created AgentTask '${taskId}' for user '${userId}' with objective: "${task.objective}"`);

    // Execute first phase
    return this.runTaskExecution(task, plan);
  }

  /**
   * Executes task steps sequentially through the ToolExecutionGateway with checkpoints.
   */
  public async runTaskExecution(
    task: AgentTaskItem,
    plan: AgentPlan,
    confirmationToken?: string
  ): Promise<AgentTaskExecutionResult> {
    const executionLogs: string[] = [];
    let confirmationRequired: HighRiskConfirmationRequest | undefined;

    if (task.status === 'planning' || task.status === 'paused' || task.status === 'awaiting_confirmation') {
      AgentTaskStateMachine.assertTransition(task.status, 'executing', task.id);
      task.status = 'executing';
      await this.syncTaskStatus(task);
    }

    let actualCostUsd = 0.0;

    for (let i = task.currentStepIndex; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      if (!step) continue;

      if (task.status === 'cancelled') {
        step.status = 'SKIPPED';
        executionLogs.push(`Task was cancelled. Skipping step '${step.stepId}'.`);
        break;
      }

      // 1. High-risk Confirmation Gate
      if (step.requiresConfirmation && step.status !== 'COMPLETED') {
        if (!confirmationToken) {
          AgentTaskStateMachine.assertTransition(task.status, 'awaiting_confirmation', task.id);
          task.status = 'awaiting_confirmation';
          task.currentStepIndex = i;
          await this.syncTaskStatus(task);

          confirmationRequired = await this.confirmationService.createConfirmationRequest(
            task.userId,
            task.id,
            step.stepId,
            step.toolSlug,
            step.arguments,
            step.riskLevel,
            `Action '${step.toolSlug}' requires explicit confirmation: will impact external services.`
          );

          executionLogs.push(
            `Execution paused: Step '${step.stepId}' (${step.toolSlug}) requires explicit confirmation token.`
          );
          return { task, plan, confirmationRequired, executionLogs };
        }
      }

      // 2. Execute Step via ToolExecutionGateway
      step.status = 'EXECUTING';
      executionLogs.push(`Executing step ${i + 1}/${plan.steps.length}: '${step.toolSlug}'`);

      const toolResult = await this.gateway.executeTool({
        taskId: task.id,
        stepId: step.stepId,
        toolSlug: step.toolSlug,
        arguments: step.arguments,
        userId: task.userId,
        characterId: task.characterId || undefined,
        confirmationToken: step.requiresConfirmation ? confirmationToken : undefined,
      });

      if (toolResult.success) {
        step.status = 'COMPLETED';
        step.output = toolResult.data;
        actualCostUsd += toolResult.metadata.costUsd || 0.001;
        executionLogs.push(`Step '${step.stepId}' completed successfully.`);

        // Record resumable checkpoint
        await this.recordCheckpoint(task.id, i, step.stepId, {
          status: 'COMPLETED',
          output: toolResult.data,
        });

        // Clear confirmationToken after successful consumption so next steps aren't re-using it
        confirmationToken = undefined;
      } else {
        step.status = 'FAILED';
        step.error = toolResult.error?.message || 'Tool execution failed';
        task.failureCode = toolResult.error?.code || 'STEP_EXECUTION_FAILED';
        task.failureReason = step.error;

        AgentTaskStateMachine.assertTransition(task.status, 'failed', task.id);
        task.status = 'failed';
        task.completedAt = new Date().toISOString();
        await this.syncTaskStatus(task);

        executionLogs.push(`Step '${step.stepId}' failed: ${step.error}`);
        return { task, plan, executionLogs };
      }

      task.currentStepIndex = i + 1;
    }

    // All steps finished
    if (task.status === 'executing') {
      AgentTaskStateMachine.assertTransition(task.status, 'completed', task.id);
      task.status = 'completed';
      task.completedAt = new Date().toISOString();
      await this.syncTaskStatus(task, actualCostUsd);
      executionLogs.push(`AgentTask '${task.id}' completed successfully.`);
    }

    return { task, plan, executionLogs };
  }

  /**
   * Resumes a task waiting for user confirmation
   */
  public async confirmTaskStep(
    userId: string,
    taskId: string,
    input: ConfirmStepInput
  ): Promise<AgentTaskExecutionResult> {
    const task = await this.getTask(taskId);
    if (!task) {
      throw new NotFoundError(`AgentTask '${taskId}' not found.`, ErrorCode.NOT_FOUND);
    }

    if (task.userId !== userId) {
      throw new ForbiddenError('Unauthorized access to this task', ErrorCode.FORBIDDEN);
    }

    const plan = await this.getPlan(task.planId || '');
    if (!plan) {
      throw new NotFoundError(`Plan for task '${taskId}' not found.`, ErrorCode.NOT_FOUND);
    }

    if (input.action === 'REJECT') {
      AgentTaskStateMachine.assertTransition(task.status, 'cancelled', taskId);
      task.status = 'cancelled';
      task.cancelledAt = new Date().toISOString();
      task.failureReason = input.reason || 'User rejected high-risk confirmation';
      await this.syncTaskStatus(task);

      return {
        task,
        plan,
        executionLogs: [`Task '${taskId}' was rejected by user: ${task.failureReason}`],
      };
    }

    return this.runTaskExecution(task, plan, input.token);
  }

  /**
   * Cancels a running or paused agent task
   */
  public cancelTask(taskId: string, userId: string, reason?: string): AgentTaskItem {
    const task = this.taskCache.get(taskId);
    if (!task) {
      throw new NotFoundError(`AgentTask '${taskId}' not found.`, ErrorCode.NOT_FOUND);
    }

    if (task.userId !== userId) {
      throw new ForbiddenError('Unauthorized to cancel this task', ErrorCode.FORBIDDEN);
    }

    AgentTaskStateMachine.assertTransition(task.status, 'cancelled', taskId);
    task.status = 'cancelled';
    task.cancelledAt = new Date().toISOString();
    if (reason) task.failureReason = reason;

    this.syncTaskStatus(task).catch((err: any) => {
      logger.warn(`AgentTaskService: cancelTask DB sync warning: ${err.message}`);
    });

    logger.info(`AgentTask '${taskId}' cancelled by user '${userId}'`);
    return task;
  }

  /**
   * Retrieves task by ID with database fallback
   */
  public async getTask(taskId: string): Promise<AgentTaskItem | null> {
    const cached = this.taskCache.get(taskId);
    if (cached) return cached;

    try {
      const record = await prisma.agentTaskRecord.findUnique({
        where: { id: taskId },
      });
      if (record) {
        const item = this.mapRecordToTask(record);
        this.taskCache.set(item.id, item);
        return item;
      }
    } catch (err: any) {
      logger.warn(`AgentTaskService: DB fetch fallback warning: ${err.message}`);
    }

    return null;
  }

  /**
   * Lists tasks for a user
   */
  public async listUserTasks(userId: string): Promise<AgentTaskItem[]> {
    try {
      const records = await prisma.agentTaskRecord.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      return records.map(this.mapRecordToTask);
    } catch {
      return Array.from(this.taskCache.values()).filter((t) => t.userId === userId);
    }
  }

  public async getPlan(planId: string): Promise<AgentPlan | null> {
    const cached = this.planCache.get(planId);
    if (cached) return cached;

    try {
      const record = await prisma.agentPlanRecord.findUnique({
        where: { id: planId },
      });
      if (record) {
        const plan: AgentPlan = {
          planId: record.id,
          taskId: record.taskId,
          objective: record.objective,
          steps: record.steps as any,
          estimatedCostUsd: record.estimatedCostUsd,
          estimatedDurationMs: record.estimatedDurationMs,
          requiredPermissions: record.requiredPermissions as string[],
          riskLevel: record.riskLevel as any,
          generatedByModel: record.generatedByModel,
          promptVersion: record.promptVersion,
          createdAt: record.createdAt.toISOString(),
        };
        this.planCache.set(plan.planId, plan);
        return plan;
      }
    } catch (err: any) {
      logger.warn(`AgentTaskService: DB plan fetch fallback warning: ${err.message}`);
    }

    return null;
  }

  private async syncTaskStatus(task: AgentTaskItem, actualCostUsd?: number): Promise<void> {
    this.taskCache.set(task.id, task);

    try {
      await prisma.agentTaskRecord.update({
        where: { id: task.id },
        data: {
          status: task.status,
          currentStepIndex: task.currentStepIndex,
          failureCode: task.failureCode || null,
          failureReason: task.failureReason || null,
          startedAt: task.startedAt ? new Date(task.startedAt) : undefined,
          completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
          cancelledAt: task.cancelledAt ? new Date(task.cancelledAt) : undefined,
          ...(actualCostUsd !== undefined ? { actualCostUsd } : {}),
        },
      });
    } catch (err: any) {
      logger.warn(`AgentTaskService: DB status sync warning: ${err.message}`);
    }
  }

  private async recordCheckpoint(
    taskId: string,
    stepIndex: number,
    stepId: string,
    stateSnapshot: Record<string, unknown>
  ): Promise<void> {
    try {
      await prisma.agentTaskCheckpoint.create({
        data: {
          taskId,
          stepIndex,
          stepId,
          stateSnapshot: stateSnapshot as any,
        },
      });
    } catch (err: any) {
      logger.warn(`AgentTaskService: checkpoint write warning: ${err.message}`);
    }
  }

  private mapRecordToTask(record: any): AgentTaskItem {
    return {
      id: record.id,
      userId: record.userId,
      characterId: record.characterId,
      conversationId: record.conversationId,
      status: record.status as any,
      taskType: record.taskType as any,
      objective: record.objective,
      bounds: record.bounds as AgentTaskBounds,
      currentStepIndex: record.currentStepIndex,
      planId: record.planId,
      failureCode: record.failureCode,
      failureReason: record.failureReason,
      createdAt: record.createdAt.toISOString(),
      startedAt: record.startedAt ? record.startedAt.toISOString() : undefined,
      completedAt: record.completedAt ? record.completedAt.toISOString() : undefined,
      cancelledAt: record.cancelledAt ? record.cancelledAt.toISOString() : undefined,
      expiresAt: record.expiresAt.toISOString(),
      metadata: record.metadata as Record<string, unknown> | undefined,
    };
  }
}
