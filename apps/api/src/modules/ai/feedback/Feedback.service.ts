import { prisma } from '../../../infrastructure/database/prisma.js';
import { HumanFeedbackData } from '@ai-companion/types';
import { NotFoundError } from '../../../shared/errors/AppError.js';

export interface SubmitFeedbackInput {
  userId: string;
  generationTraceId?: string;
  messageId?: string;
  conversationId?: string;
  characterId?: string;
  score: 1 | -1;
  reasonCategory?: string;
  comment?: string;
}

export class FeedbackService {
  private static instance: FeedbackService;

  private constructor() {}

  public static getInstance(): FeedbackService {
    if (!FeedbackService.instance) {
      FeedbackService.instance = new FeedbackService();
    }
    return FeedbackService.instance;
  }

  public async submitFeedback(input: SubmitFeedbackInput): Promise<HumanFeedbackData> {
    // Only the user the generation was produced for may rate it; merge into (never replace) the
    // trace's existing metadata.
    let recorded = false;
    if (input.generationTraceId) {
      const trace = await prisma.aIGenerationTrace.findFirst({
        where: { id: input.generationTraceId, userId: input.userId },
        select: { id: true, metadata: true },
      });
      if (trace) {
        const existing = (trace.metadata && typeof trace.metadata === 'object' ? trace.metadata : {}) as Record<string, unknown>;
        await prisma.aIGenerationTrace.update({
          where: { id: trace.id },
          data: {
            metadata: {
              ...existing,
              feedbackScore: input.score,
              feedbackReason: input.reasonCategory || input.comment || null,
            } as never,
          },
        });
        recorded = true;
      }
    }
    if (!recorded) {
      throw new NotFoundError('Generation not found');
    }

    return {
      id: `fb_${input.generationTraceId}`,
      generationTraceId: input.generationTraceId || null,
      userId: input.userId,
      characterId: input.characterId || null,
      score: input.score,
      reasonCategory: input.reasonCategory as any,
      comment: input.comment || null,
      createdAt: new Date().toISOString(),
    };
  }

  public async getFeedbackSummary(timeframeDays: number = 30): Promise<{
    totalFeedback: number;
    positiveCount: number;
    negativeCount: number;
    positiveRate: number;
    reasonBreakdown: Record<string, number>;
  }> {
    const since = new Date(Date.now() - timeframeDays * 24 * 60 * 60 * 1000);
    const traces = await prisma.aIGenerationTrace.findMany({
      where: {
        createdAt: { gte: since },
        metadata: { not: null as any },
      },
      select: {
        metadata: true,
      },
    });

    let positiveCount = 0;
    let negativeCount = 0;
    const reasonBreakdown: Record<string, number> = {};

    for (const t of traces) {
      const meta = t.metadata as any;
      if (meta?.feedbackScore === 1) {
        positiveCount++;
      } else if (meta?.feedbackScore === -1) {
        negativeCount++;
      }

      if (meta?.feedbackReason) {
        reasonBreakdown[meta.feedbackReason] = (reasonBreakdown[meta.feedbackReason] || 0) + 1;
      }
    }

    const totalFeedback = positiveCount + negativeCount;
    const positiveRate = totalFeedback > 0 ? Math.round((positiveCount / totalFeedback) * 100) / 100 : 1.0;

    return {
      totalFeedback,
      positiveCount,
      negativeCount,
      positiveRate,
      reasonBreakdown,
    };
  }
}
