import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../config/logger.js';
import { ErrorCode } from '@ai-companion/config';
import { NotFoundError, ForbiddenError } from '../../../shared/errors/AppError.js';
import type { MessageFeedbackInput } from '@ai-companion/validation';
import type { MessageFeedbackData } from '@ai-companion/types';

export class MessageFeedbackService {
  /**
   * Submits or updates user feedback for an assistant message.
   */
  public static async submitFeedback(
    userId: string,
    conversationId: string,
    messageId: string,
    input: MessageFeedbackInput,
  ): Promise<MessageFeedbackData> {
    // 1. Verify message and conversation ownership
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: { conversation: true },
    });

    if (!message || message.conversationId !== conversationId) {
      throw new NotFoundError('Message not found', ErrorCode.MESSAGE_NOT_FOUND);
    }

    if (message.conversation.userId !== userId) {
      throw new ForbiddenError('Access denied', ErrorCode.FORBIDDEN);
    }

    // 2. Check if feedback already exists for this message by this user
    const existing = await prisma.messageFeedback.findFirst({
      where: {
        messageId,
        userId,
      },
    });

    let feedbackRecord;
    if (existing) {
      feedbackRecord = await prisma.messageFeedback.update({
        where: { id: existing.id },
        data: {
          rating: input.rating,
          feedbackText: input.feedbackText,
          reasonCategory: input.reasonCategory,
        },
      });
    } else {
      feedbackRecord = await prisma.messageFeedback.create({
        data: {
          messageId,
          userId,
          rating: input.rating,
          feedbackText: input.feedbackText,
          reasonCategory: input.reasonCategory,
        },
      });
    }

    logger.info(`Recorded message feedback ${input.rating} from user ${userId} on message ${messageId}`);

    return {
      id: feedbackRecord.id,
      messageId: feedbackRecord.messageId,
      userId: feedbackRecord.userId,
      rating: feedbackRecord.rating as any,
      feedbackText: feedbackRecord.feedbackText,
      reasonCategory: feedbackRecord.reasonCategory,
      createdAt: feedbackRecord.createdAt.toISOString(),
    };
  }
}
