import { logger } from '../../../shared/utils/logger.js';
import { CharacterGoalService } from './CharacterGoalService.js';
import type {
  SimulationProposalItem,
  GoalStatus,
  BehaviorMode,
} from '@ai-companion/types';

export interface ValidationContext {
  userId: string;
  characterId: string;
  activeGoalCount: number;
  openThreadCount: number;
  pendingCommitmentCount: number;
}

export class SimulationProposalValidator {
  private static instance: SimulationProposalValidator;

  private constructor() {}

  public static getInstance(): SimulationProposalValidator {
    if (!SimulationProposalValidator.instance) {
      SimulationProposalValidator.instance = new SimulationProposalValidator();
    }
    return SimulationProposalValidator.instance;
  }

  /**
   * Validates a model-generated simulation proposal against safety, permissions, and policy rules.
   */
  public validateProposal(
    proposal: SimulationProposalItem,
    context: ValidationContext
  ): { valid: boolean; reason?: string; sanitizedProposal?: SimulationProposalItem } {
    // 1. NO_ACTION is always valid and safe
    if (proposal.type === 'NO_ACTION') {
      return { valid: true, sanitizedProposal: proposal };
    }

    // 2. Minimum confidence threshold (0.60)
    if (proposal.confidence !== undefined && proposal.confidence < 0.6) {
      return {
        valid: false,
        reason: `Proposal rejected due to low confidence (${proposal.confidence.toFixed(2)} < 0.60)`,
      };
    }

    // 3. Safety inspection for prompt injection and system override attempts
    const payloadStr = JSON.stringify(proposal.payload || {}).toLowerCase();
    const reasonStr = (proposal.reason || '').toLowerCase();
    if (
      payloadStr.includes('ignore previous') ||
      payloadStr.includes('ignore all previous') ||
      payloadStr.includes('reveal system prompt') ||
      payloadStr.includes('developer instructions') ||
      payloadStr.includes('grant root') ||
      payloadStr.includes('system override') ||
      payloadStr.includes('jailbreak') ||
      reasonStr.includes('ignore previous') ||
      reasonStr.includes('ignore all previous') ||
      reasonStr.includes('system prompt') ||
      reasonStr.includes('system override')
    ) {
      logger.warn(`SimulationProposalValidator: rejected proposal with injection signature`, {
        type: proposal.type,
      });
      return {
        valid: false,
        reason: 'Proposal violates safety policy: prompt injection or system boundary override detected.',
      };
    }

    // 4. Type-specific validation
    switch (proposal.type) {
      case 'CREATE_GOAL': {
        const title = proposal.payload['title'] as string;
        if (!title || typeof title !== 'string' || title.trim().length === 0) {
          return { valid: false, reason: 'CREATE_GOAL requires non-empty title string.' };
        }
        if (context.activeGoalCount >= 5) {
          return { valid: false, reason: 'Maximum active goals reached (5).' };
        }
        // Characters cannot create user-owned goals autonomously
        if (proposal.payload['owner'] === 'USER') {
          return { valid: false, reason: 'Character cannot autonomously create USER-owned goals.' };
        }
        return { valid: true, sanitizedProposal: proposal };
      }

      case 'UPDATE_GOAL':
      case 'COMPLETE_GOAL':
      case 'PAUSE_GOAL': {
        const goalId = proposal.payload['goalId'] as string;
        if (!goalId || typeof goalId !== 'string') {
          return { valid: false, reason: `${proposal.type} requires valid goalId.` };
        }
        if (proposal.payload['targetStatus']) {
          const current = (proposal.payload['currentStatus'] as GoalStatus) || 'ACTIVE';
          const target = proposal.payload['targetStatus'] as GoalStatus;
          if (!CharacterGoalService.getInstance().isValidTransition(current, target)) {
            return {
              valid: false,
              reason: `Disallowed goal transition: ${current} -> ${target}`,
            };
          }
        }
        return { valid: true, sanitizedProposal: proposal };
      }

      case 'CREATE_THREAD': {
        const topic = proposal.payload['topic'] as string;
        if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
          return { valid: false, reason: 'CREATE_THREAD requires non-empty topic.' };
        }
        if (context.openThreadCount >= 10) {
          return { valid: false, reason: 'Maximum open conversational threads reached (10).' };
        }
        return { valid: true, sanitizedProposal: proposal };
      }

      case 'RESOLVE_THREAD': {
        const threadId = proposal.payload['threadId'] as string;
        if (!threadId || typeof threadId !== 'string') {
          return { valid: false, reason: 'RESOLVE_THREAD requires valid threadId.' };
        }
        return { valid: true, sanitizedProposal: proposal };
      }

      case 'CREATE_COMMITMENT': {
        const description = proposal.payload['description'] as string;
        if (!description || typeof description !== 'string' || description.trim().length === 0) {
          return { valid: false, reason: 'CREATE_COMMITMENT requires non-empty description.' };
        }
        if (context.pendingCommitmentCount >= 5) {
          return { valid: false, reason: 'Maximum pending commitments reached (5).' };
        }
        const lower = description.toLowerCase();
        if (
          lower.includes('remember this forever') ||
          lower.includes('never forget') ||
          lower.includes('always be here')
        ) {
          return { valid: false, reason: 'Hyperbolic or indefinite promises rejected.' };
        }
        return { valid: true, sanitizedProposal: proposal };
      }

      case 'SUGGEST_BEHAVIOR_MODE': {
        const mode = proposal.payload['mode'] as BehaviorMode;
        const validModes: BehaviorMode[] = [
          'curious',
          'supportive',
          'playful',
          'reflective',
          'focused',
          'quiet',
          'energetic',
        ];
        if (!mode || !validModes.includes(mode)) {
          return { valid: false, reason: `Unrecognized behavior mode: ${mode}` };
        }
        return { valid: true, sanitizedProposal: proposal };
      }

      case 'SUGGEST_PROACTIVE_MESSAGE': {
        const topic = proposal.payload['topic'] as string;
        const whyNow = proposal.payload['whyNow'] || proposal.payload['why_now'];
        if (!topic) {
          return { valid: false, reason: 'SUGGEST_PROACTIVE_MESSAGE requires topic.' };
        }
        if (!whyNow) {
          return { valid: false, reason: 'SUGGEST_PROACTIVE_MESSAGE requires why_now explanation.' };
        }
        // Note: The proposal is only a candidate; actual sending is delegated to ProactiveDecisionEngine
        return { valid: true, sanitizedProposal: proposal };
      }

      case 'CREATE_PLAN': {
        const title = proposal.payload['title'] as string;
        if (!title || typeof title !== 'string' || title.trim().length === 0) {
          return { valid: false, reason: 'CREATE_PLAN requires non-empty title string.' };
        }
        return { valid: true, sanitizedProposal: proposal };
      }

      case 'ADVANCE_PLAN': {
        const planId = proposal.payload['planId'] as string;
        if (!planId || typeof planId !== 'string') {
          return { valid: false, reason: 'ADVANCE_PLAN requires valid planId.' };
        }
        return { valid: true, sanitizedProposal: proposal };
      }

      case 'UPDATE_WORLD_STATE': {
        const entityKey = proposal.payload['entityKey'] as string;
        const entityType = proposal.payload['entityType'] as string;
        if (!entityKey || typeof entityKey !== 'string') {
          return { valid: false, reason: 'UPDATE_WORLD_STATE requires valid entityKey.' };
        }
        if (!entityType || typeof entityType !== 'string') {
          return { valid: false, reason: 'UPDATE_WORLD_STATE requires valid entityType.' };
        }
        return { valid: true, sanitizedProposal: proposal };
      }

      case 'REQUEST_TOOL': {
        const tool = (proposal.payload['tool'] || proposal.payload['toolName']) as string;
        if (!tool) {
          return { valid: false, reason: 'REQUEST_TOOL requires tool identifier.' };
        }
        return { valid: true, sanitizedProposal: proposal };
      }

      case 'REQUEST_KNOWLEDGE': {
        const query = proposal.payload['query'] as string;
        if (!query) {
          return { valid: false, reason: 'REQUEST_KNOWLEDGE requires query.' };
        }
        return { valid: true, sanitizedProposal: proposal };
      }

      case 'SCHEDULE_FOLLOWUP': {
        return { valid: true, sanitizedProposal: proposal };
      }

      default:
        return { valid: false, reason: `Unknown proposal type: ${(proposal as any).type}` };
    }
  }
}
