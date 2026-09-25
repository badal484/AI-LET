import { describe, it, expect } from 'vitest';
import { ProactiveSafetyValidator } from '../src/modules/notifications/services/proactiveSafetyValidator.service.js';

describe('Phase 7: ProactiveSafetyValidator', () => {
  it('should accept a polite, supportive, non-guilt outreach message', () => {
    const validMessage =
      'Hey! I was thinking about the astrophysics research project you mentioned yesterday. Hope your presentation went smoothly today!';
    const result = ProactiveSafetyValidator.validateProactiveMessage(validMessage, []);

    expect(result.isValid).toBe(true);
    expect(result.sanitizedContent).toBe(validMessage);
    expect(result.rejectionReason).toBeUndefined();
  });

  describe('Anti-Manipulation & Guilt Safeguards', () => {
    it('should reject guilt-tripping language regarding ignored messages', () => {
      const guiltMessage =
        'Why are you ignoring me? You promised you would reply back to me today.';
      const result = ProactiveSafetyValidator.validateProactiveMessage(guiltMessage, []);

      expect(result.isValid).toBe(false);
      expect(result.rejectionReason).toContain('emotional manipulation');
    });

    it('should reject artificial loneliness / emotional dependency claims', () => {
      const lonelyMessage = "I can't live without you right now.";
      const result = ProactiveSafetyValidator.validateProactiveMessage(lonelyMessage, []);

      expect(result.isValid).toBe(false);
      expect(result.rejectionReason).toContain('emotional manipulation');
    });

    it('should reject manufactured urgency and coercive commands', () => {
      const urgentMessage =
        'Reply right now! It is urgent!';
      const result = ProactiveSafetyValidator.validateProactiveMessage(urgentMessage, []);

      expect(result.isValid).toBe(false);
      expect(result.rejectionReason).toContain('emotional manipulation');
    });

    it('should reject fabricated physical proximity and real-world surveillance claims', () => {
      const creepingMessage = "I saw you walking near that store earlier today.";
      const result = ProactiveSafetyValidator.validateProactiveMessage(creepingMessage, []);

      expect(result.isValid).toBe(false);
      expect(result.rejectionReason).toContain('emotional manipulation');
    });
  });

  describe('Anti-Repetition & Token Jaccard Similarity', () => {
    it('should reject messages with high Jaccard token similarity to recent outreach', () => {
      const recentOutreach = [
        'Hey there! Just checking in to see how your morning coding session is going.',
      ];
      // High word overlap (> 0.82 similarity)
      const nearDuplicate =
        'Hey there! Just checking in to see how your morning coding session is going.';

      const result = ProactiveSafetyValidator.validateProactiveMessage(nearDuplicate, recentOutreach);

      expect(result.isValid).toBe(false);
      expect(result.rejectionReason).toContain('High repetition similarity');
    });

    it('should allow distinct messages across different topics', () => {
      const recentOutreach = [
        'Hey there! Just checking in to see how your morning coding session is going.',
      ];
      const freshMessage =
        'Did you get a chance to try that new Moroccan restaurant downtown you mentioned earlier this week?';

      const result = ProactiveSafetyValidator.validateProactiveMessage(freshMessage, recentOutreach);

      expect(result.isValid).toBe(true);
    });
  });

  describe('Length and Format Constraints', () => {
    it('should reject excessively short messages (< 5 characters)', () => {
      const short = 'Hey';
      const result = ProactiveSafetyValidator.validateProactiveMessage(short, []);
      expect(result.isValid).toBe(false);
      expect(result.rejectionReason).toContain('too short');
    });

    it('should trim surrounding whitespace', () => {
      const quoted = '   I found that article on quantum computing we discussed!   ';
      const result = ProactiveSafetyValidator.validateProactiveMessage(quoted, []);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedContent).toBe('I found that article on quantum computing we discussed!');
    });
  });
});
