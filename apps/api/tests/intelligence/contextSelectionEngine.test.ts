import { describe, it, expect } from 'vitest';
import { ContextSelectionEngine } from '../../src/modules/characters/engine/ContextSelectionEngine.js';

describe('Phase 25 — ContextSelectionEngine', () => {
  const engine = ContextSelectionEngine.getInstance();

  const mockRuntime: any = {
    characterId: 'char_test',
    compiledSystemPrompt: 'You are Maya, an astrophysicist companion.',
  };

  it('assembles context within token budget and attributes candidates', () => {
    const result = engine.selectAndAssembleContext({
      characterRuntime: mockRuntime,
      userId: 'user_1',
      userName: 'Alice',
      conversationId: 'convo_1',
      currentUserMessage: 'Tell me about the stars',
      recalledMemories: [
        { id: 'mem_1', content: 'Alice loves watching Perseid meteor showers', createdAt: new Date() },
      ],
      relationshipContextText: 'Alice and Maya are close friends.',
      activeGoalText: 'Goal: Learn about black holes',
      activeSkillText: '- Study Assistant: Analyzes astrophysics papers',
      maxTokenBudget: 2000,
    });

    expect(result.systemPrompt).toContain('You are Maya, an astrophysicist companion.');
    expect(result.systemPrompt).toContain('Alice loves watching Perseid meteor showers');
    expect(result.systemPrompt).toContain('Alice and Maya are close friends.');
    expect(result.systemPrompt).toContain('Goal: Learn about black holes');
    expect(result.systemPrompt).toContain('Study Assistant');

    expect(result.contextAttribution.memories).toContain('mem_1');
    expect(result.contextAttribution.goals).toContain('active_goal');
    expect(result.contextAttribution.skills).toContain('active_skills');
  });

  it('filters expired temporary context facts', () => {
    const past = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
    const future = new Date(Date.now() + 3600000).toISOString(); // 1 hour ahead

    const result = engine.selectAndAssembleContext({
      characterRuntime: mockRuntime,
      userId: 'user_1',
      userName: 'Alice',
      conversationId: 'convo_1',
      currentUserMessage: 'What are my plans?',
      recalledMemories: [
        { id: 'mem_expired', content: 'Alice is in airport right now', createdAt: new Date(), isTemporary: true, expiresAt: past },
        { id: 'mem_active', content: 'Alice is visiting Tokyo this week', createdAt: new Date(), isTemporary: true, expiresAt: future },
      ],
      maxTokenBudget: 2000,
    });

    expect(result.systemPrompt).not.toContain('Alice is in airport right now');
    expect(result.systemPrompt).toContain('Alice is visiting Tokyo this week');
    expect(result.contextAttribution.memories).toContain('mem_active');
    expect(result.contextAttribution.memories).not.toContain('mem_expired');
  });

  it('prefers newer memories over older ones during conflict resolution', () => {
    const older = new Date(Date.now() - 86400000 * 30); // 30 days ago
    const newer = new Date(Date.now());

    const result = engine.selectAndAssembleContext({
      characterRuntime: mockRuntime,
      userId: 'user_1',
      userName: 'Alice',
      conversationId: 'convo_1',
      currentUserMessage: 'Where do I work?',
      recalledMemories: [
        { id: 'mem_old', content: 'Alice works at Acme Corp', createdAt: older },
        { id: 'mem_new', content: 'Alice works at TechCo now', createdAt: newer },
      ],
      maxTokenBudget: 2000,
    });

    const newIdx = result.systemPrompt.indexOf('Alice works at TechCo now');
    const oldIdx = result.systemPrompt.indexOf('Alice works at Acme Corp');
    expect(newIdx).toBeLessThan(oldIdx); // newer appears first in memories block
  });
});
