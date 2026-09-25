import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../shared/utils/logger.js';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError.js';
import { ErrorCode } from '@ai-companion/config';
import type {
  CharacterPlanItem,
  CharacterPlanStepItem,
  PlanStatus,
  PlanStepStatus,
} from '@ai-companion/types';

export interface CreatePlanInput {
  characterId: string;
  userId: string;
  characterVersionId?: string | null;
  goalId?: string | null;
  title: string;
  description?: string | null;
  expiresAt?: Date | string | null;
  metadata?: Record<string, unknown>;
  steps?: Array<{
    sequence: number;
    title: string;
    description?: string | null;
    dependencies?: Array<string | number>;
    completionCriteria?: string | null;
    estimatedEffort?: string | null;
  }>;
}

export interface UpdatePlanStepInput {
  status?: PlanStepStatus;
  output?: Record<string, unknown>;
}

export class CharacterPlanService {
  private static instance: CharacterPlanService;

  private constructor() {}

  public static getInstance(): CharacterPlanService {
    if (!CharacterPlanService.instance) {
      CharacterPlanService.instance = new CharacterPlanService();
    }
    return CharacterPlanService.instance;
  }

  /**
   * Creates a new sequential CharacterPlan with bounded steps.
   */
  public async createPlan(input: CreatePlanInput): Promise<CharacterPlanItem> {
    if (!input.title || input.title.trim().length === 0) {
      throw new ValidationError('Plan title is required.');
    }

    const created = await prisma.characterPlan.create({
      data: {
        characterId: input.characterId,
        userId: input.userId,
        characterVersionId: input.characterVersionId || null,
        goalId: input.goalId || null,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        status: 'ACTIVE',
        currentStepIndex: 0,
        version: 1,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        metadata: input.metadata ? (input.metadata as any) : undefined,
        steps: input.steps && input.steps.length > 0
          ? {
              create: input.steps.map((s, idx) => ({
                sequence: s.sequence !== undefined ? s.sequence : idx,
                title: s.title.trim(),
                description: s.description?.trim() || null,
                status: idx === 0 ? 'IN_PROGRESS' : 'PENDING',
                dependencies: s.dependencies ? (s.dependencies as any) : [],
                completionCriteria: s.completionCriteria?.trim() || null,
                estimatedEffort: s.estimatedEffort || null,
              })),
            }
          : undefined,
      },
      include: {
        steps: {
          orderBy: { sequence: 'asc' },
        },
      },
    });

    // Record simulation event
    await prisma.characterSimulationEvent.create({
      data: {
        characterId: input.characterId,
        userId: input.userId,
        characterVersionId: input.characterVersionId || null,
        eventType: 'character.plan.created.v1',
        source: 'PLAN',
        payload: { planId: created.id, title: created.title, stepsCount: created.steps.length } as any,
        stateVersion: 1,
      },
    });

    logger.info(`CharacterPlanService: created plan '${created.id}' ("${created.title}") for character '${input.characterId}'`);
    return this.mapToItem(created);
  }

  /**
   * Retrieves a plan by ID.
   */
  public async getPlan(planId: string): Promise<CharacterPlanItem> {
    const plan = await prisma.characterPlan.findUnique({
      where: { id: planId },
      include: {
        steps: { orderBy: { sequence: 'asc' } },
      },
    });

    if (!plan) {
      throw new NotFoundError(`Character plan '${planId}' not found.`, ErrorCode.NOT_FOUND);
    }

    return this.mapToItem(plan);
  }

  /**
   * Lists active plans for a user-character pair.
   */
  public async listPlans(
    userId: string,
    characterId: string,
    statuses: PlanStatus[] = ['ACTIVE', 'IN_PROGRESS' as any, 'PAUSED', 'BLOCKED']
  ): Promise<CharacterPlanItem[]> {
    if (!prisma.characterPlan) {
      return [];
    }
    const plans = await prisma.characterPlan.findMany({
      where: {
        userId,
        characterId,
        status: { in: statuses as any },
      },
      include: {
        steps: { orderBy: { sequence: 'asc' } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });

    return plans.map((p) => this.mapToItem(p));
  }

  /**
   * Updates a specific step in a plan and advances the plan if step completes.
   */
  public async updatePlanStep(
    planId: string,
    stepId: string,
    input: UpdatePlanStepInput
  ): Promise<CharacterPlanItem> {
    const plan = await prisma.characterPlan.findUnique({
      where: { id: planId },
      include: { steps: { orderBy: { sequence: 'asc' } } },
    });

    if (!plan) {
      throw new NotFoundError(`Plan '${planId}' not found.`, ErrorCode.NOT_FOUND);
    }

    const step = plan.steps.find((s) => s.id === stepId);
    if (!step) {
      throw new NotFoundError(`Plan step '${stepId}' not found in plan '${planId}'.`, ErrorCode.NOT_FOUND);
    }

    // Step dependency verification if marking IN_PROGRESS or COMPLETED
    if (input.status === 'COMPLETED' || input.status === 'IN_PROGRESS') {
      const deps = Array.isArray(step.dependencies) ? step.dependencies : [];
      for (const dep of deps) {
        const depStep = plan.steps.find((s) => s.id === dep || s.sequence === dep);
        if (depStep && depStep.status !== 'COMPLETED' && depStep.status !== 'SKIPPED') {
          throw new ValidationError(`Cannot advance step '${step.title}': dependent step '${depStep.title}' is not completed.`);
        }
      }
    }

    await prisma.characterPlanStep.update({
      where: { id: stepId },
      data: {
        status: input.status || step.status,
        output: input.output ? (input.output as any) : undefined,
        completedAt: input.status === 'COMPLETED' ? new Date() : undefined,
      },
    });

    // Check if next step should be activated
    const updatedSteps = await prisma.characterPlanStep.findMany({
      where: { planId },
      orderBy: { sequence: 'asc' },
    });

    let nextIndex = plan.currentStepIndex;
    let allCompleted = true;

    for (let i = 0; i < updatedSteps.length; i++) {
      const cur = updatedSteps[i]!;
      if (cur.status !== 'COMPLETED' && cur.status !== 'SKIPPED') {
        allCompleted = false;
        nextIndex = i;
        // Activate next pending step
        if (cur.status === 'PENDING') {
          await prisma.characterPlanStep.update({
            where: { id: cur.id },
            data: { status: 'IN_PROGRESS' },
          });
        }
        break;
      }
    }

    let planStatus = plan.status;
    let completedAt = plan.completedAt;

    if (allCompleted) {
      planStatus = 'COMPLETED';
      completedAt = new Date();
    }

    const finalPlan = await prisma.characterPlan.update({
      where: { id: planId },
      data: {
        status: planStatus,
        currentStepIndex: nextIndex,
        completedAt,
        version: { increment: 1 },
      },
      include: { steps: { orderBy: { sequence: 'asc' } } },
    });

    // Event emission
    await prisma.characterSimulationEvent.create({
      data: {
        characterId: finalPlan.characterId,
        userId: finalPlan.userId,
        eventType: allCompleted ? 'character.plan.completed.v1' : 'character.plan.advanced.v1',
        source: 'PLAN',
        payload: { planId, stepId, stepStatus: input.status, allCompleted } as any,
        stateVersion: finalPlan.version,
      },
    });

    return this.mapToItem(finalPlan);
  }

  /**
   * Cancels or pauses a plan.
   */
  public async setPlanStatus(
    planId: string,
    status: PlanStatus,
    reason?: string
  ): Promise<CharacterPlanItem> {
    const updated = await prisma.characterPlan.update({
      where: { id: planId },
      data: {
        status,
        completedAt: status === 'COMPLETED' || status === 'CANCELLED' ? new Date() : undefined,
        version: { increment: 1 },
        metadata: reason ? { statusChangeReason: reason } : undefined,
      },
      include: { steps: { orderBy: { sequence: 'asc' } } },
    });

    return this.mapToItem(updated);
  }

  private mapToItem(record: any): CharacterPlanItem {
    return {
      id: record.id,
      characterId: record.characterId,
      userId: record.userId,
      characterVersionId: record.characterVersionId,
      goalId: record.goalId,
      title: record.title,
      description: record.description,
      status: record.status as PlanStatus,
      currentStepIndex: record.currentStepIndex,
      version: record.version,
      expiresAt: record.expiresAt ? record.expiresAt.toISOString() : null,
      completedAt: record.completedAt ? record.completedAt.toISOString() : null,
      metadata: record.metadata as Record<string, unknown> | null,
      steps: record.steps?.map((s: any) => this.mapStepToItem(s)),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private mapStepToItem(record: any): CharacterPlanStepItem {
    return {
      id: record.id,
      planId: record.planId,
      sequence: record.sequence,
      title: record.title,
      description: record.description,
      status: record.status as PlanStepStatus,
      dependencies: Array.isArray(record.dependencies) ? record.dependencies : [],
      completionCriteria: record.completionCriteria,
      estimatedEffort: record.estimatedEffort,
      output: record.output as Record<string, unknown> | null,
      completedAt: record.completedAt instanceof Date ? record.completedAt.toISOString() : record.completedAt || null,
      createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : record.createdAt || new Date().toISOString(),
      updatedAt: record.updatedAt instanceof Date ? record.updatedAt.toISOString() : record.updatedAt || new Date().toISOString(),
    };
  }
}
