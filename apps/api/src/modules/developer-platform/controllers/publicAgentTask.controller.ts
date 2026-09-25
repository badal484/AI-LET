import type { Request, Response, NextFunction } from 'express';
import { AgentTaskService } from '../../agents/AgentTaskService.js';
import { DeveloperUsageMeteringService } from '../services/DeveloperUsageMeteringService.js';
import { WebhookService } from '../services/WebhookService.js';
import { NotFoundError, ValidationError, PermissionDeniedError } from '../../../shared/errors/AppError.js';

export class PublicAgentTaskController {
  /**
   * POST /v1/agent-tasks
   * Spawns an agent execution workflow.
   */
  public static async createTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.developerContext) {
        throw new PermissionDeniedError('Authentication required');
      }

      const { characterId, instruction, objective: bodyObjective, conversationId, bounds } = req.body;
      const objective = (bodyObjective || instruction || '').toString().trim();

      if (!objective) {
        throw new ValidationError('Task objective/instruction is required');
      }

      const taskService = AgentTaskService.getInstance();
      const result = await taskService.createTask(req.developerContext.userId, {
        characterId,
        conversationId,
        objective,
        bounds: bounds || undefined,
      });

      // Record metered usage
      DeveloperUsageMeteringService.getInstance().recordUsage({
        projectId: req.developerContext.projectId,
        metric: 'AGENT_STEPS',
        quantity: 1,
        endpoint: '/v1/agent-tasks',
        environment: req.developerContext.environment,
      }).catch(() => {});

      // Dispatch Webhook
      WebhookService.getInstance().dispatchWebhookEvent(
        req.developerContext.projectId,
        'agent.task.created',
        {
          task_id: result.task.id,
          character_id: result.task.characterId,
          status: result.task.status,
          created_at: new Date().toISOString(),
        }
      ).catch(() => {});

      if (result.confirmationRequired) {
        WebhookService.getInstance().dispatchWebhookEvent(
          req.developerContext.projectId,
          'agent.task.awaiting_confirmation',
          {
            task_id: result.task.id,
            action_id: result.confirmationRequired.stepId,
            token: result.confirmationRequired.token,
            tool_name: result.confirmationRequired.toolSlug,
            description: result.confirmationRequired.explanation,
          }
        ).catch(() => {});
      }

      res.status(202).json({
        data: {
          id: result.task.id,
          character_id: result.task.characterId,
          conversation_id: result.task.conversationId,
          objective: result.task.objective,
          status: result.task.status,
          confirmation_required: result.confirmationRequired || null,
          steps_count: result.plan?.steps?.length || 0,
          created_at: new Date(result.task.createdAt).toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /v1/agent-tasks/:id
   * Retrieves task progress and status.
   */
  public static async getTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.developerContext) {
        throw new PermissionDeniedError('Authentication required');
      }

      const id = String(req.params['id'] || '');
      const taskService = AgentTaskService.getInstance();
      const task = await taskService.getTask(id);

      if (!task) {
        throw new NotFoundError(`Agent task '${id}' not found`);
      }

      if (task.userId !== req.developerContext.userId) {
        throw new PermissionDeniedError('Unauthorized access to this task');
      }

      const plan = task.planId ? await taskService.getPlan(task.planId) : null;

      res.status(200).json({
        data: {
          id: task.id,
          character_id: task.characterId,
          conversation_id: task.conversationId,
          objective: task.objective,
          status: task.status,
          current_step: task.currentStepIndex,
          steps: plan?.steps || [],
          created_at: new Date(task.createdAt).toISOString(),
          started_at: task.startedAt ? new Date(task.startedAt).toISOString() : null,
          completed_at: task.completedAt ? new Date(task.completedAt).toISOString() : null,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /v1/agent-tasks/:id/cancel
   * Cancels a running task.
   */
  public static async cancelTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.developerContext) {
        throw new PermissionDeniedError('Authentication required');
      }

      const id = String(req.params['id'] || '');
      const { reason } = req.body;
      const taskService = AgentTaskService.getInstance();
      const cancelledTask = taskService.cancelTask(id, req.developerContext.userId, typeof reason === 'string' ? reason : 'Developer cancelled');

      WebhookService.getInstance().dispatchWebhookEvent(
        req.developerContext.projectId,
        'agent.task.failed',
        {
          task_id: id,
          status: 'CANCELLED',
          reason: reason || 'Developer cancelled',
        }
      ).catch(() => {});

      res.status(200).json({
        data: {
          id: cancelledTask.id,
          status: cancelledTask.status,
          message: 'Task cancelled successfully',
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /v1/agent-tasks/:id/confirm
   * Confirms/approves high risk step execution.
   */
  public static async confirmStep(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.developerContext) {
        throw new PermissionDeniedError('Authentication required');
      }

      const id = String(req.params['id'] || '');
      const token = String(req.body.token || req.body.confirmationToken || req.body.confirmationId || '');
      const action = req.body.action === 'REJECT' || req.body.approved === false ? 'REJECT' : 'CONFIRM';

      if (!token) {
        throw new ValidationError('confirmation token is required');
      }

      const taskService = AgentTaskService.getInstance();
      const result = await taskService.confirmTaskStep(req.developerContext.userId, id, {
        token,
        action,
        reason: typeof req.body.reason === 'string' ? req.body.reason : undefined,
      });

      res.status(200).json({
        data: {
          id: result.task.id,
          status: result.task.status,
          confirmed: action === 'CONFIRM',
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
