import { prisma } from '../../../infrastructure/database/prisma.js';
import { NotFoundError } from '../../../shared/errors/AppError.js';
import { ErrorCode, SYSTEM_CONSTANTS } from '@ai-companion/config';
import { ProactiveEligibilityService } from './proactiveEligibility.service.js';
import { ProactiveSafetyValidator } from './proactiveSafetyValidator.service.js';
import type {
  ProactiveSimulationInput,
  ProactiveSimulationResult,
  ProactiveIntentType,
} from '@ai-companion/types';

export class ProactiveSimulatorService {
  /**
   * Performs an isolated dry-run simulation of the proactive decision & generation pipeline
   * for Character Studio administrators. Never sends notifications or mutates production records.
   */
  public static async simulate(
    input: ProactiveSimulationInput,
  ): Promise<ProactiveSimulationResult> {
    const {
      characterId,
      characterVersionId,
      mockLocalTime,
      userTimezone = 'UTC',
      simulateRecentInteractionHours = 24,
      userMessageContext = 'Working on preparing for my big product launch next week.',
    } = input;

    // 1. Fetch character details with version
    const character = await prisma.character.findUnique({
      where: { id: characterId, deletedAt: null },
      include: {
        currentPublishedVersion: true,
        versions: true,
      },
    });

    if (!character) {
      throw new NotFoundError('Character not found for simulation', ErrorCode.CHARACTER_NOT_FOUND);
    }

    let version = character.currentPublishedVersion;
    if (characterVersionId) {
      const specific = character.versions.find(v => v.id === characterVersionId);
      if (specific) version = specific;
    }

    if (!version) {
      throw new NotFoundError('Character version not found for simulation', ErrorCode.CHARACTER_VERSION_NOT_FOUND);
    }

    const proactivityConfig = (version.proactivityConfigData as any) || {};

    // 2. Simulate Quiet Hours Check
    const quietHoursCheck = ProactiveEligibilityService.isQuietHoursActive(
      true,
      proactivityConfig.quietHoursStart || SYSTEM_CONSTANTS.PROACTIVITY.DEFAULT_QUIET_HOURS_START,
      proactivityConfig.quietHoursEnd || SYSTEM_CONSTANTS.PROACTIVITY.DEFAULT_QUIET_HOURS_END,
      userTimezone,
      mockLocalTime,
    );

    // 3. Simulate Cooldown / Recent Interaction Check
    const isRecent = simulateRecentInteractionHours < 0.16; // Less than 10 mins
    const cooldownActive = simulateRecentInteractionHours < (proactivityConfig.minInteractionCooldownHours || 6);

    let isEligible = true;
    let eligibilityReason = 'Simulation conditions eligible for proactive outreach.';

    if (proactivityConfig.enabled === false) {
      isEligible = false;
      eligibilityReason = 'Proactivity is disabled in this character version configuration.';
    } else if (quietHoursCheck.isQuietHours) {
      isEligible = false;
      eligibilityReason = `Quiet hours active at simulated local time ${quietHoursCheck.localTimeString} in ${userTimezone}.`;
    } else if (isRecent) {
      isEligible = false;
      eligibilityReason = 'Recent conversation active (< 10 minutes ago).';
    } else if (cooldownActive) {
      isEligible = false;
      eligibilityReason = `Interaction cooldown active (${simulateRecentInteractionHours}h since last message, min cooldown: ${proactivityConfig.minInteractionCooldownHours || 6}h).`;
    }

    // 4. Simulate Intent & Decision
    const mockIntent: ProactiveIntentType = userMessageContext.toLowerCase().includes('launch') || userMessageContext.toLowerCase().includes('goal')
      ? 'ASK_ABOUT_PREVIOUS_GOAL'
      : userMessageContext.toLowerCase().includes('exam') || userMessageContext.toLowerCase().includes('event')
      ? 'FOLLOW_UP_ON_TOPIC'
      : 'INVITE_LIGHT_CONVERSATION';

    const decision = {
      decision: (isEligible ? 'SEND' : 'WAIT') as 'SEND' | 'WAIT' | 'SKIP',
      reason: isEligible
        ? `Simulated intent trigger based on context: "${userMessageContext.slice(0, 60)}"`
        : eligibilityReason,
      confidence: isEligible ? 0.86 : 0.0,
      suggestedIntent: isEligible ? mockIntent : null,
    };

    // 5. Generate Preview Content
    const previewMessage = isEligible
      ? `Hey! Just wanted to check in and see how everything is coming along with ${userMessageContext.slice(0, 45)}... hope you're taking care of yourself today!`
      : null;

    if (previewMessage) {
      ProactiveSafetyValidator.validateProactiveMessage(previewMessage, []);
    }

    const previewNotification = isEligible
      ? {
          title: character.name,
          body: previewMessage || `New message from ${character.name}`,
          deepLink: `ai-companion://chat/simulated-${character.id}`,
        }
      : null;

    return {
      characterId: character.id,
      characterName: character.name,
      characterVersionId: version.id,
      eligibility: {
        isEligible,
        quietHoursActive: quietHoursCheck.isQuietHours,
        dailyLimitReached: false,
        cooldownActive,
        reason: eligibilityReason,
      },
      decision,
      intentPreview: isEligible
        ? {
            type: mockIntent,
            promptSnippet: `[PROACTIVE_SIMULATION_INTENT: ${mockIntent}] Context: ${userMessageContext}`,
            supportingMemoryCount: 1,
          }
        : null,
      generatedMessagePreview: previewMessage,
      notificationPreview: previewNotification,
    };
  }
}
