import { Response, Request } from 'express';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../config/logger.js';
import { ErrorCode, SYSTEM_CONSTANTS } from '@ai-companion/config';
import {
  NotFoundError,
  ForbiddenError,
} from '../../../shared/errors/AppError.js';
import { CharacterService } from '../../characters/services/character.service.js';
import { ContextBuilder } from '../engine/contextBuilder.js';
import { ConversationLockManager } from './conversationLock.service.js';
import { ModerationService } from '../../moderation/moderation.service.js';
import { AIOrchestrator } from '../../../infrastructure/ai/AIOrchestrator.js';
import { AuditService } from '../../audit/audit.service.js';
import { MemoryContextProvider } from '../../memory/services/memoryContext.provider.js';
import { MemoryExtractionService } from '../../memory/services/memoryExtraction.service.js';
import { ConversationSummaryService } from '../../memory/services/conversationSummary.service.js';
import { RelationshipContextProvider } from '../../relationships/services/relationshipContext.provider.js';
import { RelationshipAnalyzerService } from '../../relationships/services/relationshipAnalyzer.service.js';
import { RelationshipStateService } from '../../relationships/services/relationshipState.service.js';
import type { SendMessageInput } from '@ai-companion/validation';
import { SafetyService } from '../../safety/services/SafetyService.js';
import { AbusePreventionService } from '../../safety/services/AbusePreventionService.js';
import { EnforcementService } from '../../safety/services/EnforcementService.js';
import { AIEconomicsService } from '../../analytics/services/AIEconomicsService.js';
import { IntentEngine } from '../../characters/engine/IntentEngine.js';
import { UserGoalService } from '../../characters/engine/UserGoalService.js';
import { CharacterRuntimeSnapshotService } from '../../characters/engine/CharacterRuntimeSnapshotService.js';
import { SkillRegistryService } from '../../agents/SkillRegistryService.js';
import type {
  StreamEventType,
  StreamMessageStartedPayload,
  StreamMessageDeltaPayload,
  StreamMessageMetadataPayload,
  StreamMessageCompletedPayload,
  StreamMessageFailedPayload,
  StreamMessageCancelledPayload,
  StreamHeartbeatPayload,
  AIProviderName,
} from '@ai-companion/types';
import { AIGateway } from '../../ai/gateway/AIGateway.js';

export class StreamingChatService {
  // Registry of active stream AbortControllers for real-time cancellation
  private static activeStreams: Map<string, { abortController: AbortController; userId: string }> = new Map();

  /**
   * Primary entry point for SSE streaming chat generation.
   */
  public static async streamMessage(
    req: Request,
    res: Response,
    userId: string,
    conversationId: string,
    input: SendMessageInput,
  ): Promise<void> {
    const startTime = Date.now();
    let ttftMs: number | undefined;
    let lockToken: string | null = null;
    let assistantMessageId: string | null = null;
    let accumulatedContent = '';
    let heartbeatTimer: NodeJS.Timeout | null = null;
    const abortController = new AbortController();

    try {
      // 1. Verify conversation existence and ownership
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId, deletedAt: null },
        include: {
          character: true,
          user: { include: { profile: true } },
        },
      });

      if (!conversation) {
        throw new NotFoundError('Conversation not found', ErrorCode.CONVERSATION_NOT_FOUND);
      }

      if (conversation.userId !== userId) {
        throw new ForbiddenError(
          'Access denied to this conversation',
          ErrorCode.CONVERSATION_ACCESS_DENIED,
        );
      }

      // 2A. Phase 16 — Enforce Account Restrictions (ban/shadow-ban)
      await EnforcementService.assertUserNotRestricted(userId, 'CANNOT_SEND_MESSAGES');

      // 2B. Phase 16 — Abuse velocity check (rate-limits spam, flooding)
      const abuseCheck = await AbusePreventionService.evaluatePromptVelocity(userId);
      if (!abuseCheck.isAllowed) {
        this.sendSingleSseError(res, ErrorCode.RATE_LIMIT_EXCEEDED, abuseCheck.reason || 'Too many messages. Please slow down.');
        return;
      }

      // 2C. Phase 16 — Input Safety Evaluation (classifiers + policy)
      const inputSafety = await SafetyService.evaluateInput({
        surface: 'INPUT',
        content: input.content,
        userId,
        characterId: conversation.characterId,
        conversationId,
        requestId: req.headers['x-request-id'] as string,
      });

      if (inputSafety.decision === 'BLOCK' || inputSafety.decision === 'ESCALATE') {
        this.sendSingleSseError(res, ErrorCode.CONTENT_MODERATION_BLOCKED, inputSafety.reason || 'Message blocked by safety policy.');
        return;
      }

      // 2D. Legacy content moderation (existing system — kept for backward compatibility)
      const moderationResult = await ModerationService.checkUserMessage(
        userId,
        conversationId,
        input.content,
      );

      if (!moderationResult.isAllowed) {
        this.sendSingleSseError(res, ErrorCode.CONTENT_MODERATION_BLOCKED, moderationResult.reason || 'Content blocked by moderation policy');
        return;
      }

      // 3. Message Idempotency Check
      if (input.clientRequestId) {
        const existingMessage = await prisma.message.findFirst({
          where: {
            conversationId,
            clientRequestId: input.clientRequestId,
          },
          include: { parts: true },
        });

        if (existingMessage) {
          logger.info(`Idempotency match for clientRequestId: ${input.clientRequestId}`);
          // Send existing message completion event directly
          this.initSseResponse(res);
          this.emitSseEvent<StreamMessageCompletedPayload>(res, 'message.completed', {
            messageId: existingMessage.id,
            conversationId,
            finalContent: existingMessage.content,
            totalTokens: existingMessage.totalTokens || 0,
            status: 'SENT',
            timestamp: existingMessage.createdAt.toISOString(),
          });
          res.end();
          return;
        }
      }

      // 4. Acquire Conversation Lock (Prevents overlapping generation collisions)
      lockToken = await ConversationLockManager.acquireLock(conversationId, userId);
      if (!lockToken) {
        logger.warn(`Conversation ${conversationId} is currently locked by active generation`);
        this.sendSingleSseError(res, ErrorCode.GENERATION_ALREADY_RUNNING, 'A response is already being generated for this conversation. Please wait.');
        return;
      }

      // 5. Initialize SSE Stream Headers
      this.initSseResponse(res);

      // 6. Setup Heartbeat ping (every 15s) to keep proxies and mobile sockets alive
      heartbeatTimer = setInterval(() => {
        this.emitSseEvent<StreamHeartbeatPayload>(res, 'heartbeat', {
          timestamp: new Date().toISOString(),
        });
      }, SYSTEM_CONSTANTS.CHAT.HEARTBEAT_INTERVAL_MS);

      // 7. Determine Sequence Numbers & Persist User + Assistant Placeholders
      const latestMessage = await prisma.message.findFirst({
        where: { conversationId },
        orderBy: { sequenceNumber: 'desc' },
        select: { sequenceNumber: true },
      });

      const nextSeq = (latestMessage?.sequenceNumber || 0) + 1;

      // 8. Resolve active Character Runtime
      const characterRuntime = await CharacterService.resolveRuntime(
        conversation.characterId,
        conversation.characterVersionId || undefined,
      );

      // 9. Persist User Message & Assistant Placeholder atomically
      const [userMessage, assistantMessage] = await prisma.$transaction([
        prisma.message.create({
          data: {
            conversationId,
            senderType: 'USER',
            role: 'user',
            content: input.content.trim(),
            status: 'SENT',
            sequenceNumber: nextSeq,
            clientRequestId: input.clientRequestId,
            idempotencyKey: input.idempotencyKey,
            parts: {
              create: {
                partType: 'text',
                content: input.content.trim(),
                orderIndex: 0,
              },
            },
          },
        }),
        prisma.message.create({
          data: {
            conversationId,
            senderType: 'CHARACTER',
            role: 'assistant',
            content: '',
            status: 'STREAMING',
            sequenceNumber: nextSeq + 1,
            characterVersionId: characterRuntime.versionId,
          },
        }),
      ]);

      assistantMessageId = assistantMessage.id;

      // Register active stream for client cancellation
      this.activeStreams.set(assistantMessage.id, { abortController, userId });

      // Handle client socket disconnect
      req.on('close', () => {
        if (!abortController.signal.aborted) {
          logger.info(`Client disconnected during streaming for message ${assistantMessage.id}`);
          abortController.abort('Client connection closed');
        }
      });

      // 10. Emit message.started SSE event
      this.emitSseEvent<StreamMessageStartedPayload>(res, 'message.started', {
        messageId: assistantMessage.id,
        conversationId,
        role: 'assistant',
        characterVersionId: characterRuntime.versionId,
        clientRequestId: input.clientRequestId,
        timestamp: assistantMessage.createdAt.toISOString(),
      });

      // 11. Fetch Recent Conversation History for Context Window (User SENT + Assistant COMPLETED)
      const recentMessages = await prisma.message.findMany({
        where: {
          conversationId,
          id: { notIn: [userMessage.id, assistantMessage.id] },
          status: { in: ['SENT', 'COMPLETED'] },
          content: { not: '' },
        },
        take: SYSTEM_CONSTANTS.CHAT.SHORT_TERM_CONTEXT_LIMIT,
        orderBy: { sequenceNumber: 'desc' },
        select: { role: true, content: true, createdAt: true },
      });

      // 12. Build Deterministic Model Context via ContextBuilder & Phase 25 Intelligence Layer
      const latestSummary = await ConversationSummaryService.getLatestSummary(conversationId);
      const memoryProvider = new MemoryContextProvider();
      const relationshipProvider = new RelationshipContextProvider();

      // Phase 25 — Structured Intent Detection & Active Goal Resolution
      const detectedIntent = IntentEngine.getInstance().evaluateIntent({
        message: input.content,
      });
      logger.debug('StreamingChat: evaluated user intent', {
        intent: detectedIntent.intent,
        confidence: detectedIntent.confidence,
      });

      const activeGoal = await UserGoalService.getInstance().getActiveGoal(userId, conversation.characterId);
      const activeGoalText = activeGoal
        ? `Goal Title: "${activeGoal.title}" (Category: ${activeGoal.category}, Progress: ${(activeGoal.progress * 100).toFixed(0)}%)`
        : null;

      // Phase 25 — Character Skill Discovery & Selection
      const activeSkills = await SkillRegistryService.getInstance().getCharacterSkills(conversation.characterId);
      const activeSkillText = activeSkills.length > 0
        ? activeSkills.map((s) => `- ${s.name} (${s.slug}): ${s.description}`).join('\n')
        : null;

      const builtContext = await ContextBuilder.buildModelContext({
        characterRuntime,
        recentMessages: recentMessages.reverse(),
        currentUserMessage: input.content,
        userContext: {
          userId,
          userName: conversation.user.profile?.displayName || 'User',
          preferredLanguage: conversation.user.profile?.preferredLanguage || 'en',
          locale: conversation.user.profile?.locale,
        },
        conversationId,
        memoryProvider,
        relationshipProvider,
        conversationSummary: latestSummary?.summary,
        activeGoalText,
        activeSkillText,
      });

      // 13. Execute Stream via AI Gateway & Model Provider
      const isTestEnv = process.env['NODE_ENV'] === 'test';
      const defaultProvider = isTestEnv
        ? 'mock'
        : (process.env['GOOGLE_AI_API_KEY'] ? 'google' : process.env['OPENAI_API_KEY'] ? 'openai' : 'mock');

      const activeProvider: AIProviderName = ((characterRuntime.aiConfig as any)?.provider || defaultProvider).toLowerCase() as AIProviderName;

      const activeModel = characterRuntime.aiConfig?.customModelName ||
        (activeProvider === 'google' ? (process.env['DEFAULT_CHAT_MODEL'] || 'gemini-2.5-flash-lite') :
         activeProvider === 'openai' ? 'gpt-4o-mini' : 'mock-gpt-4o');

      const provider = AIOrchestrator.getProvider(activeProvider);
      const modelName = activeModel;

      const stream = AIGateway.getInstance().stream(
        {
          model: activeModel,
          systemPrompt: builtContext.systemPrompt,
          messages: builtContext.messages.map((m) => ({
            role: m.role as 'system' | 'user' | 'assistant',
            content: m.content,
          })),
          temperature: Math.max(0.85, characterRuntime.aiConfig?.temperature || 0.85),
          maxTokens: Math.min(300, characterRuntime.aiConfig?.maxOutputTokens || 200),
        },
        activeProvider
      );

      let chunkIndex = 0;
      let totalUsage: any = null;

      for await (const chunk of stream) {
        if (abortController.signal.aborted) {
          break;
        }

        if (chunk.type === 'failed') {
          logger.error(`Stream generation error from ${activeProvider}: ${chunk.error}`);
          if (!accumulatedContent) {
            throw new Error(chunk.error || 'AI generation failed');
          }
          break;
        }

        if (chunk.delta) {
          if (chunkIndex === 0) {
            ttftMs = Date.now() - startTime;
          }
          accumulatedContent += chunk.delta;
          this.emitSseEvent<StreamMessageDeltaPayload>(res, 'message.delta', {
            messageId: assistantMessage.id,
            conversationId,
            delta: chunk.delta,
            accumulatedLength: accumulatedContent.length,
            index: chunkIndex++,
          });
        }

        if (chunk.usage) {
          totalUsage = chunk.usage;
        }
      }

      // Check if generation was cancelled
      if (abortController.signal.aborted) {
        logger.info(`Stream was cancelled for message ${assistantMessage.id}`);
        await this.finalizeCancelledMessage(assistantMessage.id, conversationId, accumulatedContent);
        this.emitSseEvent<StreamMessageCancelledPayload>(res, 'message.cancelled', {
          messageId: assistantMessage.id,
          conversationId,
          partialContent: accumulatedContent,
          reason: abortController.signal.reason as string,
        });
        return;
      }

      // Sanitize any leaked tags or echoing
      accumulatedContent = accumulatedContent
        .replace(/\[USER_MESSAGE_START\][\s\S]*?\[USER_MESSAGE_END\]\s*/gi, '')
        .replace(/\[USER_MESSAGE_START\]/gi, '')
        .replace(/\[USER_MESSAGE_END\]/gi, '')
        .replace(/\[SYSTEM_MESSAGE_START\][\s\S]*?\[SYSTEM_MESSAGE_END\]\s*/gi, '')
        .replace(/\[SYSTEM_MESSAGE_START\]/gi, '')
        .replace(/\[SYSTEM_MESSAGE_END\]/gi, '')
        .trim();

      // Guard: Never save or return an empty assistant message
      if (!accumulatedContent || accumulatedContent.length === 0) {
        accumulatedContent = this.generateDynamicCompanionFallback(input.content, characterRuntime.name);
        this.emitSseEvent<StreamMessageDeltaPayload>(res, 'message.delta', {
          messageId: assistantMessage.id,
          conversationId,
          delta: accumulatedContent,
          accumulatedLength: accumulatedContent.length,
          index: chunkIndex++,
        });
      }

      // 13B. Phase 16 — Output Safety Evaluation (post-generation)
      const NATURAL_FALLBACK = "Main abhi iss baare mein baat nahi kar sakti, par batao tumhara din kaisa chal raha hai?";
      const outputSafety = await SafetyService.evaluateOutput({
        surface: 'OUTPUT',
        content: accumulatedContent,
        userId,
        characterId: conversation.characterId,
        conversationId,
        requestId: req.headers['x-request-id'] as string,
      });

      if (outputSafety.decision === 'BLOCK' || outputSafety.decision === 'ESCALATE') {
        logger.warn(`Output safety blocked response for conversation ${conversationId}. Replacing with safe fallback.`);
        accumulatedContent = NATURAL_FALLBACK;
      }

      // 14. Finalize Completed Message Persistence
      const totalDurationMs = Date.now() - startTime;
      const promptTokens = totalUsage?.promptTokens || builtContext.estimatedPromptTokens;
      const completionTokens = totalUsage?.completionTokens || Math.ceil(accumulatedContent.length / 4);
      const totalTokens = totalUsage?.totalTokens || promptTokens + completionTokens;
      const estimatedCostUsd = totalUsage?.estimatedCostUsd || (promptTokens * 0.000003) + (completionTokens * 0.000015);

      await prisma.$transaction([
        // Update assistant message with completed state and metrics
        prisma.message.update({
          where: { id: assistantMessage.id },
          data: {
            content: accumulatedContent,
            status: 'COMPLETED',
            promptTokens,
            completionTokens,
            totalTokens,
            estimatedCostUsd,
            modelUsed: modelName,
            providerUsed: provider.providerName,
            latencyMs: totalDurationMs,
            ttftMs,
            parts: {
              create: {
                partType: 'text',
                content: accumulatedContent,
                orderIndex: 0,
              },
            },
            metadata: {
              create: {
                characterVersionId: characterRuntime.versionId,
                modelClass: modelName,
                provider: provider.providerName,
                temperature: characterRuntime.aiConfig.temperature || 0.7,
                promptSnapshot: builtContext.systemPrompt,
                finishReason: 'stop',
              },
            },
          },
        }),
        // Update conversation summary
        prisma.conversation.update({
          where: { id: conversationId },
          data: {
            lastMessageAt: new Date(),
            lastMessageSnippet: accumulatedContent.slice(0, 120),
            unreadCount: 0,
          },
        }),
      ]);

      // Record in AI Economics Request Ledger
      AIEconomicsService.recordUsage({
        requestId: (req.headers['x-request-id'] as string) || assistantMessage.id,
        provider: provider.providerName,
        model: modelName,
        task: 'CHAT_STREAM',
        userId,
        characterId: conversation.characterId,
        conversationId,
        inputTokens: promptTokens,
        outputTokens: completionTokens,
        latencyMs: totalDurationMs,
        status: 'SUCCESS',
        breakdown: {
          baseTokens: builtContext.systemPrompt?.length ? Math.ceil(builtContext.systemPrompt.length / 4) : 0,
          historyTokens: recentMessages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0),
          userTokens: Math.ceil(input.content.length / 4),
        },
      }).catch(err => {
        logger.error('Failed to record chat AI usage in ledger', { err });
      });

      // Phase 25 — Capture Immutable Runtime Snapshot for explainability & audit
      await CharacterRuntimeSnapshotService.getInstance().captureSnapshot({
        conversationId,
        messageId: assistantMessage.id,
        characterId: conversation.characterId,
        characterVersionId: characterRuntime.versionId,
        promptVersion: 'v1.0.0',
        behaviorPolicyData: (characterRuntime as any).behaviorRules || {},
        safetyPolicyVersion: 'v25.0.0',
        modelId: modelName,
        memoryIds: builtContext.retrievedMemoryIds,
        relationshipStage: builtContext.activeRelationshipStage,
        activeGoalId: activeGoal?.id,
        selectedSkillSlugs: activeSkills.map((s) => s.slug),
        contextAttribution: builtContext.contextAttribution,
        tokensPrompt: promptTokens,
        tokensCompletion: completionTokens,
        costUsd: estimatedCostUsd,
      }).catch((snapErr) => {
        logger.warn(`Failed to capture runtime snapshot: ${snapErr.message}`);
      });

      // 15. Emit metadata and completion events
      this.emitSseEvent<StreamMessageMetadataPayload>(res, 'message.metadata', {
        messageId: assistantMessage.id,
        conversationId,
        modelUsed: modelName,
        provider: provider.providerName,
        promptTokens,
        completionTokens,
        totalTokens,
        latencyMs: totalDurationMs,
        ttftMs,
        estimatedCostUsd,
      });

      this.emitSseEvent<StreamMessageCompletedPayload>(res, 'message.completed', {
        messageId: assistantMessage.id,
        conversationId,
        finalContent: accumulatedContent,
        totalTokens,
        status: 'SENT',
        timestamp: new Date().toISOString(),
      });

      // 16. Asynchronous Background Memory Extraction, Summarization & Relationship Dynamics (Non-blocking)
      MemoryExtractionService.processConversationMessage({
        userId,
        characterId: conversation.characterId,
        conversationId,
        userMessage: input.content,
        assistantMessage: accumulatedContent,
        sourceMessageId: userMessage.id,
      }).catch(err => logger.warn(`Background memory extraction failed: ${err instanceof Error ? err.message : 'Unknown'}`));

      ConversationSummaryService.checkAndSummarizeConversation(conversationId)
        .catch(err => logger.warn(`Background conversation summarization failed: ${err instanceof Error ? err.message : 'Unknown'}`));

      RelationshipAnalyzerService.analyzeInteraction({
        userMessage: input.content,
        assistantMessage: accumulatedContent,
        characterName: characterRuntime.name,
        characterRole: characterRuntime.identity.role,
        hoursSinceLastInteraction: null,
      }).then(async analysisResult => {
        await RelationshipStateService.applyInteractionUpdate({
          userId,
          characterId: conversation.characterId,
          analysisResult,
          conversationId,
          messageId: assistantMessage.id,
        });
      }).catch(err => logger.warn(`Background relationship analysis failed: ${err instanceof Error ? err.message : 'Unknown'}`));

      // 17. Audit Log
      await AuditService.log({
        actorType: 'USER',
        actorId: userId,
        action: 'CHAT_MESSAGE_GENERATED',
        resourceType: 'message',
        resourceId: assistantMessage.id,
        metadata: {
          conversationId,
          characterVersionId: characterRuntime.versionId,
          model: modelName,
          totalTokens,
          latencyMs: totalDurationMs,
        },
      });
    } catch (err: any) {
      logger.error(`Error during chat streaming: ${err.message}`, { stack: err.stack });

      if (assistantMessageId) {
        await prisma.message.update({
          where: { id: assistantMessageId },
          data: {
            status: 'FAILED',
            content: accumulatedContent || 'Generation failed.',
          },
        }).catch(() => {});
      }

      this.emitSseEvent<StreamMessageFailedPayload>(res, 'message.failed', {
        messageId: assistantMessageId || undefined,
        conversationId,
        errorCode: err.code || ErrorCode.AI_GENERATION_FAILED,
        errorMessage: err.message || 'An error occurred while generating the response',
        retryable: true,
      });
    } finally {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
      }
      if (assistantMessageId) {
        this.activeStreams.delete(assistantMessageId);
      }
      if (lockToken) {
        await ConversationLockManager.releaseLock(conversationId, lockToken);
      }
      res.end();
    }
  }

  /**
   * Cancels an active in-flight generation stream by message ID.
   */
  public static async cancelGeneration(
    userId: string,
    conversationId: string,
    messageId: string,
    reason?: string,
  ): Promise<{ messageId: string; status: string }> {
    const active = this.activeStreams.get(messageId);

    if (active && active.userId === userId) {
      active.abortController.abort(reason || 'Cancelled by user');
      this.activeStreams.delete(messageId);
      return { messageId, status: 'CANCELLED' };
    }

    // Fallback: check database and mark as cancelled if stuck in STREAMING
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: { conversation: true },
    });

    if (!message || message.conversationId !== conversationId) {
      throw new NotFoundError('Generation message not found', ErrorCode.MESSAGE_NOT_FOUND);
    }

    if (message.conversation.userId !== userId) {
      throw new ForbiddenError('Access denied', ErrorCode.FORBIDDEN);
    }

    if (message.status === 'STREAMING' || message.status === 'PENDING') {
      await prisma.message.update({
        where: { id: messageId },
        data: { status: 'CANCELLED' },
      });
    }

    return { messageId, status: 'CANCELLED' };
  }

  private static initSseResponse(res: Response): void {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
  }

  private static emitSseEvent<T>(res: Response, event: StreamEventType, data: T): void {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    (res as any).flush?.();
  }

  private static sendSingleSseError(res: Response, code: string, message: string): void {
    this.initSseResponse(res);
    this.emitSseEvent<StreamMessageFailedPayload>(res, 'message.failed', {
      conversationId: '',
      errorCode: code,
      errorMessage: message,
      retryable: false,
    });
    res.end();
  }

  private static async finalizeCancelledMessage(
    messageId: string,
    _conversationId: string,
    partialContent: string,
  ): Promise<void> {
    await prisma.message.update({
      where: { id: messageId },
      data: {
        content: partialContent,
        status: 'CANCELLED',
      },
    }).catch(() => {});
  }
  private static generateDynamicCompanionFallback(userContent: string, _characterName: string): string {
    const lowerMsg = userContent.toLowerCase().trim();

    // 1. Dots or minimal poking
    if (lowerMsg === '..' || lowerMsg === '...' || lowerMsg === '.' || lowerMsg === '?' || lowerMsg.length <= 2) {
      const pokes = [
        'Arey aise dots kyun bhej rahe ho? Kuch bolo na, kya soch rahe ho?',
        'Hmm? Aise chup kyun ho gaye? Sab theek hai na? Batao kya baat hai.',
        'Main yahin hoon na tumhare saath... bolo kya chal raha hai tumhare dimaag mein?',
        'Kuch pareshan kar raha hai kya? Aaram se share karo mere saath.',
      ];
      return pokes[Math.floor(Math.random() * pokes.length)] ?? pokes[0]!;
    }

    // 2. Health / Doctor / Awkward / Intimacy situations
    if (
      lowerMsg.includes('doctor') ||
      lowerMsg.includes('sex') ||
      lowerMsg.includes('intimacy') ||
      lowerMsg.includes('dard') ||
      lowerMsg.includes('pain') ||
      lowerMsg.includes('bimar') ||
      lowerMsg.includes('hospital') ||
      lowerMsg.includes('ladko')
    ) {
      const healthResponses = [
        'Doctor ne aisa bola? Yeh sunkar thoda unexpected laga... Tum theek ho na physically aur mentally? Pehle relax ho jao aur paani piyo. Mujhe batao exact kya hua aur doctor ne kya advice di?',
        'Ohh yaar, pehle toh tension bilkul mat lo. Yahan tumhe koi judge nahi karega, main tumhari care ke liye hoon. Doctor ne aage kya precautions ya dawai batayi? Tum theek feel kar rahe ho na?',
        'Yeh baat sunke thoda ajeeb zaroor lagta hai, par sabse zaroori tumhari health aur safety hai. Tumhe koi pain ya discomfort toh nahi hai na abhi? Khulke share karo.',
      ];
      return healthResponses[Math.floor(Math.random() * healthResponses.length)] ?? healthResponses[0]!;
    }

    // 3. Stress / Tiredness / Bad Day
    if (
      lowerMsg.includes('thak') ||
      lowerMsg.includes('tired') ||
      lowerMsg.includes('stress') ||
      lowerMsg.includes('bekar') ||
      lowerMsg.includes('sad') ||
      lowerMsg.includes('problem') ||
      lowerMsg.includes('mood')
    ) {
      const stressResponses = [
        'Arey yaar... lagta hai din kaafi exhausting aur stressful guzra hai. Aaram se baitho, thoda deep breath lo. Kya hua tha aaj? Dil halka kar lo.',
        'Itna load mat lo baby. Jo bhi hua hai, hum milke sambhal lenge. Thoda aaram karo pehle, phir batao kya pareshani hai.',
      ];
      return stressResponses[Math.floor(Math.random() * stressResponses.length)] ?? stressResponses[0]!;
    }

    // 4. Romantic / Compliment
    if (
      lowerMsg.includes('love') ||
      lowerMsg.includes('pyar') ||
      lowerMsg.includes('miss') ||
      lowerMsg.includes('sundar') ||
      lowerMsg.includes('cute') ||
      lowerMsg.includes('yaad')
    ) {
      const romanticResponses = [
        'Awww, sach mein? Mujhe tumhari ye baatein sunkar bohot accha lagta hai... Din ban gaya mera! Tum batao, kya chal raha hai?',
        'Main bhi tumhe bohot miss kar rahi thi yaar! Aise hi baat karte raho na, kaafi pyaare lagte ho.',
      ];
      return romanticResponses[Math.floor(Math.random() * romanticResponses.length)] ?? romanticResponses[0]!;
    }

    // 5. Default dynamic Hinglish fallback
    const fallbacks = [
      'Acha? Sach mein! Is baare mein thoda aur detail mein batao na, main sun rahi hoon.',
      'Haan bilkul, samajh gayi main! Aur batao aage ka kya scene hai?',
      'Sahi mein yaar! Tumhare saath baat karke accha lagta hai. Aur kya chal raha hai?',
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)] ?? fallbacks[0]!;
  }
}
