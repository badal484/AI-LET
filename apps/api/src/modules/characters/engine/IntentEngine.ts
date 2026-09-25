import { DetectedIntent } from '@ai-companion/types';
import { logger } from '../../../shared/utils/logger.js';

export interface IntentEvaluationInput {
  message: string;
  previousMessages?: Array<{ role: string; content: string }>;
  activeGoalCategory?: string;
  hasAttachments?: boolean;
}

export class IntentEngine {
  private static instance: IntentEngine;

  private constructor() {}

  public static getInstance(): IntentEngine {
    if (!IntentEngine.instance) {
      IntentEngine.instance = new IntentEngine();
    }
    return IntentEngine.instance;
  }

  /**
   * Evaluates user input to detect structured intent with confidence scoring.
   * STRICT POLICY: Low confidence intent falls back to casual conversation / question
   * without triggering tools, payments, external mutations, or notifications.
   */
  public evaluateIntent(input: IntentEvaluationInput): DetectedIntent {
    const text = (input.message || '').trim().toLowerCase();
    const timestamp = new Date().toISOString();

    if (!text) {
      return {
        intent: 'casual_conversation',
        confidence: 1.0,
        source: 'fallback',
        timestamp,
      };
    }

    // 1. Multimodal intent
    if (input.hasAttachments) {
      return {
        intent: 'media_understanding',
        confidence: 0.95,
        source: 'rule_heuristic',
        category: 'multimodal',
        timestamp,
      };
    }

    // 2. Planning & Itinerary requests
    if (
      text.includes('plan my') ||
      text.includes('help me plan') ||
      text.includes('create a schedule') ||
      text.includes('itinerary') ||
      text.includes('travel to') ||
      text.includes('vacation plan')
    ) {
      return {
        intent: 'planning',
        confidence: 0.92,
        source: 'rule_heuristic',
        category: 'travel_planning',
        extractedEntities: {
          hasTimeline: text.includes('day') || text.includes('week') || text.includes('month'),
          hasBudget: text.includes('$') || text.includes('budget') || text.includes('cost'),
        },
        timestamp,
      };
    }

    // 3. Task / Action requests
    if (
      text.startsWith('remind me') ||
      text.includes('set a reminder') ||
      text.includes('remind me tomorrow') ||
      text.includes('schedule a reminder')
    ) {
      return {
        intent: 'reminder',
        confidence: 0.96,
        source: 'rule_heuristic',
        category: 'productivity',
        timestamp,
      };
    }

    if (
      text.includes('add to my calendar') ||
      text.includes('schedule a meeting') ||
      text.includes('book an appointment') ||
      text.includes('create an event')
    ) {
      return {
        intent: 'external_action',
        confidence: 0.91,
        source: 'rule_heuristic',
        category: 'calendar',
        timestamp,
      };
    }

    if (
      text.startsWith('draft an email') ||
      text.startsWith('send an email') ||
      text.includes('email to')
    ) {
      return {
        intent: 'task_request',
        confidence: 0.90,
        source: 'rule_heuristic',
        category: 'email',
        timestamp,
      };
    }

    // 4. Study / Interview / Research requests
    if (
      text.includes('mock interview') ||
      text.includes('practice interviewing') ||
      text.includes('interview prep') ||
      text.includes('quiz me') ||
      text.includes('study session')
    ) {
      return {
        intent: 'long_running_task',
        confidence: 0.89,
        source: 'rule_heuristic',
        category: 'education',
        timestamp,
      };
    }

    if (
      text.startsWith('research ') ||
      text.includes('find sources about') ||
      text.includes('summarize this document') ||
      text.includes('analyze the paper')
    ) {
      return {
        intent: 'information_lookup',
        confidence: 0.88,
        source: 'rule_heuristic',
        category: 'research',
        timestamp,
      };
    }

    // 5. Social action proposal
    if (
      text.includes('share this to community') ||
      text.includes('post on feed') ||
      text.includes('share character')
    ) {
      return {
        intent: 'social_action',
        confidence: 0.85,
        source: 'rule_heuristic',
        category: 'social',
        timestamp,
      };
    }

    // 6. Advice / Emotional support
    if (
      text.includes('i feel sad') ||
      text.includes('feeling down') ||
      text.includes('im stressed') ||
      text.includes('i need someone to talk to') ||
      text.includes('anxious about')
    ) {
      return {
        intent: 'emotional_support',
        confidence: 0.86,
        source: 'rule_heuristic',
        category: 'support',
        timestamp,
      };
    }

    if (
      text.startsWith('what should i do') ||
      text.startsWith('give me advice') ||
      text.includes('what do you recommend')
    ) {
      return {
        intent: 'advice',
        confidence: 0.82,
        source: 'rule_heuristic',
        timestamp,
      };
    }

    // 7. Creative writing / coding
    if (
      text.startsWith('write a ') ||
      text.startsWith('compose a ') ||
      text.includes('poem') ||
      text.includes('story') ||
      text.includes('roleplay')
    ) {
      return {
        intent: 'creative',
        confidence: 0.84,
        source: 'rule_heuristic',
        timestamp,
      };
    }

    // 8. General question
    if (
      text.endsWith('?') ||
      text.startsWith('who ') ||
      text.startsWith('what ') ||
      text.startsWith('when ') ||
      text.startsWith('where ') ||
      text.startsWith('why ') ||
      text.startsWith('how ')
    ) {
      return {
        intent: 'question',
        confidence: 0.85,
        source: 'rule_heuristic',
        timestamp,
      };
    }

    // 9. Safe fallback to casual conversation
    logger.debug(`IntentEngine: fallback to casual_conversation for input snippet "${text.slice(0, 40)}"`);
    return {
      intent: 'casual_conversation',
      confidence: 0.80,
      source: 'fallback',
      timestamp,
    };
  }
}
