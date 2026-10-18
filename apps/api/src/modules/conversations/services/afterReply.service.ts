import { createConcurrencyLimit } from '../../../shared/utils/concurrencyLimit.js';
import { spendCapReached } from '../../ai/telemetry/spendGuard.js';
import { redis } from '../../../infrastructure/redis/redis.js';
import { QueueManager } from '../../../infrastructure/queues/QueueManager.js';
import { logger } from '../../../config/logger.js';
import { WORKER_ALIVE_KEY } from '../../../jobs/scheduledJobs.js';
import { setAICostContext, withAICostTask } from '../../ai/telemetry/aiCostLedger.js';
import { UserProfileService } from '../../memory/services/userProfile.service.js';
import { MemoryExtractionService } from '../../memory/services/memoryExtraction.service.js';
import { ConversationSummaryService } from '../../memory/services/conversationSummary.service.js';
import { RelationshipAnalyzerService } from '../../relationships/services/relationshipAnalyzer.service.js';
import { RelationshipStateService } from '../../relationships/services/relationshipState.service.js';

/**
 * The AI work after every reply — the "who they are" card, memories, the running summary and the
 * relationship — about 3–4 AI calls per message that the user never waits for.
 *
 * Normally it goes through the job queue (worker, queue "memory-extraction", limited concurrency, retries),
 * so a busy evening can't flood the AI provider or slow down live replies. Without a running worker
 * (local dev, or the worker is down) it runs right away in this process, as before.
 */

export interface AfterReplyJob {
  userId: string;
  characterId: string;
  conversationId: string;
  userMessage: string;
  assistantMessage: string;
  previousAssistantMessage?: string;
  timeZone?: string | null;
  justGivenTask?: string;
  characterGender?: string;
  userLanguage?: 'hinglish' | 'english';
  sourceMessageId: string;
  replyMessageId: string;
  characterName: string;
  characterRole: string;
}

let workerSeen = { at: 0, alive: false };

/** The worker's own heartbeat (not the scheduled jobs' — the API may run those itself). Checked at most every 30 s. */
async function workerAlive(): Promise<boolean> {
  if (Date.now() - workerSeen.at < 30_000) return workerSeen.alive;
  let alive = false;
  try {
    alive = (await redis.exists(WORKER_ALIVE_KEY)) === 1;
  } catch {
    alive = false;
  }
  workerSeen = { at: Date.now(), alive };
  return alive;
}

/** Runs the work (in the worker, or inline). Each part fails on its own without stopping the others. */
export async function runAfterReply(j: AfterReplyJob): Promise<void> {
  // Memory and profile updates are extra AI calls: skipped once the daily spending cap is reached (audit H-1).
  if (await spendCapReached()) return;
  setAICostContext({ userId: j.userId, characterId: j.characterId, conversationId: j.conversationId, task: 'chat' });
  const warn = (what: string) => (err: unknown) => logger.warn(`Background ${what} failed: ${err instanceof Error ? err.message : 'Unknown'}`);
  await Promise.all([
    UserProfileService.updateFromExchange({
      userId: j.userId,
      characterId: j.characterId,
      userMessage: j.userMessage,
      assistantMessage: j.assistantMessage,
      previousAssistantMessage: j.previousAssistantMessage,
      timeZone: j.timeZone,
      justGivenTask: j.justGivenTask,
      characterGender: j.characterGender as never,
      userLanguage: j.userLanguage,
    }).catch(warn('profile update')),
    withAICostTask('memory', {}, () =>
      MemoryExtractionService.processConversationMessage({
        userId: j.userId,
        characterId: j.characterId,
        conversationId: j.conversationId,
        userMessage: j.userMessage,
        assistantMessage: j.assistantMessage,
        sourceMessageId: j.sourceMessageId,
      }),
    ).catch(warn('memory extraction')),
    withAICostTask('memory', {}, () => ConversationSummaryService.checkAndSummarizeConversation(j.conversationId)).catch(warn('summarization')),
    RelationshipAnalyzerService.analyzeInteraction({
      userMessage: j.userMessage,
      assistantMessage: j.assistantMessage,
      characterName: j.characterName,
      characterRole: j.characterRole,
      hoursSinceLastInteraction: null,
    })
      .then((analysisResult) =>
        RelationshipStateService.applyInteractionUpdate({
          userId: j.userId,
          characterId: j.characterId,
          analysisResult,
          conversationId: j.conversationId,
          messageId: j.replyMessageId,
        }),
      )
      .catch(warn('relationship analysis')),
  ]);
}

/** Called after each reply: queue it (worker running) or run it now. Never throws, never blocks. */
export function scheduleAfterReply(j: AfterReplyJob): void {
  void (async () => {
    if (await workerAlive()) {
      try {
        await QueueManager.addJob('memory-extraction', 'after-reply', j, { priority: 'LOW', idempotencyKey: `after-reply-${j.replyMessageId}` });
        return;
      } catch (err) {
        logger.warn('Could not queue after-reply work; running it now', { error: err instanceof Error ? err.message : err });
      }
    }
    // Without the worker it runs here — a few at a time, so a busy evening's memory/profile updates can't crowd
    // out live replies (audit M-5). Past a full waiting line the update is skipped (best effort, logged).
    const ran = await inlineLimit.run(() =>
      runAfterReply(j).catch((err) => logger.warn('After-reply work failed', { error: err instanceof Error ? err.message : err })),
    );
    if (!ran) logger.warn('After-reply work skipped: too much waiting (start the worker for busy hours)', { conversationId: j.conversationId });
  })();
}

const inlineLimit = createConcurrencyLimit(Number(process.env['AFTER_REPLY_CONCURRENCY'] ?? 4), Number(process.env['AFTER_REPLY_MAX_WAITING'] ?? 200));
export const afterReplyInlineStats = () => inlineLimit.stats();
