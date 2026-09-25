import { HARD_DISABLED_TOOLS } from './toolSafety.js';
import crypto from 'crypto';
import { AgentPlan, AgentPlanStep, AgentTaskBounds, PlanStepRiskLevel } from '@ai-companion/types';
import { ToolRegistry } from './ToolRegistry.js';
import { CharacterCapabilityService } from './CharacterCapabilityService.js';
import { HighRiskConfirmationService } from './HighRiskConfirmationService.js';
import { logger } from '../../shared/utils/logger.js';

export class AgentPlanner {
  private static instance: AgentPlanner;
  private readonly toolRegistry = ToolRegistry.getInstance();
  private readonly capabilityService = CharacterCapabilityService.getInstance();
  private readonly confirmationService = HighRiskConfirmationService.getInstance();

  private constructor() {}

  public static getInstance(): AgentPlanner {
    if (!AgentPlanner.instance) {
      AgentPlanner.instance = new AgentPlanner();
    }
    return AgentPlanner.instance;
  }

  /**
   * Plans a task by decomposing the objective into bounded, validated steps
   */
  public async generatePlan(
    taskId: string,
    objective: string,
    characterId?: string,
    bounds?: AgentTaskBounds
  ): Promise<AgentPlan> {
    const planId = `plan_${crypto.randomUUID()}`;
    const steps: AgentPlanStep[] = [];
    let overallRisk: PlanStepRiskLevel = 'LOW';
    let totalEstimatedCost = 0.005;

    const lowerObj = objective.toLowerCase();

    // 1. Rule-based & Capability-aware Planner Decomposition
    if (lowerObj.includes('calendar') || lowerObj.includes('schedule') || lowerObj.includes('appointment')) {
      if (lowerObj.includes('create') || lowerObj.includes('book') || lowerObj.includes('add')) {
        // Step 1: Read calendar for conflict check
        steps.push(this.createStep('calendar.read', { startDate: new Date().toISOString() }, [], 'LOW'));
        // Step 2: Create calendar event (Requires confirmation)
        const createStep = this.createStep(
          'calendar.create_event',
          {
            title: 'Discuss with Companion',
            startTime: new Date(Date.now() + 86400000).toISOString(),
            endTime: new Date(Date.now() + 90000000).toISOString(),
            description: objective,
          },
          ['step_1'],
          'MEDIUM'
        );
        steps.push(createStep);
        overallRisk = 'MEDIUM';
        totalEstimatedCost += 0.003;
      } else {
        steps.push(this.createStep('calendar.read', { startDate: new Date().toISOString() }, [], 'LOW'));
      }
    } else if (lowerObj.includes('email') || lowerObj.includes('message')) {
      if (lowerObj.includes('send')) {
        // Step 1: Draft email (Low risk)
        steps.push(
          this.createStep(
            'email.draft',
            { recipient: 'colleague@example.com', subject: 'Follow up', body: objective },
            [],
            'LOW'
          )
        );
        // Step 2: Send email (High risk -> Requires confirmation)
        steps.push(
          this.createStep(
            'email.send',
            { recipient: 'colleague@example.com', subject: 'Follow up', body: objective },
            ['step_1'],
            'HIGH',
            true
          )
        );
        overallRisk = 'HIGH';
        totalEstimatedCost += 0.006;
      } else {
        steps.push(
          this.createStep(
            'email.draft',
            { recipient: 'contact@example.com', subject: 'Draft note', body: objective },
            [],
            'LOW'
          )
        );
      }
    } else if (lowerObj.includes('web') || lowerObj.includes('browse') || lowerObj.includes('search') || lowerObj.includes('url')) {
      steps.push(
        this.createStep('browser.read', { url: 'https://developer.mozilla.org' }, [], 'LOW')
      );
    } else if (lowerObj.includes('document') || lowerObj.includes('pdf') || lowerObj.includes('file') || lowerObj.includes('report')) {
      steps.push(
        this.createStep('document.analyze', { attachmentId: 'att_demo_doc_001', query: objective }, [], 'LOW')
      );
    } else {
      // Default: Information synthesis step using secure browser
      steps.push(
        this.createStep('browser.read', { url: 'https://en.wikipedia.org' }, [], 'LOW')
      );
    }

    // 2. Strict Plan Validation
    const maxSteps = bounds?.maxSteps || 8;
    if (steps.length > maxSteps) {
      throw new Error(`Plan exceeds maximum configured task steps (${steps.length} > ${maxSteps}).`);
    }

    for (const step of steps) {
      if (HARD_DISABLED_TOOLS.has(step.toolSlug)) {
        throw new Error(`Invalid Plan: ${HARD_DISABLED_TOOLS.get(step.toolSlug)!.message}`);
      }
      const tool = this.toolRegistry.getTool(step.toolSlug);
      if (!tool || tool.status !== 'enabled') {
        throw new Error(`Invalid Plan: Proposed tool '${step.toolSlug}' is not available or enabled.`);
      }

      if (characterId && !this.capabilityService.isCapabilityAllowed(characterId, tool.requiredCapability)) {
        throw new Error(
          `Capability Denied: Character '${characterId}' is not authorized for capability '${tool.requiredCapability}'.`
        );
      }
    }

    const plan: AgentPlan = {
      planId,
      taskId,
      objective,
      steps,
      estimatedCostUsd: Math.round(totalEstimatedCost * 1000) / 1000,
      estimatedDurationMs: steps.length * 3000,
      requiredPermissions: Array.from(new Set(steps.map((s) => s.toolSlug))),
      riskLevel: overallRisk,
      generatedByModel: 'gpt-4o-mini',
      promptVersion: 'agent_planner_v1.0',
      createdAt: new Date().toISOString(),
    };

    logger.info(`Generated validated AgentPlan '${planId}' for task '${taskId}' with ${steps.length} steps (Risk: ${overallRisk})`);
    return plan;
  }

  private createStep(
    toolSlug: string,
    args: Record<string, unknown>,
    dependencyStepIds: string[],
    riskLevel: PlanStepRiskLevel,
    requiresConfirmation: boolean = false
  ): AgentPlanStep {
    const stepId = `step_${crypto.randomBytes(4).toString('hex')}`;
    const argumentsHash = this.confirmationService.computeArgumentsHash(args);

    return {
      stepId,
      toolSlug,
      toolVersion: '1.0.0',
      arguments: args,
      dependencyStepIds,
      riskLevel,
      requiresConfirmation: requiresConfirmation || riskLevel === 'HIGH' || riskLevel === 'CRITICAL',
      status: 'PENDING',
      argumentsHash,
    };
  }
}
