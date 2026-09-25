import { RedactionResult } from '@ai-companion/types';

export class PrivacyFilterService {
  private static instance: PrivacyFilterService;

  // Regex patterns for PII detection
  private readonly emailRegex = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g;
  private readonly phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+91[-.\s]?[6-9]\d{9}/g;
  private readonly creditCardRegex = /\b(?:\d{4}[-\s]?){3}\d{4}\b/g;
  private readonly ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/g;
  private readonly aadhaarRegex = /\b\d{4}\s\d{4}\s\d{4}\b/g;
  private readonly ipV4Regex = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;

  // Regex patterns for secrets
  private readonly apiKeyRegex = /(?:api[_-]?key|secret|token|password|bearer|auth|otp)[\s:=]+["']?([a-zA-Z0-9_\-.]{8,})["']?/gi;
  private readonly jwtRegex = /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g;

  private constructor() {}

  public static getInstance(): PrivacyFilterService {
    if (!PrivacyFilterService.instance) {
      PrivacyFilterService.instance = new PrivacyFilterService();
    }
    return PrivacyFilterService.instance;
  }

  /**
   * Sanitizes text by redacting PII and sensitive credentials before it enters
   * evaluation datasets, generation replays, or analytics aggregation.
   */
  public sanitize(text: string): RedactionResult {
    if (!text || typeof text !== 'string') {
      return {
        sanitizedText: '',
        detectedPiiTypes: [],
        hasSecrets: false,
        redactionCount: 0,
      };
    }

    let sanitized = text;
    const detectedPiiTypes: Set<string> = new Set();
    let hasSecrets = false;
    let redactionCount = 0;

    // 1. Redact JWT Tokens
    if (this.jwtRegex.test(sanitized)) {
      sanitized = sanitized.replace(this.jwtRegex, () => {
        hasSecrets = true;
        redactionCount++;
        return '[REDACTED_JWT_TOKEN]';
      });
    }

    // 2. Redact API Keys / Passwords / Secrets
    if (this.apiKeyRegex.test(sanitized)) {
      sanitized = sanitized.replace(this.apiKeyRegex, () => {
        hasSecrets = true;
        redactionCount++;
        return '[REDACTED_SECRET]';
      });
    }

    // 3. Redact Emails
    if (this.emailRegex.test(sanitized)) {
      sanitized = sanitized.replace(this.emailRegex, () => {
        detectedPiiTypes.add('EMAIL');
        redactionCount++;
        return '[REDACTED_EMAIL]';
      });
    }

    // 4. Redact Credit Cards
    if (this.creditCardRegex.test(sanitized)) {
      sanitized = sanitized.replace(this.creditCardRegex, () => {
        detectedPiiTypes.add('CREDIT_CARD');
        redactionCount++;
        return '[REDACTED_PAYMENT_CARD]';
      });
    }

    // 5. Redact SSN / Gov IDs
    if (this.ssnRegex.test(sanitized)) {
      sanitized = sanitized.replace(this.ssnRegex, () => {
        detectedPiiTypes.add('SSN');
        redactionCount++;
        return '[REDACTED_GOV_ID]';
      });
    }
    if (this.aadhaarRegex.test(sanitized)) {
      sanitized = sanitized.replace(this.aadhaarRegex, () => {
        detectedPiiTypes.add('AADHAAR');
        redactionCount++;
        return '[REDACTED_GOV_ID]';
      });
    }

    // 6. Redact Phone Numbers
    if (this.phoneRegex.test(sanitized)) {
      sanitized = sanitized.replace(this.phoneRegex, () => {
        detectedPiiTypes.add('PHONE_NUMBER');
        redactionCount++;
        return '[REDACTED_PHONE]';
      });
    }

    // 7. Redact IPv4
    if (this.ipV4Regex.test(sanitized)) {
      sanitized = sanitized.replace(this.ipV4Regex, (match) => {
        if (match === '127.0.0.1' || match === '0.0.0.0') return match;
        detectedPiiTypes.add('IP_ADDRESS');
        redactionCount++;
        return '[REDACTED_IP]';
      });
    }

    return {
      sanitizedText: sanitized,
      detectedPiiTypes: Array.from(detectedPiiTypes),
      hasSecrets,
      redactionCount,
    };
  }
}
