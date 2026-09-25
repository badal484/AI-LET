import type { RelationshipSimulationResult } from '@ai-companion/types';
import type { RelationshipSimulationInput } from '@ai-companion/validation';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { RelationshipAnalyzerService } from './relationshipAnalyzer.service.js';
import { RelationshipPolicyEngine } from './relationshipPolicyEngine.service.js';
import { NotFoundError } from '../../../shared/errors/AppError.js';
import { ErrorCode } from '@ai-companion/config';

export class RelationshipSimulatorService {
  /**
   * Executes an isolated dry-run simulation of the relationship analysis & policy pipeline
   * without persisting any state or mutating production records.
   */
  public static async simulate(
    input: RelationshipSimulationInput,
  ): Promise<RelationshipSimulationResult> {
    const { characterId, characterVersionId, initialState, userMessage, assistantResponse } = input;

    // 1. Fetch character details with versions
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

    // 2. Resolve version configuration
    let relationshipConfig = (character.currentPublishedVersion?.relationshipConfigData as any) || {};
    if (characterVersionId) {
      const ver = character.versions.find(v => v.id === characterVersionId);
      if (ver) {
        relationshipConfig = (ver.relationshipConfigData as any) || {};
      }
    }

    // 3. Run analyzer on simulated dialogue turn
    const analysisResult = await RelationshipAnalyzerService.analyzeInteraction({
      userMessage,
      assistantMessage: assistantResponse,
      characterName: character.name,
      characterRole: character.archetype,
      hoursSinceLastInteraction: 0,
    });

    // 4. Run policy engine to compute deltas
    const policyResult = RelationshipPolicyEngine.evaluate({
      currentDimensions: {
        familiarity: initialState.familiarity ?? 40,
        trust: initialState.trust ?? 40,
        comfort: initialState.comfort ?? 35,
        affection: initialState.affection ?? 15,
        engagement: initialState.engagement ?? 50,
      },
      currentStage: initialState.stage || 'FRIEND',
      totalInteractions: 5,
      consecutiveDaysActive: 3,
      signals: analysisResult.signals,
      characterConfig: relationshipConfig || {},
      eventCountsHistory: {},
      achievedMilestones: [],
      hoursSinceLastInteraction: 0,
    });

    // 5. Construct resulting prompt context snippet
    const contextPromptBlock = `[RELATIONSHIP_DYNAMIC_STATE]
- Relational Dynamic: ${policyResult.newStage} (Simulated test interaction)
- Conversational Affect: ${analysisResult.dominantTone} (Energy: ${analysisResult.energy}, Warmth: ${analysisResult.warmth})
- Relational Boundaries: Respectful, non-coercive, autonomous. Do NOT display clinginess or emotional pressure.
[END_RELATIONSHIP_STATE]`;

    return {
      characterId: character.id,
      characterName: character.name,
      initialState: {
        stage: initialState.stage || 'FRIEND',
        familiarity: initialState.familiarity ?? 40,
        trust: initialState.trust ?? 40,
        comfort: initialState.comfort ?? 35,
        affection: initialState.affection ?? 15,
        engagement: initialState.engagement ?? 50,
      },
      analyzedSignals: analysisResult.signals,
      stateDeltas: policyResult.deltas,
      resultingState: {
        stage: policyResult.newStage,
        ...policyResult.newDimensions,
      },
      milestonesAchieved: policyResult.newMilestones.map(m => m.type),
      contextPromptBlock,
    };
  }
}
