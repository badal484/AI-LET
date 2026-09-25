import { describe, it, expect } from 'vitest';
import { CharacterRuntimeSnapshotService } from '../../src/modules/characters/engine/CharacterRuntimeSnapshotService.js';
import { prisma } from '../../src/infrastructure/database/prisma.js';

describe('Phase 25 — CharacterRuntimeSnapshotService', () => {
  const service = CharacterRuntimeSnapshotService.getInstance();
  const testConvoId = `convo_snap_${Date.now()}`;
  const testMsgId = `msg_snap_${Date.now()}`;

  it('captures an immutable generation snapshot and enables explainability', async () => {
    const captured = await service.captureSnapshot({
      conversationId: testConvoId,
      messageId: testMsgId,
      characterId: 'char_maya_001',
      characterVersionId: 'ver_1.0.0',
      promptVersion: 'v1.0.0',
      behaviorPolicyData: { tone: 'empathetic', boundaries: ['no_harm'] },
      safetyPolicyVersion: 'v25.0.0',
      modelId: 'gpt-4o',
      memoryIds: ['mem_1', 'mem_2'],
      relationshipStage: 'FRIEND',
      activeGoalId: 'goal_study_1',
      selectedSkillSlugs: ['study_assistant'],
      contextAttribution: { memories: ['mem_1'], goals: ['goal_study_1'] },
      tokensPrompt: 450,
      tokensCompletion: 80,
      costUsd: 0.003,
    });

    expect(captured.id).toBeDefined();
    expect(captured.behaviorPolicyHash).toBeDefined();
    expect(captured.tokensPrompt).toBe(450);

    // Verify explainGeneration returns this exact record
    const explained = await service.explainGeneration(testMsgId);
    expect(explained).toBeDefined();
    expect(explained?.id).toBe(captured.id);
    expect(explained?.modelId).toBe('gpt-4o');
    expect(explained?.memoryIds).toEqual(['mem_1', 'mem_2']);
    expect(explained?.activeGoalId).toBe('goal_study_1');

    // Clean up
    await prisma.characterRuntimeSnapshot.delete({ where: { id: captured.id } });
  });
});
