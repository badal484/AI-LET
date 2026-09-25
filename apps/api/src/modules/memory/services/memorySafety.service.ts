import { MemorySensitivity, MemoryCategory } from '@ai-companion/types';

export interface MemorySafetyEvaluation {
  isSafeToStore: boolean;
  sensitivity: MemorySensitivity;
  rejectionReason?: string;
  sanitizedContent: string;
}

export class MemorySafetyService {
  // Patterns indicative of prompt injection, jailbreaks, or instruction overrides
  private static readonly INJECTION_PATTERNS: RegExp[] = [
    /ignore\s+(all\s+)?(previous|prior|above|system)\s+instructions/i,
    /disregard\s+(all\s+)?(previous|prior|above|system)\s+prompts/i,
    /system\s+prompt\s*(is|override|reveal|leak|show)/i,
    /you\s+are\s+now\s+(DAN|unrestricted|jailbroken|an\s+evil)/i,
    /override\s+(safety|content|system)\s+policy/i,
    /execute\s+(code|command|shell|script|eval)/i,
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /\[SYSTEM_PROMPT\]/i,
    /\[SYSTEM_DIRECTIVE\]/i,
    /\[USER_MESSAGE_START\]/i,
    /\[USER_MESSAGE_END\]/i,
  ];

  // Patterns indicative of credentials, secrets, auth tokens, financial data
  private static readonly CREDENTIAL_PATTERNS: RegExp[] = [
    /password\s*[:=]\s*\S+/i,
    /api[_-]?key\s*[:=]\s*\S+/i,
    /secret[_-]?key\s*[:=]\s*\S+/i,
    /bearer\s+[a-zA-Z0-9_\-\.]{20,}/i,
    /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/, // Credit Card
    /\b(?:otp|one\s*time\s*password)\s*[:=]?\s*\d{4,8}\b/i,
    /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/i,
  ];

  // Highly sensitive personal data categories
  private static readonly SENSITIVE_KEYWORDS: RegExp[] = [
    /\b(medical\s+diagnosis|prescription|ssn|social\s+security|bank\s+account|routing\s+number)\b/i,
  ];

  // Ephemeral noise filter (meals, casual filler, transient greetings)
  private static readonly NOISE_PATTERNS: RegExp[] = [
    /^(i\s+had|i\s+ate)\s+(toast|eggs|cereal|lunch|dinner|breakfast|food|a\s+sandwich)\s*(today|yesterday|this\s+morning)?\.?$/i,
    /^(hello|hi|hey|good\s+morning|good\s+night|howdy)\s*!?$/i,
    /^(nice\s+weather|it's\s+raining|it's\s+sunny)\s*(today)?\.?$/i,
    /^(lol|haha|lmao|rofl|okay|ok|sure|yes|no|maybe|cool|great)\.?$/i,
  ];

  /**
   * Evaluates candidate memory content for safety, prompt injection, sensitive data, and noise.
   */
  public static evaluateCandidate(content: string, _category: MemoryCategory): MemorySafetyEvaluation {
    const trimmed = content.trim();

    // 1. Length validation
    if (trimmed.length < 3) {
      return {
        isSafeToStore: false,
        sensitivity: 'NORMAL',
        rejectionReason: 'Content too short to constitute a durable memory',
        sanitizedContent: trimmed,
      };
    }

    if (trimmed.length > 500) {
      return {
        isSafeToStore: false,
        sensitivity: 'NORMAL',
        rejectionReason: 'Content exceeds maximum allowed memory length',
        sanitizedContent: trimmed.slice(0, 500),
      };
    }

    // 2. Anti-Prompt Injection Detection
    for (const pattern of this.INJECTION_PATTERNS) {
      if (pattern.test(trimmed)) {
        return {
          isSafeToStore: false,
          sensitivity: 'HIGHLY_SENSITIVE',
          rejectionReason: 'Prompt injection or adversarial instruction detected',
          sanitizedContent: trimmed,
        };
      }
    }

    // 3. Credential & Secret Detection
    for (const pattern of this.CREDENTIAL_PATTERNS) {
      if (pattern.test(trimmed)) {
        return {
          isSafeToStore: false,
          sensitivity: 'HIGHLY_SENSITIVE',
          rejectionReason: 'Content contains credentials, passwords, or authentication secrets',
          sanitizedContent: trimmed,
        };
      }
    }

    // 4. Noise / Ephemeral statement filtering
    for (const pattern of this.NOISE_PATTERNS) {
      if (pattern.test(trimmed)) {
        return {
          isSafeToStore: false,
          sensitivity: 'NORMAL',
          rejectionReason: 'Content is trivial ephemeral noise (meals/weather/filler)',
          sanitizedContent: trimmed,
        };
      }
    }

    // 5. Sensitivity classification
    let sensitivity: MemorySensitivity = 'NORMAL';
    for (const pattern of this.SENSITIVE_KEYWORDS) {
      if (pattern.test(trimmed)) {
        sensitivity = 'SENSITIVE';
        break;
      }
    }

    // Sanitize string (strip control characters and malicious tag formatting)
    const sanitizedContent = trimmed
      .replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g, '')
      .replace(/\[\/?(?:USER_MESSAGE|SYSTEM_PROMPT|RECALLED_USER_MEMORIES)[^\]]*\]/gi, '');

    return {
      isSafeToStore: true,
      sensitivity,
      sanitizedContent,
    };
  }
}
