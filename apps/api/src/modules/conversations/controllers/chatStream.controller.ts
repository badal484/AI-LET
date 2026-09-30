import { Request, Response, NextFunction } from 'express';
import { StreamingChatService } from '../services/streamingChat.service.js';
import { sendMessageSchema, cancelGenerationSchema, retryMessageSchema } from '@ai-companion/validation';
import { ApiResponse } from '../../../shared/utils/apiResponse.js';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { NotFoundError, ForbiddenError } from '../../../shared/errors/AppError.js';
import { ErrorCode } from '@ai-companion/config';

export class ChatStreamController {
  /**
   * Initiates SSE streaming message generation for a conversation.
   */
  public static async sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || (req as any).user?.id || (req as any).userPrincipal?.userId;
      const conversationId = req.params['conversationId'] as string;
      const input = sendMessageSchema.parse(req.body);

      await StreamingChatService.streamMessage(req, res, userId, conversationId, input);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Cancels an active in-flight streaming generation.
   */
  public static async cancelGeneration(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || (req as any).user?.id || (req as any).userPrincipal?.userId;
      const conversationId = req.params['conversationId'] as string;
      const messageId = req.params['messageId'] as string;
      const input = cancelGenerationSchema.parse(req.body || {});

      const result = await StreamingChatService.cancelGeneration(
        userId,
        conversationId,
        messageId,
        input.reason,
      );

      ApiResponse.success(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retries generation for a failed assistant message.
   */
  public static async retryMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || (req as any).user?.id || (req as any).userPrincipal?.userId;
      const conversationId = req.params['conversationId'] as string;
      const messageId = req.params['messageId'] as string;
      const input = retryMessageSchema.parse(req.body || {});

      // Find the last user message preceding this message or the message itself
      const targetMessage = await prisma.message.findUnique({
        where: { id: messageId },
        include: { conversation: true },
      });

      if (!targetMessage || targetMessage.conversationId !== conversationId) {
        throw new NotFoundError('Message to retry not found', ErrorCode.MESSAGE_NOT_FOUND);
      }

      if (targetMessage.conversation.userId !== userId) {
        throw new ForbiddenError('Access denied', ErrorCode.FORBIDDEN);
      }

      // Retry = answer every unanswered message now (never re-post the user's text, never post a
      // failure placeholder). Works whether the target is the user's message or an old failed reply.
      await StreamingChatService.streamMessage(req, res, userId, conversationId, {
        content: targetMessage.content,
        clientRequestId: input.clientRequestId,
        answerPendingOnly: true,
      });
    } catch (err) {
      next(err);
    }
  }
}
