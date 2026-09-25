import { prisma } from '../../../infrastructure/database/prisma.js';
import { MemoryRetrieverService } from '../../memory/services/memoryRetriever.service.js';
import { RelationshipStateService } from '../../relationships/services/relationshipState.service.js';
import type {
  ProactiveDecisionResult,
  MemoryItem,
} from '@ai-companion/types';

export interface DecisionEngineInput {
  userId: string;
  characterId: string;
  characterName: string;
  characterRole?: string;
  proactivityConfig?: any;
  userMessageContext?: string;
}

export class ProactiveDecisionEngine {
  /**
   * Evaluates contextual signals to formulate a structured proactive intent or choose silence.
   */
  public static async evaluateDecision(
    input: DecisionEngineInput,
  ): Promise<ProactiveDecisionResult> {
    const { userId, characterId, proactivityConfig, userMessageContext } = input;

    // 1. Check for pending user-requested reminders (Highest priority)
    const now = new Date();
    const pendingReminder = await prisma.userReminder.findFirst({
      where: {
        userId,
        characterId,
        status: 'PENDING',
        targetTime: { lte: now },
      },
      orderBy: { targetTime: 'asc' },
    });

    if (pendingReminder) {
      return {
        decision: 'SEND',
        reason: `User-scheduled reminder is due: "${pendingReminder.title}"`,
        confidence: 0.98,
        suggestedIntent: 'USER_REQUESTED_REMINDER',
        supportingContextIds: [pendingReminder.id],
      };
    }

    // 2. Retrieve relevant memory & conversation signals
    let relevantMemories: MemoryItem[] = [];
    try {
      const memoryRetrieval = await MemoryRetrieverService.retrieveContext({
        userId,
        characterId,
        query: userMessageContext || 'recent plans, goals, preferences, upcoming events',
        maxTokens: 500,
        maxMemories: 4,
      });
      relevantMemories = memoryRetrieval.memories;
    } catch {
      // Memory service graceful fallback
    }

    // 3. Fetch Relationship Context
    let relationshipStage = 'STRANGER';
    try {
      const rel = await RelationshipStateService.getOrCreateRelationship(userId, characterId);
      relationshipStage = rel.stage;
    } catch {
      // Relationship fallback
    }

    // 4. Evaluate Memory Candidates for Intent Formulations
    const goalMemory = relevantMemories.find(m => m.category === 'GOAL');
    const eventMemory = relevantMemories.find(m => m.category === 'IMPORTANT_EVENT' || m.category === 'TEMPORARY_CONTEXT');
    const preferenceMemory = relevantMemories.find(m => m.category === 'PREFERENCE' || m.category === 'INTEREST');

    // A. Upcoming / Recent Important Event Follow-up
    if (eventMemory && eventMemory.importanceScore >= 0.6) {
      return {
        decision: 'SEND',
        reason: `Follow-up on meaningful event context: ${eventMemory.content.slice(0, 80)}`,
        confidence: 0.88,
        suggestedIntent: 'FOLLOW_UP_ON_TOPIC',
        supportingContextIds: [eventMemory.id],
      };
    }

    // B. Goal Check-in
    if (goalMemory && goalMemory.importanceScore >= 0.65) {
      return {
        decision: 'SEND',
        reason: `Follow-up on shared user goal: ${goalMemory.content.slice(0, 80)}`,
        confidence: 0.84,
        suggestedIntent: 'ASK_ABOUT_PREVIOUS_GOAL',
        supportingContextIds: [goalMemory.id],
      };
    }

    // C. Relevant Interest / Topic Prompt
    if (preferenceMemory && (relationshipStage === 'FRIEND' || relationshipStage === 'CLOSE_FRIEND' || relationshipStage === 'CONFIDANT' || relationshipStage === 'ROMANTIC_PARTNER')) {
      return {
        decision: 'SEND',
        reason: `Conversational invite based on shared user interest: ${preferenceMemory.content.slice(0, 80)}`,
        confidence: 0.78,
        suggestedIntent: 'OFFER_RELEVANT_INFORMATION',
        supportingContextIds: [preferenceMemory.id],
      };
    }

    // D. Character Configured Topic Prompts
    const preferredEventTypes = proactivityConfig?.preferredEventTypes || [];
    if (preferredEventTypes.includes('daily_greeting') || preferredEventTypes.includes('topic_followup')) {
      if (relationshipStage !== 'STRANGER') {
        return {
          decision: 'SEND',
          reason: 'Character-configured conversational prompt within active relationship.',
          confidence: 0.72,
          suggestedIntent: 'INVITE_LIGHT_CONVERSATION',
          supportingContextIds: [],
        };
      }
    }

    // E. Silence / Skip Decision (Default when no high-relevance trigger exists)
    return {
      decision: 'SKIP',
      skipReason: 'LOW_RELEVANCE_CONFIDENCE',
      reason: 'No high-confidence, meaningful topic or event trigger detected. Choosing silence to prevent notification fatigue.',
      confidence: 0.4,
      suggestedIntent: null,
      supportingContextIds: [],
    };
  }
}
