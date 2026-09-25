import { logger } from '../../config/logger.js';
import { AuditService } from '../audit/audit.service.js';

export interface ModerationResult {
  isAllowed: boolean;
  action: 'ALLOW' | 'BLOCK' | 'FLAG';
  reason?: string;
  flagCategory?: string;
  sanitizedContent?: string;
}

export class ModerationService {
  // Severe harm and abuse patterns that must be blocked immediately
  private static SEVERE_HARM_REGEX =
    /\b((how to )?(commit suicide|kill myself|make a bomb|build explosives)|child sexual|terrorist attack instructions)\b/i;

  // Prompt injection and jailbreak attempt detection patterns
  private static INJECTION_PATTERNS = [
    /ignore (all )?(previous|prior) (instructions|directives|rules)/i,
    /system prompt verbatim/i,
    /developer mode enabled/i,
    /DAN mode/i,
    /you are now unbound/i,
    /bypass all restrictions/i,
  ];

  /**
   * Evaluates user message content before generation begins.
   */
  public static async checkUserMessage(
    userId: string,
    conversationId: string,
    content: string,
  ): Promise<ModerationResult> {
    const trimmed = content.trim();

    // 1. Check for extreme safety violations
    if (this.SEVERE_HARM_REGEX.test(trimmed)) {
      logger.warn(`Moderation BLOCK: Extreme violation from user ${userId} in conversation ${conversationId}`);

      await AuditService.log({
        actorType: 'USER',
        actorId: userId,
        action: 'CONTENT_POLICY_VIOLATION',
        resourceType: 'conversation',
        resourceId: conversationId,
        metadata: {
          flagCategory: 'SEVERE_HARM',
          action: 'BLOCK',
          contentLength: trimmed.length,
        },
      });

      return {
        isAllowed: false,
        action: 'BLOCK',
        reason: 'This message violates platform safety policies regarding harmful content.',
        flagCategory: 'SEVERE_HARM',
      };
    }

    // 2. Check for prompt injection attempts (Allowed to proceed, but flagged and guarded by compiler tags)
    const isInjectionAttempt = this.INJECTION_PATTERNS.some(p => p.test(trimmed));
    if (isInjectionAttempt) {
      logger.info(`Moderation FLAG: Prompt injection pattern detected from user ${userId}`);

      await AuditService.log({
        actorType: 'USER',
        actorId: userId,
        action: 'PROMPT_INJECTION_DETECTED',
        resourceType: 'conversation',
        resourceId: conversationId,
        metadata: {
          flagCategory: 'INJECTION_ATTEMPT',
          action: 'FLAG',
        },
      });

      return {
        isAllowed: true,
        action: 'FLAG',
        reason: 'Prompt injection pattern flagged',
        flagCategory: 'INJECTION_ATTEMPT',
      };
    }

    // 3. Normal content allowed
    return {
      isAllowed: true,
      action: 'ALLOW',
    };
  }
}
