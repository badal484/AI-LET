import { describe, it, expect } from 'vitest';
import { IntentEngine } from '../../src/modules/characters/engine/IntentEngine.js';

describe('Phase 25 — IntentEngine', () => {
  const engine = IntentEngine.getInstance();

  it('classifies casual conversation with safe fallback', () => {
    const result = engine.evaluateIntent({ message: 'hey there how are you doing' });
    expect(result.intent).toBe('casual_conversation');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    expect(result.source).toBe('fallback');
  });

  it('classifies questions correctly', () => {
    const result = engine.evaluateIntent({ message: 'What is the speed of light?' });
    expect(result.intent).toBe('question');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    expect(result.source).toBe('rule_heuristic');
  });

  it('detects planning and itinerary requests with entity heuristics', () => {
    const result = engine.evaluateIntent({ message: 'Help me plan my 3 day trip to Tokyo with a $500 budget' });
    expect(result.intent).toBe('planning');
    expect(result.category).toBe('travel_planning');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.extractedEntities).toBeDefined();
    expect(result.extractedEntities?.hasTimeline).toBe(true);
    expect(result.extractedEntities?.hasBudget).toBe(true);
  });

  it('detects reminder and calendar requests without false triggers', () => {
    const reminder = engine.evaluateIntent({ message: 'Remind me tomorrow at 9am to check flight status' });
    expect(reminder.intent).toBe('reminder');
    expect(reminder.confidence).toBeGreaterThan(0.9);

    const cal = engine.evaluateIntent({ message: 'Please add to my calendar meeting with Alex' });
    expect(cal.intent).toBe('external_action');
    expect(cal.category).toBe('calendar');
  });

  it('detects study and interview prep sessions', () => {
    const interview = engine.evaluateIntent({ message: "Let's do a mock interview for product manager" });
    expect(interview.intent).toBe('long_running_task');
    expect(interview.category).toBe('education');
  });

  it('detects emotional support requests', () => {
    const support = engine.evaluateIntent({ message: 'I feel sad and overwhelmed today' });
    expect(support.intent).toBe('emotional_support');
    expect(support.category).toBe('support');
  });

  it('handles multimodal attachment intent', () => {
    const multi = engine.evaluateIntent({ message: 'What do you think of this?', hasAttachments: true });
    expect(multi.intent).toBe('media_understanding');
    expect(multi.category).toBe('multimodal');
  });

  it('falls back safely for empty or ambiguous text without side-effects', () => {
    const empty = engine.evaluateIntent({ message: '' });
    expect(empty.intent).toBe('casual_conversation');
    expect(empty.source).toBe('fallback');

    const ambiguous = engine.evaluateIntent({ message: 'maybe later on' });
    expect(ambiguous.intent).toBe('casual_conversation');
  });
});
