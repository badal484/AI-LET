import crypto from 'crypto';
import {
  ToolExecutionRequest,
  ToolExecutionResult,
  ActionReceiptItem,
} from '@ai-companion/types';
import { ToolRegistry } from './ToolRegistry.js';
import { CharacterCapabilityService } from './CharacterCapabilityService.js';
import { UserConsentService } from './UserConsentService.js';
import { HighRiskConfirmationService } from './HighRiskConfirmationService.js';
import { ToolResultSanitizer } from './ToolResultSanitizer.js';
import { SecureBrowserTool } from './SecureBrowserTool.js';
import { MultimodalContextService } from './MultimodalContextService.js';
import { logger } from '../../shared/utils/logger.js';
import { prisma } from '../../infrastructure/database/prisma.js';
import { CharacterSocialActionGateway } from '../social/ai/CharacterSocialActionGateway.js';
import { HARD_DISABLED_TOOLS, SIMULATED_TOOLS, simulatedToolsAllowed } from './toolSafety.js';

export class ToolExecutionGateway {
  private static instance: ToolExecutionGateway;
  private readonly toolRegistry = ToolRegistry.getInstance();
  private readonly capabilityService = CharacterCapabilityService.getInstance();
  private readonly consentService = UserConsentService.getInstance();
  private readonly confirmationService = HighRiskConfirmationService.getInstance();
  private readonly sanitizer = ToolResultSanitizer.getInstance();
  private readonly browserTool = SecureBrowserTool.getInstance();
  private readonly multimodalService = MultimodalContextService.getInstance();

  private readonly receipts: Map<string, ActionReceiptItem> = new Map();

  private constructor() {}

  public static getInstance(): ToolExecutionGateway {
    if (!ToolExecutionGateway.instance) {
      ToolExecutionGateway.instance = new ToolExecutionGateway();
    }
    return ToolExecutionGateway.instance;
  }

  /**
   * Executes a tool through the full policy, permission, consent, and safety pipeline.
   * STRICT ARCHITECTURAL RULE: Models cannot bypass this gateway.
   */
  public async executeTool(req: ToolExecutionRequest): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    // Hard-disabled tools (e.g. payments without a provider) are rejected before ANY other check,
    // so neither registry edits, capabilities, consent nor confirmation can reach an adapter.
    const hardDisabled = HARD_DISABLED_TOOLS.get(req.toolSlug);
    if (hardDisabled) {
      logger.warn(`Blocked execution of hard-disabled tool '${req.toolSlug}'`, { taskId: req.taskId, userId: req.userId });
      return {
        success: false,
        error: { code: hardDisabled.code, message: hardDisabled.message, retryable: false },
        metadata: { durationMs: 0, costUsd: 0, sanitized: false, cached: false },
      };
    }

    // Tools without a real provider integration never run in production/staging.
    if (SIMULATED_TOOLS.has(req.toolSlug) && !simulatedToolsAllowed()) {
      return {
        success: false,
        error: { code: 'TOOL_PROVIDER_NOT_CONFIGURED', message: `Tool '${req.toolSlug}' has no provider integration in this environment. Nothing was executed.`, retryable: false },
        metadata: { durationMs: 0, costUsd: 0, sanitized: false, cached: false },
      };
    }

    // Phase 24: social side effects are PROPOSALS routed to the durable social action gateway, which
    // enforces persisted capabilities, consent, blocks, moderation, rate limits, budgets and audit.
    if (req.toolSlug.startsWith('social.')) {
      return this.executeSocialTool(req, startTime);
    }

    // 1. Tool Registry Check
    const tool = this.toolRegistry.getTool(req.toolSlug);
    if (!tool || tool.status !== 'enabled') {
      return {
        success: false,
        error: {
          code: 'TOOL_NOT_PERMITTED',
          message: `Tool '${req.toolSlug}' is not registered or enabled.`,
          retryable: false,
        },
        metadata: { durationMs: 0, costUsd: 0, sanitized: false, cached: false },
      };
    }

    // 2. Character Capability Validation
    if (req.characterId && !this.capabilityService.isCapabilityAllowed(req.characterId, tool.requiredCapability)) {
      return {
        success: false,
        error: {
          code: 'CAPABILITY_DISABLED',
          message: `Character is not permitted to use capability '${tool.requiredCapability}'.`,
          retryable: false,
        },
        metadata: { durationMs: 0, costUsd: 0, sanitized: false, cached: false },
      };
    }

    // 3. User Consent Verification (For External & High-Risk tools)
    if (tool.riskLevel === 'HIGH' || tool.riskLevel === 'CRITICAL' || tool.category === 'EXTERNAL_API') {
      const hasConsent = this.consentService.hasConsent(req.userId, tool.requiredCapability);
      if (!hasConsent) {
        return {
          success: false,
          error: {
            code: 'CONSENT_REQUIRED',
            message: `User consent is required before executing tool '${req.toolSlug}'.`,
            retryable: false,
          },
          metadata: { durationMs: 0, costUsd: 0, sanitized: false, cached: false },
        };
      }
    }

    // 4. High-Risk Confirmation Token Validation
    if (tool.riskLevel === 'HIGH' || tool.riskLevel === 'CRITICAL') {
      if (!req.confirmationToken) {
        return {
          success: false,
          error: {
            code: 'CONFIRMATION_REQUIRED',
            message: `High-risk action '${req.toolSlug}' requires explicit user confirmation.`,
            retryable: false,
          },
          metadata: { durationMs: 0, costUsd: 0, sanitized: false, cached: false },
        };
      }

      const isValidToken = this.confirmationService.verifyAndConsume(
        req.confirmationToken,
        req.userId,
        req.taskId,
        req.stepId,
        req.arguments
      );

      if (!isValidToken) {
        return {
          success: false,
          error: {
            code: 'CONFIRMATION_TOKEN_INVALID',
            message: `Confirmation token is invalid, expired, or argument hash mismatched.`,
            retryable: false,
          },
          metadata: { durationMs: 0, costUsd: 0, sanitized: false, cached: false },
        };
      }
    }

    // 5. Adapter Execution
    let rawOutput: unknown;
    let receipt: ActionReceiptItem | undefined;

    try {
      if (req.toolSlug === 'calendar.read') {
        rawOutput = {
          events: [
            { id: 'evt_1', title: 'Astrophysics Team Sync', startTime: '2026-09-25T10:00:00Z', endTime: '2026-09-25T11:00:00Z' },
            { id: 'evt_2', title: 'Study Session', startTime: '2026-09-25T14:00:00Z', endTime: '2026-09-25T15:30:00Z' },
          ],
          totalFound: 2,
        };
      } else if (req.toolSlug === 'calendar.create_event') {
        const eventId = `gcal_evt_${crypto.randomBytes(4).toString('hex')}`;
        rawOutput = {
          eventId,
          status: 'CONFIRMED',
          htmlLink: `https://calendar.google.com/event?id=${eventId}`,
        };

        receipt = this.createReceipt(
          req.taskId,
          req.stepId,
          req.toolSlug,
          'Google Calendar',
          `Created calendar event "${req.arguments['title'] || 'Meeting'}"`,
          eventId,
          true
        );
      } else if (req.toolSlug === 'email.draft') {
        rawOutput = {
          draftId: `draft_${crypto.randomBytes(4).toString('hex')}`,
          previewHtml: `<p>${req.arguments['body'] || 'Email body'}</p>`,
          status: 'DRAFTED',
        };
      } else if (req.toolSlug === 'email.send') {
        const msgId = `msg_out_${crypto.randomBytes(4).toString('hex')}`;
        rawOutput = {
          messageId: msgId,
          sentAt: new Date().toISOString(),
          recipient: req.arguments['recipient'],
        };

        receipt = this.createReceipt(
          req.taskId,
          req.stepId,
          req.toolSlug,
          'Email Provider (SMTP/SES)',
          `Sent email to ${req.arguments['recipient']} regarding "${req.arguments['subject'] || ''}"`,
          msgId,
          false
        );
      } else if (req.toolSlug === 'browser.read') {
        const url = String(req.arguments['url'] || 'https://developer.mozilla.org');
        rawOutput = await this.browserTool.fetchWebpage(url);
      } else if (req.toolSlug === 'document.analyze') {
        const attachmentId = String(req.arguments['attachmentId'] || '');
        const doc = this.multimodalService.getAttachment(attachmentId, req.userId);
        rawOutput = {
          summary: doc?.extractedText || 'Document content analyzed safely.',
          citations: [{ document: doc?.originalFilename || 'document.pdf', page: 1 }],
          confidence: doc?.provenance.confidence || 0.95,
        };
      } else {
        // No adapter exists for this tool: never report success for something that did not run.
        return {
          success: false,
          error: { code: 'TOOL_PROVIDER_NOT_CONFIGURED', message: `Tool '${req.toolSlug}' has no adapter. Nothing was executed.`, retryable: false },
          metadata: { durationMs: Date.now() - startTime, costUsd: 0, sanitized: false, cached: false },
        };
      }
      if (SIMULATED_TOOLS.has(req.toolSlug) && rawOutput && typeof rawOutput === 'object') {
        rawOutput = { ...(rawOutput as Record<string, unknown>), simulated: true };
      }
    } catch (err: any) {
      logger.error(`Error executing tool '${req.toolSlug}': ${err.message}`);
      return {
        success: false,
        error: {
          code: 'TOOL_EXECUTION_FAILED',
          message: err.message || 'Execution failed',
          retryable: true,
        },
        metadata: { durationMs: Date.now() - startTime, costUsd: tool.costUsd, sanitized: false, cached: false },
      };
    }

    // 6. Output Sanitization (Strips secrets, neutralizes prompt injection, bounds size)
    const sanitizedOutput = this.sanitizer.sanitize(rawOutput);
    const durationMs = Date.now() - startTime;

    logger.info(`Tool '${req.toolSlug}' executed in ${durationMs}ms for task '${req.taskId}' (Cost: $${tool.costUsd})`);

    return {
      success: true,
      data: sanitizedOutput.sanitizedData,
      metadata: {
        durationMs,
        costUsd: tool.costUsd,
        sanitized: sanitizedOutput.hasSecretsRedacted || sanitizedOutput.hasPromptInjection,
        cached: false,
        source: req.toolSlug,
      },
      receipt,
    };
  }

  private async executeSocialTool(req: ToolExecutionRequest, startTime: number): Promise<ToolExecutionResult> {
    const deny = (code: string, message: string): ToolExecutionResult => ({
      success: false,
      error: { code, message, retryable: false },
      metadata: { durationMs: Date.now() - startTime, costUsd: 0, sanitized: false, cached: false },
    });
    if (req.toolSlug !== 'social.propose_action') return deny('TOOL_NOT_PERMITTED', `Tool '${req.toolSlug}' is not registered.`);
    if (!req.characterId) return deny('CAPABILITY_DISABLED', 'Social actions require a character context.');

    // A model acting as one character can never propose actions for another character.
    const slug = typeof req.arguments['characterSlug'] === 'string' ? req.arguments['characterSlug'] : '';
    const character = await prisma.character.findFirst({ where: { slug }, select: { id: true } });
    if (!character || character.id !== req.characterId) return deny('CAPABILITY_DISABLED', 'Proposal does not match the acting character.');

    const result = await CharacterSocialActionGateway.propose(
      { ...req.arguments, idempotencyKey: req.idempotencyKey ?? `${req.taskId}.${req.stepId}` },
      { actorType: 'AI_CHARACTER', requestId: req.taskId },
    );
    if (result.status === 'DENIED') return deny('SOCIAL_AI_ACTION_DISALLOWED', result.decision.reasons.join(', ') || 'Denied by social policy.');
    return {
      success: true,
      data: { status: result.status, actionLogId: result.actionLogId, resultRef: result.resultRef },
      metadata: { durationMs: Date.now() - startTime, costUsd: 0, sanitized: false, cached: false, source: req.toolSlug },
    };
  }

  private createReceipt(
    taskId: string,
    stepId: string,
    toolSlug: string,
    provider: string,
    actionSummary: string,
    externalReferenceId: string,
    isReversible: boolean
  ): ActionReceiptItem {
    const receiptId = `rcpt_${crypto.randomUUID()}`;
    const receipt: ActionReceiptItem = {
      receiptId,
      taskId,
      stepId,
      toolSlug,
      provider,
      externalReferenceId,
      actionSummary,
      executedAt: new Date().toISOString(),
      isReversible,
    };
    this.receipts.set(receiptId, receipt);
    return receipt;
  }

  public getReceipt(receiptId: string): ActionReceiptItem | undefined {
    return this.receipts.get(receiptId);
  }
}
