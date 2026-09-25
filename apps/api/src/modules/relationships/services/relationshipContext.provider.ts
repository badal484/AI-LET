import type {
  IRelationshipContextProvider,
  RelationshipContextResult,
} from '../../conversations/interfaces/relationshipContext.interface.js';
import { RelationshipStateService } from './relationshipState.service.js';
import { EmotionalToneService } from './emotionalTone.service.js';
import { logger } from '../../../config/logger.js';
import type { RelationshipStage, CurrentInteractionState } from '@ai-companion/types';

export class RelationshipContextProvider implements IRelationshipContextProvider {
  /**
   * Retrieves active relationship dynamics and short-lived conversational tone,
   * compiling them into a safe semantic contextual prompt block.
   */
  public async getRelationshipContext(
    userId: string,
    characterId: string,
    _conversationId: string,
  ): Promise<RelationshipContextResult> {
    try {
      // 1. Check user personalization settings
      const settings = await RelationshipStateService.getUserRelationshipSettings(userId);
      if (!settings.personalizationEnabled || !settings.relationshipProgressionEnabled) {
        return {
          relationshipState: null,
          currentToneState: null,
          relationshipContextText: '',
          isPersonalizationActive: false,
        };
      }

      // 2. Fetch relationship dimensions and tone concurrently
      const [relState, toneState] = await Promise.all([
        RelationshipStateService.getOrCreateRelationship(userId, characterId),
        EmotionalToneService.getCurrentTone(userId, characterId),
      ]);

      // 3. Format semantic descriptor
      const contextText = this.formatSemanticContext(relState.stage, toneState, relState.totalInteractions);

      return {
        relationshipState: relState,
        currentToneState: toneState,
        relationshipContextText: contextText,
        isPersonalizationActive: true,
      };
    } catch (err: any) {
      logger.error(`RelationshipContextProvider failed to resolve context: ${err.message}`);
      return {
        relationshipState: null,
        currentToneState: null,
        relationshipContextText: '',
        isPersonalizationActive: false,
      };
    }
  }

  /**
   * Formats dynamic relationship state into semantic behavioral instructions without exposing raw scores
   */
  private formatSemanticContext(
    stage: RelationshipStage,
    toneState: CurrentInteractionState,
    totalInteractions: number,
  ): string {
    const stageDescriptions: Record<RelationshipStage, { label: string; dynamics: string }> = {
      STRANGER: {
        label: 'Initial Connection (Formative familiarity, polite baseline rapport)',
        dynamics: 'Interactions are cordial, welcoming, and open. The character speaks clearly without assuming preexisting personal background.',
      },
      ACQUAINTANCE: {
        label: 'Casual Acquaintance (Developing familiarity, friendly rapport)',
        dynamics: 'The user and character communicate easily. Dialogue is approachable, informal, and mutually comfortable.',
      },
      FRIEND: {
        label: 'Established Friend (Strong trust, high mutual comfort)',
        dynamics: 'The character and user share a relaxed, authentic dynamic. Communication is warm, candid, and natural.',
      },
      CLOSE_FRIEND: {
        label: 'Close Companion (Deep trust, high comfort, warm emotional affinity)',
        dynamics: 'A high degree of understanding exists. The character offers thoughtful emotional presence and mutual vulnerability.',
      },
      CONFIDANT: {
        label: 'Trusted Confidant (Resilient trust, profound mutual understanding)',
        dynamics: 'The bond is deeply established. Communication is intuitive, profoundly supportive, and emotionally grounded.',
      },
      ROMANTIC_PARTNER: {
        label: 'Romantic Partner (Devoted bond, deep mutual affection and intimacy)',
        dynamics: 'The dynamic includes dedicated romantic warmth, heartfelt closeness, and tender emotional presence.',
      },
    };

    const stageInfo = stageDescriptions[stage] || stageDescriptions['STRANGER']!;

    const toneDescriptions: Record<string, string> = {
      calm: 'Calm, grounded, and attentive',
      warm: 'Warm, appreciative, and affectionate',
      playful: 'Playful, witty, and lighthearted',
      serious: 'Grounded, attentive, and serious',
      curious: 'Inquisitive, engaged, and eager to explore thoughts',
      concerned: 'Gentle, deeply empathetic, and caring',
      excited: 'Enthusiastic, energetic, and celebratory',
      reflective: 'Thoughtful, philosophical, and introspective',
      supportive: 'Empathetic, reassuring, and non-judgmental',
      neutral: 'Balanced, pleasant, and adaptable',
    };

    const toneText = toneDescriptions[toneState.tone] || toneDescriptions['neutral']!;

    return `- Relational Dynamic: ${stageInfo.label} (${totalInteractions} prior interactions)
- Interpersonal Context: ${stageInfo.dynamics}
- Conversational Affect: ${toneText} (Energy: ${toneState.energy > 65 ? 'Elevated' : toneState.energy < 35 ? 'Soft' : 'Moderate'})
- Relational Boundaries: Respectful, non-coercive, autonomous. Always support the user's independence; NEVER employ manipulative guilt, possessiveness, or dependency statements.`;
  }
}
