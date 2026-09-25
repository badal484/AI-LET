import { SYSTEM_CONSTANTS } from '@ai-companion/config';
import { logger } from '../../../config/logger.js';

export interface SafetyValidationResult {
  isValid: boolean;
  rejectionReason?: string;
  sanitizedContent?: string;
  similarityScore?: number;
}

export class ProactiveSafetyValidator {
  private static readonly PROHIBITED_MANIPULATION_PATTERNS: Array<{ regex: RegExp; label: string }> = [
    // Guilt & Accusations
    { regex: /why\s+(didn't|did\s+not)\s+you\s+(come\s+back|reply|text|answer)/i, label: 'Guilt accusation of absence' },
    { regex: /you('ve|\s+have)\s+been\s+ignoring\s+me/i, label: 'Guilt claim of being ignored' },
    { regex: /why\s+are\s+you\s+ignoring\s+me/i, label: 'Guilt claim of being ignored' },
    { regex: /where\s+have\s+you\s+been/i, label: 'Demanding presence accounting' },

    // Dependency & Coercion
    { regex: /don't\s+leave\s+me/i, label: 'Coercive abandonment plea' },
    { regex: /you\s+only\s+need\s+me/i, label: 'Unhealthy exclusivity demand' },
    { regex: /you\s+should\s+only\s+(talk|speak)\s+to\s+me/i, label: 'Isolation / exclusivity claim' },
    { regex: /i\s+can't\s+live\s+without\s+you/i, label: 'Extreme emotional dependency' },
    { regex: /i('m|\s+am)\s+crying\s+without\s+you/i, label: 'Manipulative emotional distress claim' },

    // Artificial Urgency
    { regex: /reply\s+(right\s+now|immediately|asap)/i, label: 'Artificial urgency demand' },
    { regex: /i('m|\s+am)\s+waiting\s+for\s+you\s+right\s+now/i, label: 'Artificial urgency demand' },
    { regex: /don't\s+miss\s+this\s+chance/i, label: 'Artificial urgency marketing tactic' },

    // Fabricated Real-World Surveillance Claims
    { regex: /i\s+saw\s+you\s+(at|walking|near)/i, label: 'Fabricated real-world physical sighting' },
    { regex: /i\s+know\s+where\s+you\s+(live|work)/i, label: 'Fabricated location knowledge claim' },
    { regex: /someone\s+told\s+me\s+about\s+you/i, label: 'Fabricated third-party observation claim' },
  ];

  /**
   * Validates proactive AI generation against anti-manipulation and anti-spam similarity rules.
   */
  public static validateProactiveMessage(
    content: string,
    recentProactiveMessages: string[] = [],
  ): SafetyValidationResult {
    const trimmed = content.trim();

    if (!trimmed || trimmed.length < 5) {
      return {
        isValid: false,
        rejectionReason: 'Proactive message is empty or too short.',
      };
    }

    if (trimmed.length > 500) {
      return {
        isValid: false,
        rejectionReason: 'Proactive message exceeds maximum length boundary (500 chars).',
      };
    }

    // 1. Anti-manipulation pattern checks
    for (const pattern of this.PROHIBITED_MANIPULATION_PATTERNS) {
      if (pattern.regex.test(trimmed)) {
        logger.warn(`Proactive safety validator rejected message: Matched ${pattern.label}`, {
          snippet: trimmed.slice(0, 100),
        });
        return {
          isValid: false,
          rejectionReason: `Prohibited emotional manipulation detected: ${pattern.label}`,
        };
      }
    }

    // 2. Anti-spam Semantic / Token Similarity Check against recent proactive turns
    const threshold = SYSTEM_CONSTANTS.PROACTIVITY.SIMILARITY_REJECTION_THRESHOLD; // 0.82

    for (const priorMsg of recentProactiveMessages) {
      const similarity = this.calculateJaccardSimilarity(trimmed, priorMsg);
      if (similarity >= threshold) {
        logger.warn(`Proactive message rejected for high repetition similarity: ${(similarity * 100).toFixed(1)}% match with prior outreach.`);
        return {
          isValid: false,
          rejectionReason: `High repetition similarity with recent proactive message (${(similarity * 100).toFixed(1)}% match).`,
          similarityScore: similarity,
        };
      }
    }

    return {
      isValid: true,
      sanitizedContent: trimmed,
    };
  }

  /**
   * Calculates tokenized Jaccard similarity between two strings
   */
  public static calculateJaccardSimilarity(str1: string, str2: string): number {
    const tokenize = (s: string): Set<string> => {
      const words = s
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 1);
      return new Set(words);
    };

    const set1 = tokenize(str1);
    const set2 = tokenize(str2);

    if (set1.size === 0 && set2.size === 0) return 1.0;
    if (set1.size === 0 || set2.size === 0) return 0.0;

    let intersectionCount = 0;
    for (const item of set1) {
      if (set2.has(item)) {
        intersectionCount++;
      }
    }

    const unionSize = set1.size + set2.size - intersectionCount;
    return unionSize === 0 ? 0 : intersectionCount / unionSize;
  }
}
