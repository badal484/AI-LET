import { Request, Response } from 'express';
import { CharacterGoalService } from './services/CharacterGoalService.js';
import { CharacterPlanService } from './services/CharacterPlanService.js';
import { CharacterRoutineService } from './services/CharacterRoutineService.js';
import { CharacterThreadAndCommitmentService } from './services/CharacterThreadAndCommitmentService.js';
import { CharacterContinuityService } from './services/CharacterContinuityService.js';
import { CharacterWorldStateService } from './services/CharacterWorldStateService.js';
import { SimulationContextPackService } from './services/SimulationContextPackService.js';
import { UserSimulationSettingsService } from './services/UserSimulationSettingsService.js';
import { SimulationReplayService } from './services/SimulationReplayService.js';
import { SimulationStateMigrator } from './services/SimulationStateMigrator.js';
import { CharacterSimulationCycle } from './services/CharacterSimulationCycle.js';
import { prisma } from '../../infrastructure/database/prisma.js';
import { ApiResponse } from '../../shared/utils/apiResponse.js';
import { BadRequestError, NotFoundError } from '../../shared/errors/AppError.js';
import { AuditService } from '../audit/audit.service.js';

/**
 * Whose simulation state a request acts on. On the user router it is always the authenticated caller.
 * On the admin inspection router it is the target user resolved (and validated) by
 * `resolveAdminSimulationSubject`; the admin's own identity is never used as a user id.
 */
type SimulationRequest = Request & { simulationSubjectUserId?: string | null };

function subjectUserId(req: Request): string {
  const r = req as SimulationRequest;
  if (r.simulationSubjectUserId) return r.simulationSubjectUserId;
  if (req.user?.userId) return req.user.userId;
  throw new BadRequestError('userId is required');
}

/** World state may be global (no user) when an operator inspects it without a target user. */
function optionalSubjectUserId(req: Request): string | undefined {
  const r = req as SimulationRequest;
  if (r.simulationSubjectUserId !== undefined) return r.simulationSubjectUserId ?? undefined;
  return req.user?.userId;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Admin inspection routes: resolve the target user from `?userId=` or `body.userId`, verify it
 * exists, and audit every mutation. `required: false` allows global (character-level) world state.
 */
export const resolveAdminSimulationSubject =
  (required: boolean) =>
  async (req: Request, _res: Response, next: (err?: unknown) => void): Promise<void> => {
    try {
      const raw = (req.query['userId'] as string | undefined) ?? (req.body?.userId as string | undefined);
      if (!raw) {
        if (required) throw new BadRequestError('userId (the user whose simulation state to inspect) is required');
        (req as SimulationRequest).simulationSubjectUserId = null;
      } else {
        if (typeof raw !== 'string' || !UUID_RE.test(raw)) throw new BadRequestError('userId must be a uuid');
        const target = await prisma.user.findFirst({ where: { id: raw, deletedAt: null }, select: { id: true } });
        if (!target) throw new NotFoundError('User not found');
        (req as SimulationRequest).simulationSubjectUserId = target.id;
      }
      if (req.method !== 'GET') {
        await AuditService.log({
          actorType: 'ADMIN',
          actorId: req.admin?.adminId ?? null,
          action: 'SIMULATION_ADMIN_MUTATION',
          resourceType: 'character_simulation',
          resourceId: String(req.params['characterId'] ?? req.body?.characterId ?? req.params['goalId'] ?? req.params['planId'] ?? ''),
          metadata: { method: req.method, route: req.route?.path ?? req.path, targetUserId: raw ?? null },
        });
      }
      next();
    } catch (err) {
      next(err);
    }
  };

export class SimulationController {
  /**
   * Retrieves continuity context for a character and authenticated user.
   */
  public static async getContinuity(req: Request, res: Response): Promise<void> {
    const userId = subjectUserId(req);
    const characterId = String(req.params['characterId'] || '');

    const continuity = await CharacterContinuityService.getInstance().getContinuityContext(userId, characterId);
    ApiResponse.success(res, continuity);
  }

  /**
   * Retrieves comprehensive SimulationContextPack for ContextBuilder.
   */
  public static async getContextPack(req: Request, res: Response): Promise<void> {
    const userId = subjectUserId(req);
    const characterId = String(req.params['characterId'] || '');
    const userTimezone = (req.query['timezone'] as string) || 'UTC';

    const pack = await SimulationContextPackService.getInstance().getContextPack(userId, characterId, userTimezone);
    ApiResponse.success(res, pack);
  }

  /**
   * Lists active goals for a character and user.
   */
  public static async listGoals(req: Request, res: Response): Promise<void> {
    const userId = subjectUserId(req);
    const characterId = req.params['characterId'] as string | undefined;

    const goals = await CharacterGoalService.getInstance().listGoals(userId, characterId);
    ApiResponse.success(res, goals);
  }

  /**
   * Creates a new goal.
   */
  public static async createGoal(req: Request, res: Response): Promise<void> {
    const userId = subjectUserId(req);
    const { characterId, title, description, category, priority, milestones, dueAt } = req.body;

    const goal = await CharacterGoalService.getInstance().createGoal({
      userId,
      characterId,
      title,
      description,
      category: category || 'topic_continuity',
      priority,
      milestones,
      dueAt,
    });
    ApiResponse.success(res, goal, 201);
  }

  /**
   * Updates or transitions a goal.
   */
  public static async updateGoal(req: Request, res: Response): Promise<void> {
    const userId = subjectUserId(req);
    const goalId = String(req.params['goalId'] || '');
    const { targetStatus, progress, reason } = req.body;

    let updatedGoal;
    if (targetStatus) {
      updatedGoal = await CharacterGoalService.getInstance().transitionGoalStatus(goalId, userId, targetStatus, reason);
    } else if (progress !== undefined) {
      updatedGoal = await CharacterGoalService.getInstance().updateGoalProgress(goalId, userId, progress);
    } else {
      updatedGoal = await CharacterGoalService.getInstance().getGoal(goalId, userId);
    }
    ApiResponse.success(res, updatedGoal);
  }

  /**
   * Deletes a goal.
   */
  public static async deleteGoal(req: Request, res: Response): Promise<void> {
    const userId = subjectUserId(req);
    const goalId = String(req.params['goalId'] || '');

    await CharacterGoalService.getInstance().deleteGoal(goalId, userId);
    ApiResponse.success(res, { message: 'Goal deleted successfully.' });
  }

  /**
   * Lists character plans.
   */
  public static async listPlans(req: Request, res: Response): Promise<void> {
    const userId = subjectUserId(req);
    const characterId = String(req.params['characterId'] || '');

    const plans = await CharacterPlanService.getInstance().listPlans(userId, characterId);
    ApiResponse.success(res, plans);
  }

  /**
   * Creates a character plan.
   */
  public static async createPlan(req: Request, res: Response): Promise<void> {
    const userId = subjectUserId(req);
    const { characterId, goalId, title, description, steps, expiresAt } = req.body;

    const plan = await CharacterPlanService.getInstance().createPlan({
      userId,
      characterId,
      goalId,
      title,
      description,
      steps,
      expiresAt,
    });
    ApiResponse.success(res, plan, 201);
  }

  /**
   * Updates a step within a character plan.
   */
  public static async updatePlanStep(req: Request, res: Response): Promise<void> {
    const planId = String(req.params['planId'] || '');
    const stepId = String(req.params['stepId'] || '');
    const { status, output } = req.body;

    const updatedPlan = await CharacterPlanService.getInstance().updatePlanStep(planId, stepId, {
      status,
      output,
    });
    ApiResponse.success(res, updatedPlan);
  }

  /**
   * Updates plan status.
   */
  public static async setPlanStatus(req: Request, res: Response): Promise<void> {
    const planId = String(req.params['planId'] || '');
    const { status, reason } = req.body;

    const updatedPlan = await CharacterPlanService.getInstance().setPlanStatus(planId, status, reason);
    ApiResponse.success(res, updatedPlan);
  }

  /**
   * Lists conversational threads.
   */
  public static async listThreads(req: Request, res: Response): Promise<void> {
    const userId = subjectUserId(req);
    const characterId = String(req.params['characterId'] || '');

    const threads = await CharacterThreadAndCommitmentService.getInstance().listActiveThreads(userId, characterId);
    ApiResponse.success(res, threads);
  }

  /**
   * Resolves a thread.
   */
  public static async resolveThread(req: Request, res: Response): Promise<void> {
    const userId = subjectUserId(req);
    const threadId = String(req.params['threadId'] || '');
    const { status } = req.body;

    const thread = await CharacterThreadAndCommitmentService.getInstance().resolveThread(threadId, userId, status || 'RESOLVED');
    ApiResponse.success(res, thread);
  }

  /**
   * Lists commitments.
   */
  public static async listCommitments(req: Request, res: Response): Promise<void> {
    const userId = subjectUserId(req);
    const characterId = String(req.params['characterId'] || '');

    const commitments = await CharacterThreadAndCommitmentService.getInstance().listPendingCommitments(userId, characterId);
    ApiResponse.success(res, commitments);
  }

  /**
   * Lists world state facts.
   */
  public static async listWorldState(req: Request, res: Response): Promise<void> {
    const userId = optionalSubjectUserId(req);
    const characterId = String(req.params['characterId'] || '');

    const states = await CharacterWorldStateService.getInstance().listWorldStates(characterId, userId);
    ApiResponse.success(res, states);
  }

  /**
   * Sets world state fact.
   */
  public static async setWorldState(req: Request, res: Response): Promise<void> {
    const userId = optionalSubjectUserId(req);
    const { characterId, entityKey, entityType, stateValue, eventType, source } = req.body;

    const state = await CharacterWorldStateService.getInstance().setEntityState({
      characterId,
      userId,
      entityKey,
      entityType,
      stateValue,
      eventType,
      source,
    });
    ApiResponse.success(res, state, 200);
  }

  /**
   * Lists recent world state events.
   */
  public static async listWorldEvents(req: Request, res: Response): Promise<void> {
    const userId = optionalSubjectUserId(req);
    const characterId = String(req.params['characterId'] || '');
    const limitStr = req.query['limit'] as string | undefined;

    const events = await CharacterWorldStateService.getInstance().listRecentEvents(
      characterId,
      userId,
      limitStr ? parseInt(limitStr, 10) : 10
    );
    ApiResponse.success(res, events);
  }

  /**
   * Gets user simulation settings.
   */
  public static async getSettings(req: Request, res: Response): Promise<void> {
    const userId = subjectUserId(req);
    const characterId = String(req.params['characterId'] || '');

    const settings = await UserSimulationSettingsService.getInstance().getSettings(userId, characterId);
    ApiResponse.success(res, settings);
  }

  /**
   * Updates user simulation settings.
   */
  public static async updateSettings(req: Request, res: Response): Promise<void> {
    const userId = subjectUserId(req);
    const characterId = String(req.params['characterId'] || '');

    const settings = await UserSimulationSettingsService.getInstance().updateSettings(userId, characterId, req.body);
    ApiResponse.success(res, settings);
  }

  /**
   * Resets simulation state.
   */
  public static async resetState(req: Request, res: Response): Promise<void> {
    const userId = subjectUserId(req);
    const characterId = String(req.params['characterId'] || '');
    const scope = (req.body['scope'] || 'ALL') as any;

    const result = await UserSimulationSettingsService.getInstance().resetSimulationState(userId, characterId, scope);
    ApiResponse.success(res, result);
  }

  /**
   * Replays a simulation run for verification and auditing.
   */
  public static async replayRun(req: Request, res: Response): Promise<void> {
    const runId = String(req.params['runId'] || '');
    const replay = await SimulationReplayService.getInstance().replayRun(runId);
    ApiResponse.success(res, replay);
  }

  /**
   * Migrates character state to a new version.
   */
  public static async migrateVersion(req: Request, res: Response): Promise<void> {
    const { characterId, oldVersionId, newVersionId, dryRun } = req.body;
    const result = await SimulationStateMigrator.getInstance().migrateCharacterState(
      characterId,
      oldVersionId,
      newVersionId,
      !!dryRun
    );
    ApiResponse.success(res, result);
  }

  /**
   * Lists character routines.
   */
  public static async listRoutines(req: Request, res: Response): Promise<void> {
    const characterId = String(req.params['characterId'] || '');
    const routines = await CharacterRoutineService.getInstance().listRoutines(characterId);
    ApiResponse.success(res, routines);
  }

  /**
   * Creates a character routine.
   */
  public static async createRoutine(req: Request, res: Response): Promise<void> {
    const { characterId, name, description, routineType, scheduleCron, frequencyLimitPerDay, cooldownMinutes } = req.body;

    const routine = await CharacterRoutineService.getInstance().createRoutine({
      characterId,
      name,
      description,
      routineType,
      scheduleCron,
      frequencyLimitPerDay,
      cooldownMinutes,
    });
    ApiResponse.success(res, routine, 201);
  }

  /**
   * Triggers an explicit simulation cycle.
   */
  public static async runSimulation(req: Request, res: Response): Promise<void> {
    // Operator action (admin router): the target user is explicit input, the admin is the actor.
    const { userId, characterId, triggerType, userMessageContext, forceExecution } = req.body ?? {};
    if (typeof userId !== 'string' || !/^[0-9a-f-]{36}$/i.test(userId) || typeof characterId !== 'string' || !characterId) {
      throw new BadRequestError('userId (uuid) and characterId are required');
    }
    const target = await prisma.user.findFirst({ where: { id: userId, deletedAt: null }, select: { id: true } });
    if (!target) throw new NotFoundError('User not found');
    await AuditService.log({ actorType: 'ADMIN', actorId: req.admin?.adminId ?? null, action: 'SIMULATION_RUN_TRIGGERED', resourceType: 'character_simulation', resourceId: characterId, metadata: { userId, triggerType: triggerType || 'MANUAL', forceExecution: !!forceExecution } });

    const run = await CharacterSimulationCycle.getInstance().executeCycle({
      userId,
      characterId,
      triggerType: triggerType || 'MANUAL',
      userMessageContext,
      forceExecution: !!forceExecution,
    });
    ApiResponse.success(res, run);
  }

  /**
   * Lists simulation runs for audit/admin.
   */
  public static async listSimulationRuns(req: Request, res: Response): Promise<void> {
    const characterId = req.query['characterId'] as string | undefined;
    const userId = req.query['userId'] as string | undefined;
    const limit = req.query['limit'] as string | undefined;

    const runs = await prisma.simulationRunRecord.findMany({
      where: {
        ...(characterId ? { characterId } : {}),
        ...(userId ? { userId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit, 10) : 20,
    });

    ApiResponse.success(res, runs);
  }
}
