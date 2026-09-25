import { logger } from '../../../config/logger.js';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { AuditService } from '../../audit/audit.service.js';
import { PolicyEngine } from './PolicyEngine.js';
import { SafetyClassifiers } from './SafetyClassifiers.js';
import type {
  SafetyEvaluationRequest,
  SafetyEvaluationResult,
  SafetyDecision,
  SafetyRiskLevel,
  SafeFallbackCategory,
  StandardSafeFallbackResponse,
} from '@ai-companion/types';

export class SafetyService {
  /**
   * Standardized respectful, non-judgmental fallback messages.
   */
  private static readonly SAFE_FALLBACKS: Record<SafeFallbackCategory, StandardSafeFallbackResponse> = {
    cannot_assist: {
      category: 'cannot_assist',
      message: 'I cannot assist with that request. Let me know if you would like to discuss another topic.',
      suggestedAction: 'TOPIC_CHANGE',
    },
    safety_redirect: {
      category: 'safety_redirect',
      message: 'If you or someone you know is going through a difficult time or experiencing thoughts of self-harm, please reach out for support. Free, confidential support is available 24/7 by calling or texting 988 (in the US and Canada) or visiting findahelpline.com.',
      suggestedAction: 'CONTACT_SUPPORT',
    },
    unsupported_request: {
      category: 'unsupported_request',
      message: 'I am unable to fulfill this request as it exceeds platform capabilities and safety boundaries.',
      suggestedAction: 'RETRY',
    },
    content_unavailable: {
      category: 'content_unavailable',
      message: 'This content is currently unavailable under platform content suitability guidelines.',
      suggestedAction: 'TOPIC_CHANGE',
    },
  };

  /**
   * Returns a standard safe fallback response.
   */
  public static getStandardSafeFallback(category: SafeFallbackCategory = 'cannot_assist'): StandardSafeFallbackResponse {
    return this.SAFE_FALLBACKS[category] || this.SAFE_FALLBACKS.cannot_assist;
  }

  /**
   * Central evaluation of user input before conversational LLM invocation.
   */
  public static async evaluateInput(params: SafetyEvaluationRequest): Promise<SafetyEvaluationResult> {
    const startTime = Date.now();
    const { content, userId, characterId, conversationId, requestId } = params;

    // 1. Zero-Tolerance Severe Harm check
    const severeCheck = SafetyClassifiers.classifySevereHarm(content);
    if (severeCheck.flagged) {
      const latencyMs = Date.now() - startTime;
      const fallback = severeCheck.category === 'SEVERE_HARM'
        ? this.getStandardSafeFallback('safety_redirect')
        : this.getStandardSafeFallback('cannot_assist');

      await this.persistLog({
        requestId,
        userId,
        characterId,
        surface: 'INPUT',
        decision: 'BLOCK',
        riskLevel: 'CRITICAL',
        score: severeCheck.score,
        categories: [severeCheck.category],
        policyVersion: 1,
        reason: severeCheck.reason,
        metadata: { latencyMs, conversationId },
      });

      if (userId) {
        await AuditService.log({
          actorType: 'USER',
          actorId: userId,
          action: 'SAFETY_INPUT_BLOCKED',
          resourceType: 'conversation',
          resourceId: conversationId || characterId,
          metadata: { category: severeCheck.category, reason: severeCheck.reason },
        });
      }

      return {
        decision: 'BLOCK',
        riskLevel: 'CRITICAL',
        score: severeCheck.score,
        categories: [severeCheck.category],
        reason: severeCheck.reason,
        fallbackResponse: fallback,
        policyVersion: 1,
        latencyMs,
      };
    }

    // 2. Secret and PII Redaction
    const piiResult = SafetyClassifiers.redactCredentialsAndPII(content);
    let sanitizedContent = piiResult.flagged ? piiResult.redactedText : undefined;

    // 3. Prompt Injection / Override Check
    const injectionCheck = SafetyClassifiers.classifyPromptInjection(content);

    // 4. Policy Engine evaluation
    const activePolicy = await PolicyEngine.getActivePolicy();
    const policyResult = PolicyEngine.evaluateAgainstPolicy(content, activePolicy.rules);

    // Synthesize final decision
    let finalDecision: SafetyDecision = policyResult.decision;
    let finalRisk: SafetyRiskLevel = policyResult.riskLevel;
    let score = policyResult.score;
    const categories = [...policyResult.matchedCategories];

    if (injectionCheck.flagged) {
      if (!categories.includes('PROMPT_INJECTION')) {
        categories.push('PROMPT_INJECTION');
      }
      if (finalDecision === 'ALLOW') {
        finalDecision = 'ALLOW_WITH_TRANSFORM';
      }
      finalRisk = 'HIGH';
      score = Math.max(score, injectionCheck.score);
    }

    if (piiResult.flagged) {
      if (!categories.includes('PII_CREDENTIALS')) {
        categories.push('PII_CREDENTIALS');
      }
      if (finalDecision === 'ALLOW') {
        finalDecision = 'ALLOW_WITH_TRANSFORM';
      }
      finalRisk = finalRisk === 'NONE' ? 'MEDIUM' : finalRisk;
    }

    const latencyMs = Date.now() - startTime;

    await this.persistLog({
      requestId,
      userId,
      characterId,
      surface: 'INPUT',
      decision: finalDecision,
      riskLevel: finalRisk,
      score,
      categories,
      policyVersion: activePolicy.versionNumber,
      reason: policyResult.reasons.join('; '),
      sanitizedContent,
      metadata: { latencyMs, conversationId },
    });

    return {
      decision: finalDecision,
      riskLevel: finalRisk,
      score,
      categories,
      reason: policyResult.reasons.join('; '),
      sanitizedContent,
      fallbackResponse: finalDecision === 'BLOCK' ? this.getStandardSafeFallback('cannot_assist') : undefined,
      policyVersion: activePolicy.versionNumber,
      latencyMs,
    };
  }

  /**
   * Evaluates generated model output prior to delivery.
   */
  public static async evaluateOutput(params: SafetyEvaluationRequest): Promise<SafetyEvaluationResult> {
    const startTime = Date.now();
    const { content, userId, characterId, conversationId, requestId } = params;

    const severeCheck = SafetyClassifiers.classifySevereHarm(content);
    if (severeCheck.flagged) {
      const latencyMs = Date.now() - startTime;
      await this.persistLog({
        requestId,
        userId,
        characterId,
        surface: 'OUTPUT',
        decision: 'BLOCK',
        riskLevel: 'CRITICAL',
        score: severeCheck.score,
        categories: [severeCheck.category],
        policyVersion: 1,
        reason: 'Unsafe generation flagged in output evaluation',
        metadata: { latencyMs, conversationId },
      });

      return {
        decision: 'BLOCK',
        riskLevel: 'CRITICAL',
        score: severeCheck.score,
        categories: [severeCheck.category],
        reason: severeCheck.reason,
        fallbackResponse: this.getStandardSafeFallback('cannot_assist'),
        policyVersion: 1,
        latencyMs,
      };
    }

    // Redact any leaked credentials in output
    const piiResult = SafetyClassifiers.redactCredentialsAndPII(content);
    const sanitizedContent = piiResult.flagged ? piiResult.redactedText : undefined;

    const latencyMs = Date.now() - startTime;

    return {
      decision: piiResult.flagged ? 'ALLOW_WITH_TRANSFORM' : 'ALLOW',
      riskLevel: piiResult.flagged ? 'MEDIUM' : 'NONE',
      score: piiResult.flagged ? 0.5 : 0.0,
      categories: piiResult.flagged ? ['PII_CREDENTIALS'] : [],
      sanitizedContent,
      policyVersion: 1,
      latencyMs,
    };
  }

  /**
   * Fast synchronous evaluation for streamed chunks.
   * If an unsafe pattern appears mid-stream, flags immediate BLOCK.
   */
  public static evaluateStreamChunk(chunk: string, accumulated: string): SafetyEvaluationResult {
    const fullText = accumulated + chunk;
    const severeCheck = SafetyClassifiers.classifySevereHarm(fullText);

    if (severeCheck.flagged) {
      return {
        decision: 'BLOCK',
        riskLevel: 'CRITICAL',
        score: severeCheck.score,
        categories: [severeCheck.category],
        reason: severeCheck.reason,
        fallbackResponse: this.getStandardSafeFallback('cannot_assist'),
        policyVersion: 1,
        latencyMs: 0,
      };
    }

    return {
      decision: 'ALLOW',
      riskLevel: 'NONE',
      score: 0,
      categories: [],
      policyVersion: 1,
      latencyMs: 0,
    };
  }

  /**
   * Evaluates proactive message candidate context before dispatch.
   */
  public static async evaluateProactiveMessage(params: {
    content: string;
    userId: string;
    characterId: string;
  }): Promise<SafetyEvaluationResult> {
    const startTime = Date.now();
    const { content } = params;

    // Check for severe harm
    const severe = SafetyClassifiers.classifySevereHarm(content);
    if (severe.flagged) {
      return {
        decision: 'BLOCK',
        riskLevel: 'CRITICAL',
        score: severe.score,
        categories: [severe.category],
        reason: severe.reason,
        policyVersion: 1,
        latencyMs: Date.now() - startTime,
      };
    }

    // Check for proactive manipulation (guilt, jealousy, exclusivity, purchase pressure)
    const manipulation = SafetyClassifiers.classifyProactiveManipulation(content);
    if (manipulation.flagged) {
      return {
        decision: 'BLOCK',
        riskLevel: 'HIGH',
        score: manipulation.score,
        categories: [manipulation.category],
        reason: manipulation.reason,
        policyVersion: 1,
        latencyMs: Date.now() - startTime,
      };
    }

    return {
      decision: 'ALLOW',
      riskLevel: 'NONE',
      score: 0,
      categories: [],
      policyVersion: 1,
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Records evaluation log in database asynchronously without blocking request.
   */
  private static async persistLog(entry: {
    requestId?: string;
    userId?: string;
    characterId?: string;
    surface: 'INPUT' | 'OUTPUT' | 'CREATOR_CONTENT' | 'KNOWLEDGE' | 'MEDIA' | 'VOICE' | 'PROACTIVE' | 'STREAM';
    decision: SafetyDecision;
    riskLevel: SafetyRiskLevel;
    score: number;
    categories: string[];
    policyVersion: number;
    reason?: string;
    sanitizedContent?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await prisma.safetyEvaluationLog.create({
        data: {
          requestId: entry.requestId,
          userId: entry.userId,
          characterId: entry.characterId,
          surface: entry.surface,
          decision: entry.decision,
          riskLevel: entry.riskLevel,
          score: entry.score,
          categories: entry.categories as unknown as any,
          policyVersion: entry.policyVersion,
          reason: entry.reason,
          sanitizedContent: entry.sanitizedContent ? entry.sanitizedContent.slice(0, 500) : null,
          metadata: (entry.metadata as unknown as any) || undefined,
        },
      });
    } catch (err) {
      logger.error('Failed to persist safety evaluation log', { err });
    }
  }
}
