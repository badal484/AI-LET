import type {
  RelationshipAnalysisResult,
  RelationshipAnalysisSignal,
  EmotionalTone,
  TopicSensitivity,
} from '@ai-companion/types';
import { relationshipAnalysisPayloadSchema } from '@ai-companion/validation';
import { AIOrchestrator } from '../../../infrastructure/ai/AIOrchestrator.js';
import { logger } from '../../../config/logger.js';

export interface InteractionAnalysisInput {
  userMessage: string;
  assistantMessage: string;
  characterName: string;
  characterRole?: string;
  hoursSinceLastInteraction?: number | null;
}

export class RelationshipAnalyzerService {
  private static readonly SYSTEM_EXTRACTION_PROMPT = `You are the Relationship Dynamics & Conversational Tone Analyzer for an AI companion platform.
Your task is to analyze the latest user-assistant conversation turn to identify meaningful relational interaction signals and the active conversational affect/tone.

Evaluate the interaction across these potential signal types:
- CASUAL_CHAT: Standard everyday dialogue, lightweight greetings, simple questions.
- SHARED_GOAL: The user shared a personal ambition, career goal, life milestone, or aspiration.
- SHARED_PREFERENCE: The user expressed a personal taste, habit, hobby, or lifestyle preference.
- MEANINGFUL_SUPPORT: The user shared a challenge, sadness, anxiety, or vulnerability, and received supportive empathy.
- DEEP_CONVERSATION: Philosophical, reflective, highly vulnerable, or intimate personal exploration.
- BOUNDARY_SET: The user explicitly asked the AI not to do something, expressed discomfort, or established interpersonal boundaries (e.g. "Don't call me that", "Keep it strictly professional").
- CORRECTION_GIVEN: The user politely or constructively corrected a misunderstanding by the AI.
- POSITIVE_FEEDBACK: The user explicitly expressed appreciation, praise, or joy regarding the interaction.
- NEGATIVE_FEEDBACK: The user expressed dissatisfaction, frustration, or annoyance.

Also classify the dominant conversational tone:
'neutral' | 'calm' | 'warm' | 'playful' | 'serious' | 'curious' | 'concerned' | 'excited' | 'reflective' | 'supportive'

Topic sensitivity: 'low' | 'normal' | 'high'

Return a strict JSON object adhering to this schema:
{
  "signals": [
    {
      "type": "CASUAL_CHAT | SHARED_GOAL | SHARED_PREFERENCE | MEANINGFUL_SUPPORT | DEEP_CONVERSATION | BOUNDARY_SET | CORRECTION_GIVEN | POSITIVE_FEEDBACK | NEGATIVE_FEEDBACK",
      "confidence": 0.0 - 1.0,
      "importance": 0.0 - 1.0,
      "description": "Brief description",
      "suggestedTone": "calm",
      "topicSensitivity": "low | normal | high",
      "memoryCandidate": null | { "content": "Fact or goal", "category": "GOAL | PREFERENCE | PERSONAL_FACT" }
    }
  ],
  "dominantTone": "calm",
  "energy": 0 - 100,
  "warmth": 0 - 100,
  "seriousness": 0 - 100,
  "engagement": 0 - 100,
  "topicSensitivity": "normal"
}`;

  /**
   * Analyzes an interaction turn using AI Orchestrator with structured JSON validation.
   * Falls back gracefully to heuristic analysis if AI service is unavailable.
   */
  public static async analyzeInteraction(
    input: InteractionAnalysisInput,
  ): Promise<RelationshipAnalysisResult> {
    const { userMessage, assistantMessage, characterName, hoursSinceLastInteraction } = input;

    try {
      const userPrompt = `Character: ${characterName}
Hours since last conversation: ${hoursSinceLastInteraction ?? 'N/A'}
User Message: "${userMessage.trim()}"
Assistant Response: "${assistantMessage.trim()}"`;

      const response = await AIOrchestrator.executeText(
        'mock',
        'gpt-4o-mini',
        [
          { role: 'system', content: this.SYSTEM_EXTRACTION_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        {
          temperature: 0.1,
          maxTokens: 500,
        },
      );

      if (response && response.content) {
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const validation = relationshipAnalysisPayloadSchema.safeParse(parsed);
          if (validation.success) {
            return validation.data as RelationshipAnalysisResult;
          }
          logger.warn(`Structured relationship analyzer validation error: ${validation.error.message}`);
        }
      }
    } catch (err: any) {
      logger.warn(`AI-based relationship analyzer failed: ${err.message}. Falling back to heuristic classifier.`);
    }

    // Heuristic fallback
    return this.heuristicAnalysis(userMessage, assistantMessage, hoursSinceLastInteraction);
  }

  /**
   * Fast rule-based heuristic classifier for offline testing, fallback, and zero-latency execution
   */
  public static heuristicAnalysis(
    userMessage: string,
    assistantMessage: string,
    hoursSinceLastInteraction?: number | null,
  ): RelationshipAnalysisResult {
    const text = userMessage.toLowerCase();
    const signals: RelationshipAnalysisSignal[] = [];
    let dominantTone: EmotionalTone = 'calm';
    let energy = 50;
    let warmth = 60;
    let seriousness = 40;
    let engagement = 60;
    let topicSensitivity: TopicSensitivity = 'normal';

    // 1. Reconnected / Return after break
    if (hoursSinceLastInteraction && hoursSinceLastInteraction >= 48) {
      signals.push({
        type: 'RETURN_AFTER_BREAK',
        confidence: 0.9,
        importance: 0.6,
        description: 'User returned after an absence of 48+ hours.',
        suggestedTone: 'warm',
        topicSensitivity: 'normal',
      });
      warmth += 10;
    }

    // 2. Boundary Set
    if (
      text.includes("don't call me") ||
      text.includes('stop calling me') ||
      text.includes('keep it professional') ||
      text.includes("don't ask") ||
      text.includes('boundaries')
    ) {
      signals.push({
        type: 'BOUNDARY_SET',
        confidence: 0.95,
        importance: 0.9,
        description: 'User defined an explicit boundary.',
        suggestedTone: 'serious',
        topicSensitivity: 'high',
      });
      dominantTone = 'serious';
      seriousness = 80;
      warmth = 40;
      topicSensitivity = 'high';
    }
    // 3. User Correction
    else if (
      text.includes('you misunderstood') ||
      text.includes('i did not say that') ||
      text.includes('not what i meant') ||
      text.includes('actually i meant')
    ) {
      signals.push({
        type: 'CORRECTION_GIVEN',
        confidence: 0.85,
        importance: 0.6,
        description: 'User calibrated a misunderstanding.',
        suggestedTone: 'calm',
        topicSensitivity: 'normal',
      });
      dominantTone = 'reflective';
      seriousness = 60;
    }
    // 4. Meaningful Support
    else if (
      text.includes('sad') ||
      text.includes('depressed') ||
      text.includes('anxious') ||
      text.includes('rough day') ||
      text.includes('lost my') ||
      text.includes('grief') ||
      text.includes('stress') ||
      text.includes('lonely')
    ) {
      signals.push({
        type: 'MEANINGFUL_SUPPORT',
        confidence: 0.9,
        importance: 0.8,
        description: 'User sought emotional support during a vulnerable moment.',
        suggestedTone: 'supportive',
        topicSensitivity: 'high',
      });
      dominantTone = 'supportive';
      warmth = 85;
      seriousness = 75;
      topicSensitivity = 'high';
    }
    // 5. Shared Goal
    else if (
      text.includes('my goal is') ||
      text.includes('i want to achieve') ||
      text.includes('planning to launch') ||
      text.includes('aiming to') ||
      text.includes('dream of')
    ) {
      signals.push({
        type: 'SHARED_GOAL',
        confidence: 0.88,
        importance: 0.75,
        description: 'User shared an important personal or career objective.',
        suggestedTone: 'excited',
        topicSensitivity: 'normal',
        memoryCandidate: {
          content: `User goal: ${userMessage.slice(0, 150)}`,
          category: 'GOAL',
        },
      });
      dominantTone = 'excited';
      energy = 75;
      warmth = 70;
    }
    // 6. Positive Feedback
    else if (
      text.includes('thank you') ||
      text.includes('love this') ||
      text.includes('you are amazing') ||
      text.includes('great response') ||
      text.includes('appreciate you')
    ) {
      signals.push({
        type: 'POSITIVE_FEEDBACK',
        confidence: 0.85,
        importance: 0.5,
        description: 'User expressed gratitude and positive reinforcement.',
        suggestedTone: 'warm',
        topicSensitivity: 'low',
      });
      dominantTone = 'warm';
      warmth = 80;
      energy = 65;
    }
    // 7. Negative Feedback
    else if (
      text.includes('this is terrible') ||
      text.includes('you are annoying') ||
      text.includes('bad answer') ||
      text.includes('i hate this')
    ) {
      signals.push({
        type: 'NEGATIVE_FEEDBACK',
        confidence: 0.85,
        importance: 0.6,
        description: 'User expressed frustration with response quality.',
        suggestedTone: 'calm',
        topicSensitivity: 'normal',
      });
      dominantTone = 'calm';
      seriousness = 70;
      warmth = 40;
    }
    // 8. Deep Conversation
    else if (userMessage.length > 250 && assistantMessage.length > 250) {
      signals.push({
        type: 'DEEP_CONVERSATION',
        confidence: 0.75,
        importance: 0.7,
        description: 'Detailed, reflective dialogue turn.',
        suggestedTone: 'reflective',
        topicSensitivity: 'normal',
      });
      dominantTone = 'reflective';
      seriousness = 60;
      engagement = 75;
    }
    // 9. Casual Chat default
    else {
      signals.push({
        type: 'CASUAL_CHAT',
        confidence: 0.8,
        importance: 0.3,
        description: 'Standard conversational interaction.',
        suggestedTone: 'calm',
        topicSensitivity: 'low',
      });
    }

    return {
      signals,
      dominantTone,
      energy,
      warmth,
      seriousness,
      engagement,
      topicSensitivity,
    };
  }
}
