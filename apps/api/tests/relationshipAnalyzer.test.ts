import { describe, it, expect } from 'vitest';
import { RelationshipAnalyzerService } from '../src/modules/relationships/services/relationshipAnalyzer.service.js';

describe('Phase 6: RelationshipAnalyzerService', () => {
  it('should classify boundary events and elevate seriousness and topic sensitivity', () => {
    const result = RelationshipAnalyzerService.heuristicAnalysis(
      "Don't call me sweetie, please keep our conversations strictly professional.",
      'Understood. I will address you professionally and respect your boundaries.',
      null,
    );

    expect(result.signals.some(s => s.type === 'BOUNDARY_SET')).toBe(true);
    expect(result.dominantTone).toBe('serious');
    expect(result.seriousness).toBeGreaterThanOrEqual(70);
    expect(result.topicSensitivity).toBe('high');
  });

  it('should detect shared goals and emit memory candidates', () => {
    const result = RelationshipAnalyzerService.heuristicAnalysis(
      'My goal is to launch my AI startup by next quarter and secure seed funding.',
      'That is an inspiring goal! What are the primary milestones you are tackling first?',
      null,
    );

    const goalSignal = result.signals.find(s => s.type === 'SHARED_GOAL');
    expect(goalSignal).toBeDefined();
    expect(goalSignal?.memoryCandidate?.category).toBe('GOAL');
    expect(result.dominantTone).toBe('excited');
    expect(result.energy).toBeGreaterThanOrEqual(70);
  });

  it('should classify emotional vulnerability as meaningful support', () => {
    const result = RelationshipAnalyzerService.heuristicAnalysis(
      'I am feeling really anxious and lonely today after a tough week at work.',
      'I am so sorry you are going through this. I am here for you—take all the time you need.',
      null,
    );

    expect(result.signals.some(s => s.type === 'MEANINGFUL_SUPPORT')).toBe(true);
    expect(result.dominantTone).toBe('supportive');
    expect(result.warmth).toBeGreaterThanOrEqual(80);
    expect(result.topicSensitivity).toBe('high');
  });

  it('should detect positive feedback and user gratitude', () => {
    const result = RelationshipAnalyzerService.heuristicAnalysis(
      'Thank you so much, you are amazing and I love talking with you!',
      'You are very welcome! It is always a pleasure chatting with you.',
      null,
    );

    expect(result.signals.some(s => s.type === 'POSITIVE_FEEDBACK')).toBe(true);
    expect(result.dominantTone).toBe('warm');
    expect(result.warmth).toBeGreaterThanOrEqual(75);
  });

  it('should classify return after long break', () => {
    const result = RelationshipAnalyzerService.heuristicAnalysis(
      'Hey there, it has been a while!',
      'Welcome back! It is great to hear from you again.',
      72, // 72 hours since last turn
    );

    expect(result.signals.some(s => s.type === 'RETURN_AFTER_BREAK')).toBe(true);
  });
});
