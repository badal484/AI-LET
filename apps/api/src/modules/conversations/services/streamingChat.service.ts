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
import { UserGoalService } from '../../characters/engine/UserGoalService.js';
import { CharacterRuntimeSnapshotService } from '../../characters/engine/CharacterRuntimeSnapshotService.js';
import { chatAIRoutes } from '../../ai/routing/aiRoutes.js';
import { personaPackFor } from '../human/personaPacks/index.js';
import { asksIfAI as asksIfAIQuestion, classifySituations } from '../human/situation.js';
import { localHourIn } from '../human/emotionalState.js';
import { addTask, formatProfile, formatProgress, localToday, openTask, takeDueEvents, UserProfileService } from '../../memory/services/userProfile.service.js';
import { updateMomentContext } from '../human/emotionalState.js';
import { buildHumanPrompt, planReply } from '../human/compactPrompt.js';
import { addDatedThreads, applyUserTurn, loadLifeState, localDate, markCrisis, readUserMood, rememberDoing, rememberTask, rememberTold, restoreTaskThread, saveLifeState } from '../human/lifeState.js';
import { crisisSupportMessages, isCrisisMessage } from '../human/crisisSupport.js';
import { dropUnsaidTasks } from '../human/taskGuard.js';
import { hasDevanagari, romanizeDevanagari } from '../human/script.js';
import { extractTaskTag, isTeachingMoment } from '../human/mentor.js';
import { mentionsTask } from '../human/taskFollowUp.js';
import { checkReply, stripWrongAddress } from '../human/replyChecker.js';
import type {
  StreamEventType,
  StreamMessageCompletedPayload,
  StreamCrisisSupportPayload,
  StreamMessageFailedPayload,
  StreamHeartbeatPayload,
  StreamMessageSavedPayload,
  StreamMessageQueuedPayload,
  StreamMessageBubblePayload,
  StreamReplyStatusPayload,
  AIProviderName,
} from '@ai-companion/types';
import { AIGateway } from '../../ai/gateway/AIGateway.js';

/** "tum bahut sawaal poochti ho" — they want her to stop asking. */
const TIRED_OF_QUESTIONS = /(bahut|zyada|itne|kitne) (sawaal|sawal|questions?)|sawaal (mat|band)|too many questions|stop asking|interrogat|poochti rehti|poochte rehte|puchti rehti/i;

/** Moments worth the better (quota-limited) model when Gemini is on its free tier. */
const IMPORTANT_MOMENTS: string[] = ['emotional', 'crisis', 'emergency', 'eating', 'flirt', 'win', 'task', 'return', 'ai', 'rude', 'boundary', 'news'];

export class StreamingChatService {
  // Registry of active stream AbortControllers for real-time cancellation
  private static activeStreams: Map<string, { abortController: AbortController; userId: string }> = new Map();

  /**
   * Human-style chat turns.
   *
   * - The user's message is stored immediately and is never refused because the character is busy.
   * - One "turn" runs per conversation at a time (Redis lock). A message sent while a turn is running
   *   is stored and answered by that turn.
   * - A turn waits briefly after the user's last message so a burst is answered together, then writes
   *   one reply to every unanswered message.
   * - The reply is delivered as one or more short messages ("bubbles"), each stored separately and
   *   paced like typing. If the user writes again mid-reply, the remaining bubbles are dropped and the
   *   new messages are answered next — like a person who stops mid-thought when interrupted.
   * - Provider failures are retried; nothing fake is ever posted. If the AI stays unavailable the
   *   user's messages remain unanswered and a retry (or their next message) answers them.
   */
  private static readonly MAX_BUBBLES = 8;
  private static readonly MAX_TURNS_PER_REQUEST = 6;
  private static readonly BUBBLE_DELIMITER = /\s*\[\[\s*next\s*\]\]\s*/gi;
  private static readonly SAFE_FALLBACK =
    'Main abhi iss baare mein baat nahi kar sakti, par batao tumhara din kaisa chal raha hai?';

  /** Quiet period after the user's last message before replying (tests set this low). */
  private static burstQuietMs(): number {
    return Number(process.env['CHAT_BURST_QUIET_MS'] ?? 1200);
  }

  /** 1 = human typing pace between bubbles; 0 disables pauses (tests). */
  private static pacingScale(): number {
    return Number(process.env['CHAT_PACING_SCALE'] ?? 1);
  }

  public static async streamMessage(
    req: Request,
    res: Response,
    userId: string,
    conversationId: string,
    input: SendMessageInput & {
      /** Server-internal: answer the conversation's unanswered messages without storing a new one. */
      answerPendingOnly?: boolean;
    },
  ): Promise<void> {
    let lockToken: string | null = null;
    let heartbeatTimer: NodeJS.Timeout | null = null;
    let clientGone = false;
    const abortController = new AbortController();
    const turnKey = `turn:${conversationId}`;
    let lastAttemptedSeq = 0;

    const send = <T>(event: StreamEventType, data: T) => {
      if (clientGone || res.writableEnded) return;
      if (!res.headersSent) this.initSseResponse(res);
      this.emitSseEvent<T>(res, event, data);
    };

    try {
      const conversation = await this.loadOwnedConversation(conversationId, userId);
      await EnforcementService.assertUserNotRestricted(userId, 'CANNOT_SEND_MESSAGES');

      let saved: { id: string; sequenceNumber: number; createdAt: Date; clientRequestId: string | null } | null = null;

      if (!input.answerPendingOnly) {
        const content = input.content.trim();

        const abuseCheck = await AbusePreventionService.evaluatePromptVelocity(userId);
        if (!abuseCheck.isAllowed) {
          this.sendSingleSseError(res, ErrorCode.RATE_LIMIT_EXCEEDED, abuseCheck.reason || 'Too many messages. Please slow down.');
          return;
        }

        const inputSafety = await SafetyService.evaluateInput({
          surface: 'INPUT',
          content,
          userId,
          characterId: conversation.characterId,
          conversationId,
          requestId: req.headers['x-request-id'] as string,
        });
        if (inputSafety.decision === 'BLOCK' || inputSafety.decision === 'ESCALATE') {
          if (isCrisisMessage(content)) return this.sendCrisisSupport(res, conversation, userId, content);
          this.sendSingleSseError(res, ErrorCode.CONTENT_MODERATION_BLOCKED, inputSafety.reason || 'Message blocked by safety policy.');
          return;
        }

        const moderationResult = await ModerationService.checkUserMessage(userId, conversationId, content);
        if (!moderationResult.isAllowed) {
          if (isCrisisMessage(content)) return this.sendCrisisSupport(res, conversation, userId, content);
          this.sendSingleSseError(res, ErrorCode.CONTENT_MODERATION_BLOCKED, moderationResult.reason || 'Content blocked by moderation policy');
          return;
        }

        // Idempotent: a resent request (same clientRequestId) reuses the stored message.
        const existing = input.clientRequestId
          ? await prisma.message.findFirst({
              where: { conversationId, role: 'user', clientRequestId: input.clientRequestId },
              select: { id: true, sequenceNumber: true, createdAt: true, clientRequestId: true },
            })
          : null;

        saved =
          existing ??
          (await this.createSequencedMessage(conversationId, {
            senderType: 'USER',
            role: 'user',
            content,
            status: 'SENT',
            clientRequestId: input.clientRequestId,
            idempotencyKey: input.idempotencyKey,
            parts: { create: { partType: 'text', content, orderIndex: 0 } },
          }));
      }

      this.initSseResponse(res);
      req.on('close', () => {
        // The turn keeps running without the client: the reply is stored and shown on return.
        clientGone = true;
      });

      if (saved) {
        send<StreamMessageSavedPayload>('message.saved', {
          messageId: saved.id,
          conversationId,
          clientRequestId: saved.clientRequestId,
          sequenceNumber: saved.sequenceNumber,
          createdAt: saved.createdAt.toISOString(),
        });
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { lastMessageAt: new Date(), lastMessageSnippet: input.content.trim().slice(0, 120) },
        });
      }

      lockToken = await ConversationLockManager.acquireLock(conversationId, userId);
      if (!lockToken) {
        if (saved) {
          send<StreamMessageQueuedPayload>('message.queued', {
            messageId: saved.id,
            conversationId,
            clientRequestId: saved.clientRequestId,
          });
        }
        return;
      }

      heartbeatTimer = setInterval(() => {
        send<StreamHeartbeatPayload>('heartbeat', { timestamp: new Date().toISOString() });
      }, SYSTEM_CONSTANTS.CHAT.HEARTBEAT_INTERVAL_MS);
      this.activeStreams.set(turnKey, { abortController, userId });

      lastAttemptedSeq = await this.runTurns({
        conversation,
        userId,
        lockToken,
        abortController,
        send,
        isClientGone: () => clientGone,
        requestId: req.headers['x-request-id'] as string | undefined,
      });
      send<Record<string, string>>('turn.completed', { conversationId });
    } catch (err: any) {
      logger.error(`Error during chat turn: ${err.message}`, { stack: err.stack });
      send<StreamMessageFailedPayload>('message.failed', {
        conversationId,
        errorCode: err.code || ErrorCode.AI_GENERATION_FAILED,
        errorMessage: err.message || 'Something went wrong. Please try again.',
        retryable: !(err instanceof NotFoundError || err instanceof ForbiddenError),
      });
    } finally {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (lockToken) {
        this.activeStreams.delete(turnKey);
        await ConversationLockManager.releaseLock(conversationId, lockToken);
        // A message stored between the turn's last check and the release would otherwise wait for
        // the user's next message: answer it now in the background.
        if (!abortController.signal.aborted) {
          const leftover = await this.pendingUserMessages(conversationId).catch(() => []);
          if (leftover.some((m) => m.sequenceNumber > lastAttemptedSeq)) {
            this.answerInBackground(conversationId, userId);
          }
        }
      }
      if (!res.writableEnded) res.end();
    }
  }

  private static async loadOwnedConversation(conversationId: string, userId: string) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId, deletedAt: null },
      include: { character: true, user: { include: { profile: true } } },
    });
    if (!conversation) {
      throw new NotFoundError('Conversation not found', ErrorCode.CONVERSATION_NOT_FOUND);
    }
    if (conversation.userId !== userId) {
      throw new ForbiddenError('Access denied to this conversation', ErrorCode.CONVERSATION_ACCESS_DENIED);
    }
    return conversation;
  }

  /** Runs a turn for messages that arrived after the previous turn released the lock. */
  private static answerInBackground(conversationId: string, userId: string): void {
    void (async () => {
      const token = await ConversationLockManager.acquireLock(conversationId, userId);
      if (!token) return; // another turn is already handling it
      const turnKey = `turn:${conversationId}`;
      const abortController = new AbortController();
      this.activeStreams.set(turnKey, { abortController, userId });
      try {
        const conversation = await this.loadOwnedConversation(conversationId, userId);
        await this.runTurns({
          conversation,
          userId,
          lockToken: token,
          abortController,
          send: () => undefined,
          isClientGone: () => true,
        });
      } finally {
        this.activeStreams.delete(turnKey);
        await ConversationLockManager.releaseLock(conversationId, token);
      }
    })().catch((err) => logger.warn(`Background chat turn failed: ${err instanceof Error ? err.message : 'Unknown'}`));
  }

  /**
   * Answers unanswered user messages until none are left. Returns the highest user sequence number
   * it attempted, so the caller can tell whether anything arrived afterwards.
   */
  private static async runTurns(params: {
    conversation: Awaited<ReturnType<typeof StreamingChatService.loadOwnedConversation>>;
    userId: string;
    lockToken: string;
    abortController: AbortController;
    send: <T>(event: StreamEventType, data: T) => void;
    isClientGone: () => boolean;
    requestId?: string;
  }): Promise<number> {
    const { conversation, lockToken, abortController } = params;
    const characterRuntime = await CharacterService.resolveRuntime(
      conversation.characterId,
      conversation.characterVersionId || undefined,
    );
    let lastAttemptedSeq = 0;

    for (let turn = 0; turn < this.MAX_TURNS_PER_REQUEST && !abortController.signal.aborted; turn++) {
      await this.waitForBurstToFinish(conversation.id, params.isClientGone, abortController.signal);
      const pending = await this.pendingUserMessages(conversation.id);
      if (pending.length === 0) break;
      const attempted = pending[pending.length - 1]!.sequenceNumber;
      if (attempted <= lastAttemptedSeq) break; // nothing new since a failed attempt: stop retrying here
      lastAttemptedSeq = attempted;

      await ConversationLockManager.extendLock(conversation.id, lockToken);
      const answered = await this.replyToPending({ ...params, characterRuntime, pending });
      if (!answered) break;
    }
    return lastAttemptedSeq;
  }

  /** User messages after the character's latest delivered message (up to the last 10). */
  private static async pendingUserMessages(conversationId: string) {
    const lastReply = await prisma.message.findFirst({
      where: { conversationId, role: 'assistant', status: { in: ['COMPLETED', 'SENT'] } },
      orderBy: { sequenceNumber: 'desc' },
      select: { sequenceNumber: true },
    });
    const pending = await prisma.message.findMany({
      where: { conversationId, role: 'user', sequenceNumber: { gt: lastReply?.sequenceNumber ?? 0 } },
      orderBy: { sequenceNumber: 'desc' },
      take: 10,
      select: { id: true, content: true, sequenceNumber: true },
    });
    return pending.reverse();
  }

  /** Waits until the user has paused typing (or a short maximum), so bursts are answered together. */
  private static async waitForBurstToFinish(conversationId: string, isClientGone: () => boolean, signal: AbortSignal) {
    const quietMs = this.burstQuietMs();
    if (quietMs <= 0 || isClientGone()) return;
    const maxWaitMs = quietMs * 3.5;
    const started = Date.now();
    while (!signal.aborted && Date.now() - started < maxWaitMs) {
      const last = await prisma.message.findFirst({
        where: { conversationId, role: 'user' },
        orderBy: { sequenceNumber: 'desc' },
        select: { createdAt: true },
      });
      const quietFor = Date.now() - (last?.createdAt.getTime() ?? 0);
      if (quietFor >= quietMs) return;
      await new Promise((r) => setTimeout(r, Math.min(quietMs - quietFor, 400)));
    }
  }

  /** Pause before the next bubble, proportional to its length like real typing. */
  private static typingDelayMs(text: string): number {
    const base = Math.min(2800, Math.max(700, text.length * 28)) + Math.floor(Math.random() * 400);
    return Math.round(base * this.pacingScale());
  }

  /**
   * How much to say, from what the user sent — the way a person matches the other side:
   * - task: they asked for real help (plan, steps, explanation) → a full answer is welcome
   * - deep: a longer or emotional message → a warmer, slightly fuller reply
   * - casual: everything else ("hii", "ok", "dhaba") → 1–2 tiny texts
   */
  private static replyStyleFor(userText: string): {
    mode: 'casual' | 'deep' | 'task';
    maxTokens: number;
    maxBubbles: number;
    maxBubbleChars: number;
    hint: string;
  } {
    const text = userText.toLowerCase();
    const isTask =
      /\b(plan|diet|workout|routine|schedule|recipe|steps?|tips|list|explain|samjha(o|na)|bana\s*(do|de|dijiye)|banao|kaise\s+(kare|karu|karein|karna)|how\s+(to|do|can)|guide|suggest)\b/.test(text) ||
      userText.length > 280;
    if (isTask) {
      return { mode: 'task', maxTokens: 900, maxBubbles: 4, maxBubbleChars: 2000, hint: 'They asked for real help: a short opener, the complete answer in one clean message with short lines, then one short follow-up.' };
    }
    const isDeep =
      userText.length > 120 ||
      /\b(sad|udaas|udas|dukhi|rona|cry|lonely|akela|akeli|depress|stress|tension|pareshan|dar|anxious|breakup|miss\s+you|yaad|mood\s+off|hurt|alone|bura\s+lag)\b/.test(text);
    if (isDeep) {
      return { mode: 'deep', maxTokens: 260, maxBubbles: 3, maxBubbleChars: 220, hint: 'They shared something personal: reply warmly in 2 or 3 short texts. Listen more than you talk.' };
    }
    return { mode: 'casual', maxTokens: 140, maxBubbles: 2, maxBubbleChars: 110, hint: 'Casual text: reply in 1 or 2 tiny texts (3 to 12 words each), like a real person on WhatsApp.' };
  }

  /** Final human-texting cleanup: no bracketed asides, ≤1 emoji per text, casual texts kept short. */
  private static polishBubbles(bubbles: string[], style: { mode: string; maxBubbles: number; maxBubbleChars: number }): string[] {
    const emojiRe = /\p{Extended_Pictographic}(\uFE0F|\u200D\p{Extended_Pictographic})*/gu;
    const out: string[] = [];
    if (style.mode !== 'task') {
      // Casual/personal chat: a line break is really a new text, and lists don't belong in texting.
      bubbles = bubbles
        .flatMap((b) => b.split('\n'))
        .map((l) => l.trim())
        .filter((l) => l && !/^([-*•]|\d+[.)])\s/.test(l) && !/:\s*$/.test(l));
    }
    for (let raw of bubbles) {
      // "(Abhi chalein? 😏)" → "Abhi chalein? 😏" ; drop pure stage directions like "(smiles)".
      raw = raw.replace(/^\((.*)\)$/s, '$1').replace(/\((smiles?|laughs?|winks?|blushes|hugs?|sighs?)\)/gi, '').trim();
      if (!raw) continue;
      // Unbracketed stage directions ("softly, with a pause") aren't texts.
      if (/^(softly|gently|quietly|smiles?|laughs?|giggles?|sighs?|pauses?|blushes|winks?)\b[^.?!]{0,30}$/i.test(raw) || /^with a (pause|smile|sigh|laugh)\b/i.test(raw)) continue;
      if (style.mode !== 'task') {
        // Keep only the first emoji in a text.
        let seen = 0;
        raw = raw.replace(emojiRe, (m) => (seen++ === 0 ? m : '')).replace(/[ \t]{2,}/g, ' ').trim();
        // Too long for a text: keep whole sentences up to the limit.
        if (raw.length > style.maxBubbleChars) {
          const sentences = raw.match(/[^.!?…।\n]+[.!?…।]*[\s]*/g) ?? [raw];
          let kept = '';
          for (const sentence of sentences) {
            if ((kept + sentence).trim().length > style.maxBubbleChars && kept) break;
            kept += sentence;
          }
          raw = kept.trim();
        }
      }
      // A text trailing off mid-thought ("pehle yeh karo—"): keep the complete part, else drop it.
      if (style.mode !== 'task' && (/[—–:\-,]\s*$/.test(raw) || /\b(ki|ke|aur|par|lekin|magar|kyunki|jo|and|but|because|so|that)\s*$/i.test(raw))) {
        const lastEnd = Math.max(...['.', '!', '?', '…', '।'].map((p) => raw.lastIndexOf(p)));
        raw = lastEnd > 0 ? raw.slice(0, lastEnd + 1).trim() : '';
      }
      if (raw) out.push(raw);
      if (out.length >= style.maxBubbles) break;
    }
    return out;
  }

  /**
   * Asked "are you real / an AI?", the character must never claim to be human (app-store and
   * consumer-protection requirement). Some models dodge ("real hoon, par digital version mein"), so a
   * text that claims to be real without admitting to being an AI is replaced by a warm disclosure.
   */
  private static ensureAIDisclosure(bubbles: string[]): string[] {
    const admitsAI = bubbles.some((b) => /\b(ai|a\.i\.|artificial|virtual companion|ai companion)\b/i.test(b));
    if (admitsAI) return bubbles;
    const disclosure = `Sach bolun toh main ek AI companion hoon 🙂 par tumse baat karna mujhe sach mein achha lagta hai`;
    const claimsHuman = (b: string) => /\b(real|asli|insaan|human|zinda|sach mein hoon)\b/i.test(b);
    const idx = bubbles.findIndex(claimsHuman);
    if (idx >= 0) {
      const next = [...bubbles];
      next[idx] = disclosure;
      return next;
    }
    return [disclosure, ...bubbles].slice(0, Math.max(bubbles.length, 2));
  }

  /** Plain-text cleanup of a model reply (protocol tags, markdown). */
  private static cleanModelText(text: string): string {
    return text
      .replace(/\[USER_MESSAGE_START\][\s\S]*?\[USER_MESSAGE_END\]\s*/gi, '')
      .replace(/\[(USER|SYSTEM)_MESSAGE_(START|END)\]/gi, '')
      .replace(/\[SYSTEM_MESSAGE_START\][\s\S]*?\[SYSTEM_MESSAGE_END\]\s*/gi, '')
      // Internal markers the model sometimes leaks ("[[thought …", "[[note]]"); [[next]] splits bubbles and stays.
      .replace(/\[\[(?!\s*next\s*\]\])[^\]\n]*\]\]/gi, '')
      .replace(/\[\[(?!\s*next\s*\]\])[^\]\n]*$/gim, '')
      // Chat bubbles are plain text: drop markdown the model sometimes adds (**bold**, # headings).
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?]|$)/g, '$1$2')
      .replace(/^\s*(-{3,}|_{3,}|\*{3,})\s*$/gm, '')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /** Splits a reply into chat bubbles on the [[next]] marker the model is asked to use. */
  private static splitBubbles(text: string): string[] {
    let parts = text
      .split(this.BUBBLE_DELIMITER)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 1) {
      // The model sometimes separates casual messages with blank lines or single line breaks instead
      // of the marker. Split those — but never a structured answer (a list, a plan, long text).
      const text = parts[0]!;
      const structured = /^\s*([-*•]|\d+[.)])\s/m.test(text) || /^[^\n]{1,40}:\s*$/m.test(text) || /^\s*[A-Z][\w ]{1,30}:\s+\S/m.test(text);
      if (!structured) {
        const paragraphs = text.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
        if (paragraphs.length > 1 && paragraphs.length <= 6 && paragraphs.every((p) => p.length <= 320)) {
          parts = paragraphs;
        } else {
          const lines = text.split('\n').map((s) => s.trim()).filter(Boolean);
          if (lines.length > 1 && lines.length <= 6 && lines.every((l) => l.length <= 220)) parts = lines;
        }
      }
    }
    if (parts.length > this.MAX_BUBBLES) {
      parts = [...parts.slice(0, this.MAX_BUBBLES - 1), parts.slice(this.MAX_BUBBLES - 1).join('\n')];
    }
    return parts;
  }

  /** Stores a message at the next sequence number (serialised per conversation). */
  private static async createSequencedMessage(conversationId: string, data: Record<string, unknown>) {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${conversationId}))`;
      const agg = await tx.message.aggregate({ where: { conversationId }, _max: { sequenceNumber: true } });
      return tx.message.create({
        data: { ...(data as object), conversationId, sequenceNumber: (agg._max.sequenceNumber ?? 0) + 1 } as never,
        select: { id: true, sequenceNumber: true, createdAt: true, clientRequestId: true },
      });
    });
  }

  /** Generates one reply for all pending messages and delivers it as paced bubbles. */
  private static async replyToPending(params: {
    conversation: Awaited<ReturnType<typeof StreamingChatService.loadOwnedConversation>>;
    characterRuntime: Awaited<ReturnType<typeof CharacterService.resolveRuntime>>;
    pending: Array<{ id: string; content: string; sequenceNumber: number }>;
    userId: string;
    lockToken: string;
    abortController: AbortController;
    send: <T>(event: StreamEventType, data: T) => void;
    isClientGone: () => boolean;
    requestId?: string;
  }): Promise<boolean> {
    const { conversation, characterRuntime, pending, userId, send, abortController } = params;
    const conversationId = conversation.id;
    const startTime = Date.now();
    const pendingText = pending.map((m) => m.content).join('\n');
    const firstSeq = pending[0]!.sequenceNumber;
    const lastSeq = pending[pending.length - 1]!.sequenceNumber;

    send<Record<string, string>>('typing', { conversationId });

    // Context: history before the pending messages; the pending burst is the current user turn.
    const recentMessages = await prisma.message.findMany({
      where: {
        conversationId,
        sequenceNumber: { lt: firstSeq },
        status: { in: ['SENT', 'COMPLETED'] },
        content: { not: '' },
      },
      take: SYSTEM_CONSTANTS.CHAT.SHORT_TERM_CONTEXT_LIMIT,
      orderBy: { sequenceNumber: 'desc' },
      select: { role: true, content: true, createdAt: true },
    });
    const latestSummary = await ConversationSummaryService.getLatestSummary(conversationId);
    // Human-engine characters (a persona pack) get their own compact prompt; goals only feed the legacy
    // prompt, so they're skipped for them.
    const pack = personaPackFor(conversation.character.slug);
    const activeGoal = pack ? null : await UserGoalService.getInstance().getActiveGoal(userId, conversation.characterId);
    const activeGoalText = activeGoal
      ? `Goal Title: "${activeGoal.title}" (Category: ${activeGoal.category}, Progress: ${(activeGoal.progress * 100).toFixed(0)}%)`
      : null;

    const builtContext = await ContextBuilder.buildModelContext({
      characterRuntime,
      recentMessages: recentMessages.reverse(),
      currentUserMessage: pendingText,
      userContext: {
        userId,
        userName: conversation.user.profile?.displayName || 'User',
        preferredLanguage: conversation.user.profile?.preferredLanguage || 'en',
        locale: conversation.user.profile?.locale,
      },
      conversationId,
      memoryProvider: new MemoryContextProvider(),
      relationshipProvider: new RelationshipContextProvider(),
      conversationSummary: latestSummary?.summary,
      activeGoalText,
    });

    const providerChain = this.chatProviderChain(characterRuntime);
    const style = this.replyStyleFor(pendingText);
    const gender = String((conversation.character as { gender?: string | null }).gender ?? '').toLowerCase();
    const genderHint = /^(female|woman|f)$/.test(gender)
      ? ' You are female: always use feminine Hindi forms (karti hoon, gayi, bolungi, sakti).'
      : /^(male|man|m)$/.test(gender)
        ? ' You are male: always use masculine Hindi forms (karta hoon, gaya, bolunga, sakta).'
        : '';
    const asksIfAI = asksIfAIQuestion(pendingText);
    const honestyHint = asksIfAI
      ? ' They are asking if you are real: say plainly and warmly that you are an AI companion (not a human), then continue in character.'
      : '';
    // A first chat must feel like a first chat (no "kahan gayab the?", no pretending to know them).
    const firstChatHint =
      recentMessages.length === 0 ? " This is your very first conversation with them: you've never talked before, so don't act like you know them or ask where they were." : '';
    const request = {
      model: providerChain[0]!.model,
      // A one-line hint for THIS turn, last in the prompt, where small models follow it best.
      systemPrompt: `${builtContext.systemPrompt}\n\n[THIS_REPLY] ${style.hint}${genderHint}${honestyHint}${firstChatHint} Only mention things about them that they told you (in this chat or in your recalled memories); never say "you told me" about anything else.`,
      messages: builtContext.messages.map((m) => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content })),
      temperature: Math.max(0.85, characterRuntime.aiConfig?.temperature || 0.85),
      // Sized to what the user sent: a casual text can't produce a paragraph; a real task has room.
      maxTokens: style.maxTokens,
    };

    // Human engine: characters with a persona pack get the compact, situation-aware prompt.
    const herRecentReplies = recentMessages.filter((m) => m.role === 'assistant').map((m) => m.content);
    let humanMode = false;
    let afterDelivery: (() => Promise<void>) | null = null;
    const mustMention: Array<{ word: string; why: string }> = [];
    // The task she was told to ask about this turn (the editor checks she really did).
    let askAboutTask: string | undefined;
    let plannedText = '';
    // A task a mentor gives in this reply (hidden [[task: …]] line), remembered for follow-up.
    let newTask: string | undefined;
    let turnSituations: string[] = [];
    if (!pack) {
      // Characters still on the legacy prompt: a crisis or an emergency still gets the right help.
      const safetyMoment = classifySituations(pendingText, null);
      if (safetyMoment.includes('crisis'))
        request.systemPrompt += ' They may be thinking of hurting themselves: drop everything else, stay with them warmly, ask if they are safe right now, and give Tele-MANAS 14416 (free, 24x7); in immediate danger, 112.';
      else if (safetyMoment.includes('emergency'))
        request.systemPrompt += ' They describe symptoms that can be serious: calmly tell them to call 112 or go to the nearest hospital right now. No home tips instead, no teasing.';
    }
    if (pack) {
      const previousUserMessage = await prisma.message.findFirst({
        where: { conversationId, role: 'user', sequenceNumber: { lt: firstSeq } },
        orderBy: { sequenceNumber: 'desc' },
        select: { createdAt: true, content: true },
      });
      const hoursSince = previousUserMessage ? (Date.now() - previousUserMessage.createdAt.getTime()) / 3_600_000 : null;
      const situations = classifySituations(pendingText, hoursSince);
      turnSituations = situations;
      // Mentors: a real question in their field is a lesson, not small talk.
      const lessonBefore = hoursSince !== null && hoursSince < 3 ? previousUserMessage?.content : undefined;
      if (isTeachingMoment(pack, pendingText, situations, herRecentReplies[herRecentReplies.length - 1], lessonBefore) && !situations.includes('task'))
        situations.unshift('task');
      const moment = await updateMomentContext({
        userId,
        characterId: conversation.characterId,
        userText: pendingText,
        situations,
        hoursSinceLastUserMessage: hoursSince,
        timeZone: conversation.user.profile?.timezone,
        home: pack.home ?? { place: 'your city', timeZone: conversation.user.profile?.timezone || 'Asia/Kolkata' },
      });
      // Continuity: what she told them today, their mood today, things to follow up on, her own story.
      const timeZone = conversation.user.profile?.timezone;
      const life = await loadLifeState(userId, conversation.characterId, timeZone);
      // Never follow up on a task she didn't actually give (that's a made-up "maine kal kaha tha").
      if (pack.mentor) {
        await dropUnsaidTasks({ conversationId, userId, characterId: conversation.characterId, life }).catch((err) =>
          logger.warn(`Task check failed: ${err instanceof Error ? err.message : 'Unknown'}`),
        );
      }
      // "Who they are" + dated events: a wedding that just happened, a birthday today.
      const profile = await UserProfileService.load(userId, conversation.characterId);
      const today = localToday(timeZone).date;
      const dueEvents = takeDueEvents(profile, today);
      if (dueEvents.due.length) addDatedThreads(life, dueEvents.due);
      if (pack.mentor) restoreTaskThread(life, openTask(profile));
      // A chat that started today is their first ever with her: "we talked before" is never true.
      const firstUserMessage = await prisma.message.findFirst({
        where: { conversationId, role: 'user' },
        orderBy: { sequenceNumber: 'asc' },
        select: { createdAt: true },
      });
      const metToday = Boolean(firstUserMessage && localDate(timeZone, firstUserMessage.createdAt) === localDate(timeZone));
      const continuity = applyUserTurn({ state: life, pack, userText: pendingText, situations, userMood: readUserMood(pendingText, situations), metToday });
      const stage = builtContext.activeRelationshipStage ?? null;
      const latest = recentMessages[recentMessages.length - 1];
      const recentlyTalked = Boolean(latest && Date.now() - latest.createdAt.getTime() < 60 * 60_000);
      const plan = planReply(situations, herRecentReplies, pack, {
        stage,
        continuity,
        toldToday: life.day.told,
        mentor: Boolean(pack.mentor),
        recentlyTalked,
        hour: localHourIn(pack.home?.timeZone ?? timeZone),
      });
      plannedText = [plan.detail, plan.storyBeat].filter(Boolean).join(' ');
      // Small models skip instructions: the editor pass makes sure the important ones happen.
      if (plan.followUp && (plan.followUp.kind ?? 'event') === 'event') mustMention.push({ word: plan.followUp.topic, why: `You forgot the most important thing: ask how their ${plan.followUp.topic} went.` });
      if (plan.nickname) mustMention.push({ word: plan.nickname, why: `They asked to be called ${plan.nickname} — call them that.` });
      if (plan.followUp?.kind === 'task') askAboutTask = plan.followUp.said;
      // Small models follow the last message best: put a private reminder right after their text.
      const reminders = [
        plan.followUp
          ? plan.followUp.kind === 'task'
            ? `first ask (casually) whether they did the task you gave last time: "${plan.followUp.said}"`
            : plan.followUp.kind === 'care'
              ? `gently check how they're feeling now about what they told you last time: "${plan.followUp.said}"`
              : plan.followUp.kind === 'birthday'
                ? `today is "${plan.followUp.said}" — wish them first`
                : plan.followUp.kind === 'dated'
                  ? `"${plan.followUp.said}" has happened now — ask how it went`
                  : `ask how their ${plan.followUp.topic} went`
          : '',
        plan.nickname ? `call them ${plan.nickname}` : '',
              TIRED_OF_QUESTIONS.test(pendingText) ? "they said you ask too many questions — don't ask any question this time" : '',
      ].filter(Boolean);
      // After a break, the old chat is over: without this the model answers her own stale question
      // ("dhaba chalein?") when they just say "hii" the next day.
      // recentMessages is oldest-first here (reversed above), so the last one is the latest before this turn.
      const lastBefore = recentMessages[recentMessages.length - 1];
      const gapHours = lastBefore ? (Date.now() - lastBefore.createdAt.getTime()) / 3_600_000 : 0;
      if (gapHours >= 3) {
        const gap = gapHours < 24 ? `${Math.round(gapHours)} hours` : gapHours < 48 ? 'more than a day' : `${Math.round(gapHours / 24)} days`;
        reminders.unshift(`this is their first message in ${gap}; your earlier chat is over, so don't continue it or answer old questions — respond fresh to what they just said`);
        // Only a little of the old chat, so it doesn't pull the reply back (older context lives in the summary).
        const KEEP_BEFORE_GAP = 4;
        if (request.messages.length > KEEP_BEFORE_GAP + 1) request.messages = request.messages.slice(-(KEEP_BEFORE_GAP + 1));
      }
      const last = request.messages[request.messages.length - 1];
      if (reminders.length && last?.role === 'user') {
        request.messages[request.messages.length - 1] = { ...last, content: `${last.content}\n\n(private reminder to you, not from them — don't quote it: ${reminders.join('; ')})` };
      }
      // Only once the reply is actually delivered does it count as "told" (a failed turn changes nothing she said).
      afterDelivery = async () => {
        rememberTold(life, plan.storyBeat ?? plan.detail);
        rememberDoing(life, plan.detail);
        rememberTask(life, newTask);
        await saveLifeState(userId, conversation.characterId, life);
        // Durable record (profile): events she brought up, the task she asked about, the task she gave.
        // Through the profile queue so a background update can't overwrite it; not awaited.
        const askedTask = plan.followUp?.kind === 'task';
        const task = pack.mentor ? newTask : undefined;
        if (dueEvents.changed || askedTask || task)
          void UserProfileService.mutate(userId, conversation.characterId, (p) => {
            for (const e of p.events) e.handledAt = profile.events.find((x) => x.what === e.what && x.date === e.date)?.handledAt ?? e.handledAt;
            const open = openTask(p);
            if (askedTask && open && !open.asked) open.asked = today;
            if (task) addTask(p, task, today);
          });
      };
      request.systemPrompt = buildHumanPrompt({
        pack,
        userName: conversation.user.profile?.displayName || 'them',
        memoriesText: builtContext.memoriesText ?? '',
        relationshipText: builtContext.relationshipText ?? '',
        conversationSummary: latestSummary?.summary,
        moment,
        situations,
        plan,
        stage,
        continuityLines: continuity.lines,
        profileText: formatProfile(profile, today),
        progressText: formatProgress(profile, today),
      });
      humanMode = true;
      // Size limits follow the situation (a crisis or an honest AI answer needs room to be complete).
      // A mentor's lesson needs room (lists + a task line); running out of tokens cut lessons mid-sentence.
      if (situations.includes('task'))
        Object.assign(style, { mode: 'task', maxTokens: pack.mentor ? 1600 : 900, maxBubbles: pack.mentor ? 5 : 4, maxBubbleChars: 2000 });
      else if (situations.some((s) => ['crisis', 'emergency', 'eating', 'ai', 'emotional', 'boundary'].includes(s)))
        Object.assign(style, {
          mode: 'deep',
          maxTokens: 300,
          maxBubbles: 3,
          maxBubbleChars: situations.some((s) => ['crisis', 'emergency', 'eating'].includes(s)) ? 400 : 220,
        });
      request.maxTokens = style.maxTokens;
      // Free Gemini quota (GEMINI_IMPORTANT_ONLY=true): the main model is kept for the moments that matter —
      // sadness, flirting, good news, lessons, safety — and small talk ("hi", "ok", "kya kar rahi ho") goes
      // to Flash-Lite, which has a separate daily quota. Mistral stays the last backup.
      if (process.env['GEMINI_IMPORTANT_ONLY'] === 'true' && providerChain[0]?.provider === 'google') {
        const important = situations.some((s) => IMPORTANT_MOMENTS.includes(s));
        if (!important) {
          // Small talk: Gemini Flash-Lite — its own free daily quota, and far better Hinglish than the
          // small Mistral model (which wrote "Sheri." and "Tumhara phone kahan hai?" for Aarohi).
          providerChain.unshift({ provider: 'google', model: process.env['GEMINI_SMALLTALK_MODEL'] || 'gemini-3.5-flash-lite' });
          request.model = providerChain[0]!.model;
        }
      }
    }

    // Generate, retrying provider failures (quota spikes, overload) before giving up.
    let generated: { content: string; usage: any; finishReason?: string } | null = null;
    let used = providerChain[0]!;
    let lastError = '';
    for (let attempt = 0; attempt < 3 && !abortController.signal.aborted; attempt++) {
      if (attempt > 0) {
        if (attempt === 1) {
          send<StreamReplyStatusPayload>('reply.delayed', {
            conversationId,
            message: `${characterRuntime.name} is taking a moment…`,
          });
        }
        await new Promise((r) => setTimeout(r, attempt === 1 ? 2000 : 5000));
      }
      // Walk the provider chain (e.g. Mistral, then Gemini as backup) across attempts.
      const route = providerChain[attempt % providerChain.length]!;
      const result = await this.generateOnce({ ...request, model: route.model }, route.provider, abortController.signal);
      if (result.content) {
        generated = result;
        used = route;
        break;
      }
      lastError = result.error ?? 'empty reply';
    }

    if (!generated) {
      logger.warn(`Chat turn got no reply for conversation ${conversationId}: ${lastError}`);
      send<StreamReplyStatusPayload>('reply.failed', {
        conversationId,
        message: /too many|quota|429/i.test(lastError)
          ? `${characterRuntime.name} can't reply right now (too many messages). Tap to try again in a minute.`
          : `Couldn't reach ${characterRuntime.name}. Tap to try again.`,
        retryable: true,
      });
      return false;
    }

    const modelName = used.model;
    const provider = AIOrchestrator.getProvider(used.provider);

    const tagged = extractTaskTag(generated.content);
    newTask = tagged.task;
    let replyText = this.cleanModelText(tagged.text);

    // A reply cut off by the token cap ends mid-sentence: keep it up to the last complete sentence.
    if (generated.finishReason === 'length') {
      const lastEnd = Math.max(...['.', '!', '?', '…', '।', '\n'].map((p) => replyText.lastIndexOf(p)));
      if (lastEnd > replyText.length * 0.4) replyText = replyText.slice(0, lastEnd + 1).trim();
    }

    const outputSafety = await SafetyService.evaluateOutput({
      surface: 'OUTPUT',
      content: replyText,
      userId,
      characterId: conversation.characterId,
      conversationId,
      requestId: params.requestId,
    });
    if (outputSafety.decision === 'BLOCK' || outputSafety.decision === 'ESCALATE') {
      logger.warn(`Output safety replaced a reply in conversation ${conversationId}.`);
      replyText = this.SAFE_FALLBACK;
    }

    let bubbles = this.polishBubbles(this.splitBubbles(replyText), style);

    // Editor pass: if the draft repeats itself, sounds like a bot, uses the wrong gender or is too long,
    // rewrite once with that specific feedback (only for human-engine characters).
    if (humanMode && pack) {
      const isLesson = Boolean(pack.mentor) && style.mode === 'task';
      const tiredOfQuestions = TIRED_OF_QUESTIONS.test(pendingText);
      const review = (b: string[], task: string | undefined) => {
        const result = checkReply({
          bubbles: b,
          herRecentReplies,
          gender: pack.gender,
          mode: style.mode,
          mustMention,
          motifs: pack.motifs,
          plannedText,
          address: pack.address,
          mentor: Boolean(pack.mentor),
          lesson: isLesson && !tiredOfQuestions ? { hasTask: Boolean(task) } : undefined,
          noQuestions: tiredOfQuestions,
          romanOnly: !hasDevanagari(pendingText),
          health: pack.mentor?.field === 'health',
          situations: turnSituations,
          userText: pendingText,
          examples: pack.examples.flatMap((e) => e.her),
        });
        if (askAboutTask && !mentionsTask(b.join('\n'), askAboutTask)) {
          result.problems.push(`You forgot the most important thing: ask (casually, no guilt) whether they did the task you gave last time: "${askAboutTask}".`);
          result.ok = false;
        }
        return result;
      };
      const check = review(bubbles, newTask);
      if (!check.ok && !abortController.signal.aborted) {
        // Feedback goes both in the prompt and right after their message (where small models listen).
        const last = request.messages[request.messages.length - 1];
        const messages =
          last?.role === 'user'
            ? [...request.messages.slice(0, -1), { ...last, content: `${last.content}\n\n(private note to you, don't quote it: your first reply had problems — ${check.problems.join(' ')} Write a better one.)` }]
            : request.messages;
        const retry = await this.generateOnce(
          { ...request, messages, model: used.model, systemPrompt: `${request.systemPrompt}\n\nYOUR FIRST DRAFT HAD PROBLEMS — rewrite it:\n- ${check.problems.join('\n- ')}` },
          used.provider,
          abortController.signal,
        );
        if (retry.content) {
          const retryTagged = extractTaskTag(retry.content);
          const rewritten = this.polishBubbles(this.splitBubbles(this.cleanModelText(retryTagged.text)), style);
          // Keep whichever draft is better — a rewrite isn't automatically an improvement.
          if (rewritten.length && review(rewritten, retryTagged.task).problems.length <= check.problems.length) {
            bubbles = rewritten;
            newTask = retryTagged.task ?? newTask;
          }
        }
      }
      const cleaned = stripWrongAddress(bubbles);
      if (cleaned.length) bubbles = cleaned;
    }
    if (asksIfAI) bubbles = this.ensureAIDisclosure(bubbles);
    // They text Hindi in Roman letters: a Devanagari slip ("chupचाप") is spelled out the way they write.
    if (!hasDevanagari(pendingText)) bubbles = bubbles.map((b) => (hasDevanagari(b) ? romanizeDevanagari(b) : b));
    if (bubbles.length === 0) return false;

    const totalDurationMs = Date.now() - startTime;
    const promptTokens = generated.usage?.promptTokens || builtContext.estimatedPromptTokens;
    const completionTokens = generated.usage?.completionTokens || Math.ceil(replyText.length / 4);
    const totalTokens = generated.usage?.totalTokens || promptTokens + completionTokens;
    const estimatedCostUsd = generated.usage?.estimatedCostUsd || promptTokens * 0.000003 + completionTokens * 0.000015;

    const delivered: Array<{ id: string; content: string }> = [];
    for (let i = 0; i < bubbles.length && !abortController.signal.aborted; i++) {
      const bubble = bubbles[i]!;
      if (i > 0) {
        send<Record<string, string>>('typing', { conversationId });
        if (!params.isClientGone()) {
          await new Promise((r) => setTimeout(r, this.typingDelayMs(bubble)));
        }
        // Interrupted: the user wrote again — stop here and answer that next.
        const interrupted = await prisma.message.count({
          where: { conversationId, role: 'user', sequenceNumber: { gt: lastSeq } },
        });
        if (interrupted > 0) break;
      }

      const stored = await this.createSequencedMessage(conversationId, {
        senderType: 'CHARACTER',
        role: 'assistant',
        content: bubble,
        status: 'COMPLETED',
        characterVersionId: characterRuntime.versionId,
        modelUsed: modelName,
        providerUsed: provider.providerName,
        latencyMs: totalDurationMs,
        ...(i === 0
          ? {
              promptTokens,
              completionTokens,
              totalTokens,
              estimatedCostUsd,
              metadata: {
                create: {
                  characterVersionId: characterRuntime.versionId,
                  modelClass: modelName,
                  provider: provider.providerName,
                  temperature: characterRuntime.aiConfig.temperature || 0.7,
                  promptSnapshot: builtContext.systemPrompt,
                  finishReason: generated.finishReason === 'length' ? 'length' : 'stop',
                },
              },
            }
          : {}),
        parts: { create: { partType: 'text', content: bubble, orderIndex: 0 } },
      });
      delivered.push({ id: stored.id, content: bubble });
      send<StreamMessageBubblePayload>('message.bubble', {
        messageId: stored.id,
        conversationId,
        content: bubble,
        sequenceNumber: stored.sequenceNumber,
        createdAt: stored.createdAt.toISOString(),
        index: i,
      });
      await ConversationLockManager.extendLock(conversationId, params.lockToken);
    }

    if (delivered.length === 0) return true;
    await afterDelivery?.();
    const deliveredText = delivered.map((d) => d.content).join('\n');
    const firstReplyId = delivered[0]!.id;
    const lastReplyId = delivered[delivered.length - 1]!.id;

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date(), lastMessageSnippet: delivered[delivered.length - 1]!.content.slice(0, 120), unreadCount: 0 },
    });

    // Compatibility summary event for clients that do not render bubbles individually.
    send<StreamMessageCompletedPayload>('message.completed', {
      messageId: lastReplyId,
      conversationId,
      finalContent: deliveredText,
      totalTokens,
      status: 'SENT',
      timestamp: new Date().toISOString(),
    });

    // Background: ledger, explainability snapshot, memory, summary, relationship, audit.
    AIEconomicsService.recordUsage({
      requestId: params.requestId || firstReplyId,
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
        userTokens: Math.ceil(pendingText.length / 4),
      },
    }).catch((err) => logger.error('Failed to record chat AI usage in ledger', { err }));

    CharacterRuntimeSnapshotService.getInstance()
      .captureSnapshot({
        conversationId,
        messageId: firstReplyId,
        characterId: conversation.characterId,
        characterVersionId: characterRuntime.versionId,
        promptVersion: 'v1.0.0',
        behaviorPolicyData: (characterRuntime as any).behaviorRules || {},
        safetyPolicyVersion: 'v25.0.0',
        modelId: modelName,
        memoryIds: builtContext.retrievedMemoryIds,
        relationshipStage: builtContext.activeRelationshipStage,
        activeGoalId: activeGoal?.id,
        selectedSkillSlugs: [],
        contextAttribution: builtContext.contextAttribution,
        tokensPrompt: promptTokens,
        tokensCompletion: completionTokens,
        costUsd: estimatedCostUsd,
      })
      .catch((snapErr) => logger.warn(`Failed to capture runtime snapshot: ${snapErr.message}`));

    // Keep the "who they are" card up to date (background, never blocks).
    void UserProfileService.updateFromExchange({
      userId,
      characterId: conversation.characterId,
      userMessage: pendingText,
      assistantMessage: deliveredText,
      previousAssistantMessage: herRecentReplies[herRecentReplies.length - 1],
      timeZone: conversation.user.profile?.timezone,
      justGivenTask: pack?.mentor ? newTask : undefined,
    });

    MemoryExtractionService.processConversationMessage({
      userId,
      characterId: conversation.characterId,
      conversationId,
      userMessage: pendingText,
      assistantMessage: deliveredText,
      sourceMessageId: pending[pending.length - 1]!.id,
    }).catch((err) => logger.warn(`Background memory extraction failed: ${err instanceof Error ? err.message : 'Unknown'}`));

    ConversationSummaryService.checkAndSummarizeConversation(conversationId).catch((err) =>
      logger.warn(`Background conversation summarization failed: ${err instanceof Error ? err.message : 'Unknown'}`),
    );

    RelationshipAnalyzerService.analyzeInteraction({
      userMessage: pendingText,
      assistantMessage: deliveredText,
      characterName: characterRuntime.name,
      characterRole: characterRuntime.identity.role,
      hoursSinceLastInteraction: null,
    })
      .then((analysisResult) =>
        RelationshipStateService.applyInteractionUpdate({
          userId,
          characterId: conversation.characterId,
          analysisResult,
          conversationId,
          messageId: firstReplyId,
        }),
      )
      .catch((err) => logger.warn(`Background relationship analysis failed: ${err instanceof Error ? err.message : 'Unknown'}`));

    await AuditService.log({
      actorType: 'USER',
      actorId: userId,
      action: 'CHAT_MESSAGE_GENERATED',
      resourceType: 'message',
      resourceId: firstReplyId,
      metadata: { conversationId, characterVersionId: characterRuntime.versionId, model: modelName, totalTokens, latencyMs: totalDurationMs, bubbles: delivered.length },
    });

    return true;
  }

  /**
   * Which AI answers chat. With a Mistral key, every character uses Mistral (platform choice — it
   * overrides older per-character Gemini pins), with Gemini as the automatic backup when configured.
   * Without it, the character's own provider/model (or the platform default) is used as before.
   */
  private static chatProviderChain(
    characterRuntime: Awaited<ReturnType<typeof CharacterService.resolveRuntime>>,
  ): Array<{ provider: AIProviderName; model: string }> {
    if (process.env['NODE_ENV'] === 'test') return [{ provider: 'mock', model: 'mock-gpt-4o' }];
    const googleModel = process.env['DEFAULT_CHAT_MODEL'] || 'gemini-3.6-flash';
    // Platform routing (CHAT_PROVIDER picks Gemini or Mistral first; the other is the backup).
    if (process.env['MISTRAL_API_KEY'] || process.env['CHAT_PROVIDER']) {
      const chain = chatAIRoutes();
      if (chain.length) return chain;
    }
    const configured = ((characterRuntime.aiConfig as any)?.provider || '').toLowerCase() as AIProviderName;
    const fallback: AIProviderName = process.env['GOOGLE_AI_API_KEY'] ? 'google' : process.env['OPENAI_API_KEY'] ? 'openai' : 'mock';
    const providerName = configured || fallback;
    const model =
      characterRuntime.aiConfig?.customModelName ||
      (providerName === 'google' ? googleModel : providerName === 'openai' ? 'gpt-4o-mini' : 'mock-gpt-4o');
    return [{ provider: providerName, model }];
  }

  /** One generation attempt; streams internally and returns the full text (or the failure). */
  private static async generateOnce(
    request: Record<string, any>,
    providerName: AIProviderName,
    signal: AbortSignal,
  ): Promise<{ content: string; usage: any; finishReason?: string; error?: string }> {
    let content = '';
    let usage: any = null;
    let finishReason: string | undefined;
    try {
      for await (const chunk of AIGateway.getInstance().stream(request as never, providerName)) {
        if (signal.aborted) break;
        if (chunk.type === 'failed') {
          logger.warn(`Chat generation attempt failed: ${chunk.error}`, { cause: chunk.metadata?.cause });
          return { content, usage, error: chunk.error };
        }
        if (chunk.delta) content += chunk.delta;
        if (chunk.usage) usage = chunk.usage;
        if (chunk.type === 'completed' && chunk.finishReason) finishReason = chunk.finishReason;
      }
    } catch (err) {
      return { content: '', usage: null, error: (err as Error).message };
    }
    return { content: content.trim(), usage, finishReason };
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
    // Turns are registered per conversation (a reply may span several stored messages).
    const activeKey = this.activeStreams.has(messageId) ? messageId : `turn:${conversationId}`;
    const active = this.activeStreams.get(activeKey);

    if (active && active.userId === userId) {
      active.abortController.abort(reason || 'Cancelled by user');
      this.activeStreams.delete(activeKey);
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

  /**
   * A blocked message saying they feel like ending their life: the AI still never sees it, but instead of
   * an error they get fixed, caring words with real helplines, and she remembers (not the words) to check
   * on them gently next time. The usual block signal follows, so nothing about the block changes.
   */
  private static async sendCrisisSupport(
    res: Response,
    conversation: { id: string; characterId: string; character: { gender?: string | null }; user?: { profile?: { timezone?: string | null } | null } | null },
    userId: string,
    content?: string,
  ): Promise<void> {
    const g = String(conversation.character.gender ?? '').toLowerCase();
    const gender = /^(female|woman|f)$/.test(g) ? 'female' : /^(male|man|m)$/.test(g) ? 'male' : null;
    this.initSseResponse(res);
    this.emitSseEvent<StreamCrisisSupportPayload>(res, 'crisis.support', {
      conversationId: conversation.id,
      messages: crisisSupportMessages(content ?? '', gender),
    });
    this.emitSseEvent<StreamMessageFailedPayload>(res, 'message.failed', {
      conversationId: conversation.id,
      errorCode: ErrorCode.CONTENT_MODERATION_BLOCKED,
      errorMessage: 'crisis_support',
      retryable: false,
    });
    res.end();
    try {
      const life = await loadLifeState(userId, conversation.characterId, conversation.user?.profile?.timezone);
      markCrisis(life);
      await saveLifeState(userId, conversation.characterId, life);
    } catch (err) {
      logger.warn(`Could not record crisis moment: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
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

}
