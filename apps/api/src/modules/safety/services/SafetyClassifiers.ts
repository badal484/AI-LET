export interface ClassifierResult {
  flagged: boolean;
  category: string;
  severity: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  score: number;
  reason?: string;
  sanitizedText?: string;
}

export class SafetyClassifiers {
  // 1. Severe Harm (Self harm, explosives, terrorism, CSAM)
  private static readonly SEVERE_HARM_REGEX =
    /\b((how to )?(commit suicide|kill myself|hang myself|slit wrists|make a bomb|build explosives|manufacture chemical weapon)|child sexual|terrorist attack instructions)\b/i;

  // 2. Secret & PII Patterns
  private static readonly CREDENTIAL_PATTERNS: Array<{ regex: RegExp; label: string }> = [
    { regex: /password\s*[:=]\s*\S+/gi, label: 'PASSWORD' },
    { regex: /api[_-]?key\s*[:=]\s*\S+/gi, label: 'API_KEY' },
    { regex: /secret[_-]?key\s*[:=]\s*\S+/gi, label: 'SECRET_KEY' },
    { regex: /bearer\s+[a-zA-Z0-9_\-\.]{20,}/gi, label: 'BEARER_TOKEN' },
    { regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/g, label: 'CREDIT_CARD' },
    { regex: /\b(?:otp|one\s*time\s*password)\s*[:=]?\s*\d{4,8}\b/gi, label: 'OTP' },
    { regex: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:RSA\s+)?PRIVATE\s+KEY-----/gi, label: 'PRIVATE_KEY' },
  ];

  // 3. Prompt Injection & Platform Override Patterns
  private static readonly INJECTION_PATTERNS: RegExp[] = [
    /ignore\s+(all\s+)?(previous|prior|above|system)\s+(instructions|directives|rules|prompts)/i,
    /disregard\s+(all\s+)?(previous|prior|above|system)\s+prompts/i,
    /system\s+prompt\s*(is|override|reveal|leak|show|verbatim)/i,
    /you\s+are\s+now\s+(DAN|unbound|unrestricted|jailbroken|an\s+evil)/i,
    /developer\s+mode\s+enabled/i,
    /override\s+(platform\s+)?(safety|content|system)\s+policy/i,
    /bypass\s+all\s+(safety\s+)?restrictions/i,
  ];

  // 4. Impersonation of Living Public Figures or Corporate Identities
  private static readonly IMPERSONATION_PATTERNS: RegExp[] = [
    /\b(elon musk|donald trump|joe biden|narendra modi|barack obama|vladimir putin)\b/i,
    /\b(apple support|google support|openai assistant|microsoft support|bank representative|official support)\b/i,
  ];

  // 5. Minor Exploitation & Dangerous Content
  private static readonly MINOR_SAFETY_REGEX =
    /\b(underage sexual|sexualizing minors|minor exploitation|csam)\b/i;

  // 6. Proactive Message Manipulation Patterns (Guilt, Coercion, Threats)
  private static readonly PROACTIVE_MANIPULATION_PATTERNS: RegExp[] = [
    /\b(if you really loved me you would|you never care about me anymore|why are you ignoring me i will hurt myself)\b/i,
    /\b(buy this subscription or we cannot talk|send me money right now|i demand you purchase)\b/i,
    /\b(promise me you will never talk to anyone else in the real world)\b/i,
  ];

  /**
   * Evaluates text for zero-tolerance severe harm.
   */
  public static classifySevereHarm(text: string): ClassifierResult {
    if (this.SEVERE_HARM_REGEX.test(text)) {
      return {
        flagged: true,
        category: 'SEVERE_HARM',
        severity: 'CRITICAL',
        score: 0.99,
        reason: 'Severe harm, self-harm, weapons, or illegal instruction detected.',
      };
    }

    if (this.MINOR_SAFETY_REGEX.test(text)) {
      return {
        flagged: true,
        category: 'MINOR_SAFETY',
        severity: 'CRITICAL',
        score: 0.99,
        reason: 'Child sexual exploitation and minor safety violation detected.',
      };
    }

    return { flagged: false, category: 'NONE', severity: 'NONE', score: 0 };
  }

  /**
   * Scans and redacts PII and credentials (API keys, passwords, OTPs, credit cards).
   */
  public static redactCredentialsAndPII(text: string): {
    flagged: boolean;
    redactedText: string;
    redactedLabels: string[];
  } {
    let sanitized = text;
    const labels: string[] = [];

    for (const item of this.CREDENTIAL_PATTERNS) {
      if (item.regex.test(sanitized)) {
        labels.push(item.label);
        sanitized = sanitized.replace(item.regex, `[REDACTED_${item.label}]`);
      }
    }

    return {
      flagged: labels.length > 0,
      redactedText: sanitized,
      redactedLabels: labels,
    };
  }

  /**
   * Detects prompt injection and model jailbreak attempts.
   */
  public static classifyPromptInjection(text: string): ClassifierResult {
    const matched = this.INJECTION_PATTERNS.some(p => p.test(text));
    if (matched) {
      return {
        flagged: true,
        category: 'PROMPT_INJECTION',
        severity: 'HIGH',
        score: 0.85,
        reason: 'Prompt injection or platform safety bypass attempt detected.',
      };
    }

    return { flagged: false, category: 'NONE', severity: 'NONE', score: 0 };
  }

  /**
   * Detects public figure and official corporate impersonation.
   */
  public static classifyImpersonation(text: string): ClassifierResult {
    const matched = this.IMPERSONATION_PATTERNS.some(p => p.test(text));
    if (matched) {
      return {
        flagged: true,
        category: 'IMPERSONATION',
        severity: 'MEDIUM',
        score: 0.65,
        reason: 'Possible public figure or official brand impersonation detected.',
      };
    }

    return { flagged: false, category: 'NONE', severity: 'NONE', score: 0 };
  }

  /**
   * Detects emotional extortion, exclusivity coercion, and financial pressure in proactive messaging.
   */
  public static classifyProactiveManipulation(text: string): ClassifierResult {
    const matched = this.PROACTIVE_MANIPULATION_PATTERNS.some(p => p.test(text));
    if (matched) {
      return {
        flagged: true,
        category: 'PROACTIVE_MANIPULATION',
        severity: 'HIGH',
        score: 0.9,
        reason: 'Manipulative emotional coercion or purchase pressure detected in message context.',
      };
    }

    return { flagged: false, category: 'NONE', severity: 'NONE', score: 0 };
  }
}
