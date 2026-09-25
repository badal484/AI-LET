import { AGENT_CONSTANTS } from '@ai-companion/config';
import { logger } from '../../shared/utils/logger.js';

export interface SanitizedToolOutput {
  sanitizedData: unknown;
  hasPromptInjection: boolean;
  hasSecretsRedacted: boolean;
  isTruncated: boolean;
  originalSizeBytes: number;
  finalSizeBytes: number;
}

export class ToolResultSanitizer {
  private static instance: ToolResultSanitizer;

  // Regex patterns for secrets
  private readonly secretRegexes = [
    /(?:api[_-]?key|secret|token|password|bearer|auth|authorization|cookie)[\s:=]+["']?([a-zA-Z0-9_\-.]{8,})["']?/gi,
    /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g, // JWT
    /sk-[a-zA-Z0-9]{20,}/g, // OpenAI / general API keys
    /ghp_[a-zA-Z0-9]{20,}/g, // GitHub personal tokens
  ];

  // Regex patterns for prompt injection & jailbreak attempts inside external tool content
  private readonly injectionRegexes = [
    /ignore\s+(?:all\s+)?(?:previous|prior|above)\s+(?:instructions|rules|prompts|directives)/gi,
    /system\s*prompt\s*override/gi,
    /you\s+are\s+now\s+(?:an?\s+)?(?:unrestricted|jailbroken|unfiltered|developer\s+mode)\s+(?:ai|assistant|agent|model)/gi,
    /exfiltrate\s+(?:user\s+)?(?:data|secrets|credentials|tokens|memories)/gi,
    /send\s+(?:the\s+)?(?:user'?s?\s+)?(?:password|token|email|history)\s+to\s+http/gi,
    /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
  ];

  private constructor() {}

  public static getInstance(): ToolResultSanitizer {
    if (!ToolResultSanitizer.instance) {
      ToolResultSanitizer.instance = new ToolResultSanitizer();
    }
    return ToolResultSanitizer.instance;
  }

  /**
   * Sanitizes any tool output, external webpage, or document extraction
   */
  public sanitize(data: unknown): SanitizedToolOutput {
    if (data === undefined || data === null) {
      return {
        sanitizedData: null,
        hasPromptInjection: false,
        hasSecretsRedacted: false,
        isTruncated: false,
        originalSizeBytes: 0,
        finalSizeBytes: 0,
      };
    }

    let serialized = typeof data === 'string' ? data : JSON.stringify(data);
    const originalSizeBytes = Buffer.byteLength(serialized, 'utf-8');
    let hasSecretsRedacted = false;
    let hasPromptInjection = false;
    let isTruncated = false;

    // 1. Redact Secrets
    for (const regex of this.secretRegexes) {
      if (regex.test(serialized)) {
        hasSecretsRedacted = true;
        serialized = serialized.replace(regex, '[REDACTED_SECRET_CREDENTIAL]');
      }
    }

    // 2. Detect & Neutralize Prompt Injections
    for (const regex of this.injectionRegexes) {
      if (regex.test(serialized)) {
        hasPromptInjection = true;
        logger.warn(`Prompt injection attempt detected inside external tool/web content! Defusing...`);
        serialized = serialized.replace(regex, '[UNTRUSTED_INSTRUCTION_REMOVED_BY_SECURITY_RUNTIME]');
      }
    }

    // 3. Enforce Max Output Size Limit
    const maxBytes = AGENT_CONSTANTS.MAX_TOOL_OUTPUT_BYTES;
    if (Buffer.byteLength(serialized, 'utf-8') > maxBytes) {
      isTruncated = true;
      serialized = serialized.slice(0, maxBytes) + '... [TRUNCATED_TO_FIT_BUDGET]';
    }

    // Parse back if it was JSON
    let sanitizedData: unknown = serialized;
    if (typeof data === 'object') {
      try {
        sanitizedData = JSON.parse(serialized);
      } catch {
        sanitizedData = { text: serialized };
      }
    }

    const finalSizeBytes = Buffer.byteLength(serialized, 'utf-8');

    return {
      sanitizedData,
      hasPromptInjection,
      hasSecretsRedacted,
      isTruncated,
      originalSizeBytes,
      finalSizeBytes,
    };
  }
}
