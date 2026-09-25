import crypto from 'crypto';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { redis } from '../../../infrastructure/redis/redis.js';
import { logger } from '../../../shared/utils/logger.js';
import { ModelRouterService } from '../../ai/routing/ModelRouter.service.js';
import { CharacterGoalService } from './CharacterGoalService.js';
import { CharacterRoutineService } from './CharacterRoutineService.js';
import { CharacterThreadAndCommitmentService } from './CharacterThreadAndCommitmentService.js';
import { CharacterContinuityService } from './CharacterContinuityService.js';
import { CharacterPlanService } from './CharacterPlanService.js';
import { CharacterWorldStateService } from './CharacterWorldStateService.js';
import { UserSimulationSettingsService } from './UserSimulationSettingsService.js';
import { CharacterTimeContextService } from './CharacterTimeContextService.js';
import { SimulationProposalValidator } from './SimulationProposalValidator.js';
import type {
  SimulationProposalItem,
  SimulationRunItem,
  BehaviorMode,
} from '@ai-companion/types';

export interface RunSimulationInput {
  userId: string;
  characterId: string;
  characterVersionId?: string | null;
  triggerType: 'CONVERSATION' | 'ROUTINE' | 'GOAL_EVENT' | 'MANUAL' | 'RELATIONSHIP';
  triggerEventId?: string | null;
  userMessageContext?: string;
  forceExecution?: boolean;
}

export class CharacterSimulationCycle {
  private static instance: CharacterSimulationCycle;

  private constructor() {}

  public static getInstance(): CharacterSimulationCycle {
    if (!CharacterSimulationCycle.instance) {
      CharacterSimulationCycle.instance = new CharacterSimulationCycle();
    }
    return CharacterSimulationCycle.instance;
  }

  /**
   * Runs an orchestrated, bounded simulation cycle for a user-character pair.
   */
  public async executeCycle(input: RunSimulationInput): Promise<SimulationRunItem> {
    const startTime = Date.now();
    const { userId, characterId, triggerType, triggerEventId } = input;
    const lockKey = `lock:sim:${userId}:${characterId}`;

    // 1. Distributed Locking & Debounce Check
    let acquiredLock = false;
    try {
      if (redis.status === 'ready') {
        const res = await redis.set(lockKey, '1', 'PX', 15000, 'NX');
        if (!res && !input.forceExecution) {
          logger.debug(`CharacterSimulationCycle: debounced concurrent run for ${userId}:${characterId}`);
          return this.createRunRecord(userId, characterId, triggerType, 'NO_ACTION', 0, 0, 0, Date.now() - startTime, undefined, triggerEventId || undefined);
        }
        acquiredLock = true;
      }
    } catch {
      // Gracefully continue if Redis is offline
    }

    try {
      // 2. Deterministic Pre-Checks (User settings, initiative level, zero-action economics)
      const [settings, state] = await Promise.all([
        UserSimulationSettingsService.getInstance().getSettings(userId, characterId),
        CharacterContinuityService.getInstance().getOrCreateSimulationState(userId, characterId),
      ]);

      if (!settings.enabled && triggerType !== 'MANUAL') {
        logger.debug(`CharacterSimulationCycle: simulation disabled by user settings for ${userId}:${characterId}`);
        return this.createRunRecord(userId, characterId, triggerType, 'NO_ACTION', 0, 0, 0, Date.now() - startTime, undefined, triggerEventId || undefined);
      }

      if (state.initiativeLevel === 'OFF' && triggerType !== 'MANUAL') {
        logger.debug(`CharacterSimulationCycle: initiative is OFF for user ${userId}`);
        return this.createRunRecord(userId, characterId, triggerType, 'NO_ACTION', 0, 0, 0, Date.now() - startTime, undefined, triggerEventId || undefined);
      }

      // 3. Load Bounded Context
      const [goals, threads, commitments, routines, plans] = await Promise.all([
        CharacterGoalService.getInstance().listGoals(userId, characterId, ['ACTIVE', 'IN_PROGRESS']),
        CharacterThreadAndCommitmentService.getInstance().listActiveThreads(userId, characterId),
        CharacterThreadAndCommitmentService.getInstance().listPendingCommitments(userId, characterId),
        CharacterRoutineService.getInstance().listRoutines(characterId, true),
        CharacterPlanService.getInstance().listPlans(userId, characterId, ['ACTIVE']),
      ]);

      // Check if any routine is eligible
      const dueRoutines = routines.filter((r) =>
        CharacterRoutineService.getInstance().isRoutineEligible(r, {
          now: new Date(),
          userTimezone: settings.userTimezone || 'UTC',
          eventContext: triggerType === 'ROUTINE' ? { type: 'routine_tick' } : undefined,
        }).eligible
      );

      // Zero-Action Economic Bypass
      if (
        triggerType === 'CONVERSATION' &&
        goals.length === 0 &&
        threads.length === 0 &&
        commitments.length === 0 &&
        plans.length === 0 &&
        dueRoutines.length === 0 &&
        !input.forceExecution &&
        (!input.userMessageContext || input.userMessageContext.length < 20)
      ) {
        return this.createRunRecord(userId, characterId, triggerType, 'NO_ACTION', 0, 0, 0, Date.now() - startTime, undefined, triggerEventId || undefined);
      }

      // 4. Build Structured Simulation Context
      const timeCtx = CharacterTimeContextService.getInstance().getTimeContext(settings.userTimezone || 'UTC');
      const simulationContext = {
        currentTime: timeCtx.currentTime,
        localDate: timeCtx.localDate,
        dayOfWeek: timeCtx.dayOfWeek,
        timeOfDay: timeCtx.timeOfDay,
        behaviorMode: state.behaviorMode,
        autonomyLevel: settings.autonomyLevel,
        activeGoals: goals.slice(0, 3).map((g) => ({ id: g.id, title: g.title, progress: g.progress, status: g.status })),
        activePlans: plans.slice(0, 2).map((p) => ({ id: p.id, title: p.title, currentStep: p.currentStepIndex })),
        openThreads: threads.slice(0, 3).map((t) => ({ id: t.id, topic: t.topic })),
        commitments: commitments.slice(0, 3).map((c) => ({ id: c.id, description: c.description })),
        dueRoutines: dueRoutines.map((r) => ({ id: r.id, name: r.name })),
        recentContext: input.userMessageContext || 'None',
      };

      const contextHash = crypto.createHash('sha256').update(JSON.stringify(simulationContext)).digest('hex');

      // 5. Generate Proposals via AI Gateway or Fallback Synthesizer
      let rawProposals: SimulationProposalItem[] = [];
      let costUsd = 0.0001;

      try {
        const promptText = `Analyze character state and suggest proposals. Respond ONLY with a valid JSON array of proposals:\n${JSON.stringify(simulationContext)}`;
        // Routed like every other workload (registry + routing policy + fallback chain) rather than
        // pinned to one provider, so production uses the configured real models.
        const aiResponse = await ModelRouterService.getInstance().executeWithFallback('PROACTIVE_DECISION', (model) => ({
          model: model.modelName,
          messages: [
            { role: 'system', content: 'You are the Character Simulation Engine. Propose structured state updates or return [{"type": "NO_ACTION"}]. Do not execute tools directly.' },
            { role: 'user', content: promptText },
          ],
          temperature: 0.2,
          maxTokens: 400,
        }));

        costUsd = aiResponse.costUsd || 0.0001;
        const parsed = JSON.parse(aiResponse.content);
        rawProposals = Array.isArray(parsed) ? parsed : (parsed as any).proposals || [{ type: 'NO_ACTION' }];
      } catch {
        // Safe Rule-based Fallback
        if (dueRoutines.length > 0 && dueRoutines[0]) {
          rawProposals = [
            {
              type: 'SUGGEST_BEHAVIOR_MODE',
              payload: { mode: 'curious', reason: `Routine ${dueRoutines[0].name} triggered` },
              reason: 'Routine schedule due',
              confidence: 0.9,
            },
          ];
        } else {
          rawProposals = [{ type: 'NO_ACTION', payload: {}, reason: 'No state update required', confidence: 1.0 }];
        }
      }

      // 6. Validate Proposals via SimulationProposalValidator
      const validator = SimulationProposalValidator.getInstance();
      const validationContext = {
        userId,
        characterId,
        activeGoalCount: goals.length,
        openThreadCount: threads.length,
        pendingCommitmentCount: commitments.length,
      };

      const acceptedProposals: SimulationProposalItem[] = [];
      for (const p of rawProposals) {
        const valRes = validator.validateProposal(p, validationContext);
        if (valRes.valid && valRes.sanitizedProposal && valRes.sanitizedProposal.type !== 'NO_ACTION') {
          acceptedProposals.push(valRes.sanitizedProposal);
        }
      }

      // 7. Apply Deterministic State Changes in Database Transaction
      await prisma.$transaction(async (tx) => {
        for (const ap of acceptedProposals) {
          if (ap.type === 'CREATE_GOAL') {
            await CharacterGoalService.getInstance().createGoal({
              userId,
              characterId,
              title: ap.payload['title'] as string,
              description: ap.payload['description'] as string,
              category: (ap.payload['category'] as string) || 'topic_continuity',
              owner: 'CHARACTER',
              source: 'simulation_proposal',
              confidence: ap.confidence,
            });
          } else if (ap.type === 'UPDATE_GOAL') {
            await CharacterGoalService.getInstance().updateGoal(
              ap.payload['goalId'] as string,
              userId,
              {
                progress: typeof ap.payload['progress'] === 'number' ? ap.payload['progress'] : undefined,
                description: ap.payload['description'] as string,
              }
            );
          } else if (ap.type === 'COMPLETE_GOAL') {
            await CharacterGoalService.getInstance().transitionGoalStatus(
              ap.payload['goalId'] as string,
              userId,
              'COMPLETED',
              ap.reason
            );
          } else if (ap.type === 'PAUSE_GOAL') {
            await CharacterGoalService.getInstance().transitionGoalStatus(
              ap.payload['goalId'] as string,
              userId,
              'PAUSED',
              ap.reason
            );
          } else if (ap.type === 'CREATE_PLAN') {
            await CharacterPlanService.getInstance().createPlan({
              userId,
              characterId,
              title: ap.payload['title'] as string,
              description: ap.payload['description'] as string,
              goalId: ap.payload['goalId'] as string,
              steps: ap.payload['steps'] as any,
            });
          } else if (ap.type === 'ADVANCE_PLAN') {
            const planId = ap.payload['planId'] as string;
            const stepId = ap.payload['stepId'] as string;
            if (planId && stepId) {
              await CharacterPlanService.getInstance().updatePlanStep(planId, stepId, {
                status: 'COMPLETED',
              });
            }
          } else if (ap.type === 'UPDATE_WORLD_STATE') {
            await CharacterWorldStateService.getInstance().setEntityState({
              characterId,
              userId,
              entityKey: ap.payload['entityKey'] as string,
              entityType: (ap.payload['entityType'] as any) || 'CUSTOM',
              stateValue: (ap.payload['stateValue'] as any) || { updated: true },
              eventType: 'CUSTOM_EVENT',
            });
          } else if (ap.type === 'CREATE_THREAD') {
            await CharacterThreadAndCommitmentService.getInstance().createThread({
              userId,
              characterId,
              topic: ap.payload['topic'] as string,
              contextSnippet: ap.payload['contextSnippet'] as string,
            });
          } else if (ap.type === 'RESOLVE_THREAD') {
            await CharacterThreadAndCommitmentService.getInstance().resolveThread(
              ap.payload['threadId'] as string,
              userId
            );
          } else if (ap.type === 'CREATE_COMMITMENT') {
            await CharacterThreadAndCommitmentService.getInstance().createCommitment({
              userId,
              characterId,
              commitmentType: (ap.payload['commitmentType'] as string) || 'FOLLOW_UP',
              description: ap.payload['description'] as string,
            });
          } else if (ap.type === 'SUGGEST_BEHAVIOR_MODE') {
            await CharacterContinuityService.getInstance().updateBehaviorMode(
              userId,
              characterId,
              ap.payload['mode'] as BehaviorMode,
              (ap.payload['reason'] as string) || ap.reason,
              (ap.payload['durationHours'] as number) || 24
            );
          }
        }

        // Record due routine executions
        for (const r of dueRoutines) {
          await tx.characterRoutine.update({
            where: { id: r.id },
            data: { lastTriggeredAt: new Date() },
          });
        }

        // Update simulation state timestamp
        await tx.characterSimulationState.upsert({
          where: { userId_characterId: { userId, characterId } },
          update: {
            lastSimulationAt: new Date(),
            nextEligibleSimulationAt: new Date(Date.now() + 60000), // Min 1 min gap
            version: { increment: 1 },
          },
          create: {
            userId,
            characterId,
            lastSimulationAt: new Date(),
            nextEligibleSimulationAt: new Date(Date.now() + 60000),
          },
        });
      });

      // 8. Capture Simulation Run Record and State Snapshot
      const latencyMs = Date.now() - startTime;
      const status = acceptedProposals.length > 0 ? 'COMPLETED' : 'NO_ACTION';
      const runRecord = await this.createRunRecord(
        userId,
        characterId,
        triggerType,
        status,
        rawProposals.length,
        acceptedProposals.length,
        costUsd,
        latencyMs,
        contextHash,
        triggerEventId || undefined
      );

      // Snapshot active state for auditing
      await prisma.simulationStateSnapshot.create({
        data: {
          simulationRunId: runRecord.id,
          userId,
          characterId,
          stateHash: contextHash,
          activeGoalIds: goals.map((g) => g.id),
          openThreadIds: threads.map((t) => t.id),
          commitmentIds: commitments.map((c) => c.id),
          behaviorMode: state.behaviorMode,
        },
      });

      logger.info(`CharacterSimulationCycle: finished cycle '${runRecord.id}' (${status}) in ${latencyMs}ms for ${userId}:${characterId}`);
      return runRecord;
    } finally {
      if (acquiredLock) {
        await redis.del(lockKey).catch(() => {});
      }
    }
  }

  private async createRunRecord(
    userId: string,
    characterId: string,
    triggerType: string,
    status: 'RUNNING' | 'COMPLETED' | 'NO_ACTION' | 'FAILED',
    proposalsCount: number,
    acceptedProposalsCount: number,
    costUsd: number,
    latencyMs: number,
    contextHash?: string,
    triggerEventId?: string,
    errorCode?: string,
    errorMessage?: string
  ): Promise<SimulationRunItem> {
    const created = await prisma.simulationRunRecord.create({
      data: {
        userId,
        characterId,
        triggerType,
        triggerEventId: triggerEventId || null,
        status,
        modelId: 'gpt-4o-mini',
        promptVersion: 'v1.0.0',
        contextHash: contextHash || 'none',
        proposalsCount,
        acceptedProposalsCount,
        costUsd,
        latencyMs,
        errorCode,
        errorMessage,
      },
    });

    return {
      id: created.id,
      userId: created.userId,
      characterId: created.characterId,
      triggerType: created.triggerType,
      status: (created.status || status) as any,
      modelId: created.modelId,
      promptVersion: created.promptVersion,
      contextHash: created.contextHash,
      proposalsCount: created.proposalsCount,
      acceptedProposalsCount: created.acceptedProposalsCount,
      costUsd: created.costUsd,
      latencyMs: created.latencyMs,
      errorCode: created.errorCode,
      errorMessage: created.errorMessage,
      createdAt: created.createdAt.toISOString(),
    };
  }
}
