import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { NotFoundError, ValidationError, PermissionDeniedError } from '../../../shared/errors/AppError.js';
import { DeveloperUsageMeteringService } from '../services/DeveloperUsageMeteringService.js';
import { WebhookService } from '../services/WebhookService.js';
import { AIOrchestrator } from '../../../infrastructure/ai/AIOrchestrator.js';
import { logger } from '../../../shared/utils/logger.js';
import type { PublicConversationDTO, PublicMessageDTO } from '@ai-companion/types';

export class PublicConversationController {
  /**
   * POST /v1/conversations
   * Creates or retrieves an active conversation with a character.
   */
  public static async createConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.developerContext) {
        throw new PermissionDeniedError('Authentication required');
      }

      const { characterId, title } = req.body;
      if (!characterId || typeof characterId !== 'string') {
        throw new ValidationError('characterId is required');
      }

      const character = await prisma.character.findUnique({
        where: { id: characterId },
      });

      if (!character) {
        throw new NotFoundError(`Character '${characterId}' not found`);
      }

      const userId = req.developerContext.userId;

      // Find existing or create
      let conversation = await prisma.conversation.findUnique({
        where: {
          userId_characterId: {
            userId,
            characterId,
          },
        },
      });

      let isNew = false;
      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            userId,
            characterId,
            title: title ? String(title).trim() : `Chat with ${character.name}`,
            status: 'ACTIVE',
          },
        });
        isNew = true;
      }

      // Record metered usage
      DeveloperUsageMeteringService.getInstance().recordUsage({
        projectId: req.developerContext.projectId,
        metric: 'API_REQUESTS',
        quantity: 1,
        endpoint: '/v1/conversations',
        environment: req.developerContext.environment,
      }).catch(() => {});

      if (isNew) {
        WebhookService.getInstance().dispatchWebhookEvent(
          req.developerContext.projectId,
          'conversation.created',
          {
            conversation_id: conversation.id,
            character_id: character.id,
            title: conversation.title,
            created_at: conversation.createdAt.toISOString(),
          }
        ).catch(() => {});
      }

      res.status(isNew ? 201 : 200).json({
        data: PublicConversationController.toPublicConversationDTO(conversation),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /v1/conversations
   * Lists conversations with cursor pagination.
   */
  public static async listConversations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.developerContext) {
        throw new PermissionDeniedError('Authentication required');
      }

      const limitStr = req.query['limit'] as string | undefined;
      const limit = Math.min(Math.max(1, parseInt(limitStr || '20', 10)), 100);
      const after = req.query['after'] as string | undefined;

      const queryOptions: any = {
        where: {
          userId: req.developerContext.userId,
          deletedAt: null,
        },
        orderBy: { updatedAt: 'desc' },
        take: limit + 1,
      };

      if (after) {
        queryOptions.cursor = { id: after };
        queryOptions.skip = 1;
      }

      const convs = await prisma.conversation.findMany(queryOptions);
      const hasMore = convs.length > limit;
      const items = hasMore ? convs.slice(0, limit) : convs;
      const lastItem = items[items.length - 1];
      const nextCursor = hasMore && lastItem ? lastItem.id : undefined;

      // Record usage
      DeveloperUsageMeteringService.getInstance().recordUsage({
        projectId: req.developerContext.projectId,
        metric: 'API_REQUESTS',
        quantity: 1,
        endpoint: '/v1/conversations',
        environment: req.developerContext.environment,
      }).catch(() => {});

      res.status(200).json({
        data: items.map((c) => PublicConversationController.toPublicConversationDTO(c)),
        has_more: hasMore,
        next_cursor: nextCursor,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /v1/conversations/:id
   * Retrieves single conversation.
   */
  public static async getConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.developerContext) {
        throw new PermissionDeniedError('Authentication required');
      }

      const id = String(req.params['id'] || '');
      const conversation = await prisma.conversation.findUnique({
        where: { id },
      });

      if (!conversation || conversation.userId !== req.developerContext.userId) {
        throw new NotFoundError(`Conversation '${id}' not found`);
      }

      // Record usage
      DeveloperUsageMeteringService.getInstance().recordUsage({
        projectId: req.developerContext.projectId,
        metric: 'API_REQUESTS',
        quantity: 1,
        endpoint: `/v1/conversations/${id}`,
        environment: req.developerContext.environment,
      }).catch(() => {});

      res.status(200).json({
        data: PublicConversationController.toPublicConversationDTO(conversation),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /v1/conversations/:id/messages
   * Posts user message and generates assistant response (JSON or SSE stream).
   */
  public static async createMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.developerContext) {
        throw new PermissionDeniedError('Authentication required');
      }

      const conversationId = String(req.params['id'] || '');
      const { content, stream = false } = req.body;
      const idempotencyKey = (req.headers['idempotency-key'] as string) || req.body.idempotencyKey;

      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        throw new ValidationError('Message content is required');
      }

      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { character: true },
      });

      if (!conversation || conversation.userId !== req.developerContext.userId) {
        throw new NotFoundError(`Conversation '${conversationId}' not found`);
      }

      // Check Idempotency if provided
      if (idempotencyKey) {
        const existingMsg = await prisma.message.findUnique({
          where: { idempotencyKey: String(idempotencyKey) },
        });
        if (existingMsg) {
          res.status(200).json({
            data: PublicConversationController.toPublicMessageDTO(existingMsg),
          });
          return;
        }
      }

      // Persist User Message
      await prisma.message.create({
        data: {
          conversationId,
          role: 'user',
          senderType: 'USER',
          senderId: req.developerContext.userId,
          content: content.trim(),
          status: 'SENT',
          idempotencyKey: idempotencyKey ? String(idempotencyKey) : undefined,
        },
      });

      // Prepare AI Context
      const character = conversation.character;
      const systemPrompt = `You are ${character.name}. ${character.shortDescription || ''} ${character.tagline || ''}. Stay in character.`;

      // Fetch recent messages for context
      const recentMessages = await prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
      const history = recentMessages.reverse().map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      }));

      const isStreamRequested = stream === true || req.headers.accept === 'text/event-stream';

      if (isStreamRequested) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders?.();

        const messageId = `msg_${crypto.randomBytes(12).toString('hex')}`;

        // Send started event
        res.write(`event: message.started\ndata: ${JSON.stringify({
          id: messageId,
          conversation_id: conversationId,
          role: 'assistant',
          created_at: new Date().toISOString(),
        })}\n\n`);

        let assistantContent = '';
        let totalTokens = 0;

        try {
          // Generate response with AI orchestrator
          const aiResponse = await AIOrchestrator.getInstance().generateText({
            systemPrompt,
            messages: history,
            temperature: 0.7,
            maxTokens: 500,
          });

          assistantContent = aiResponse.text;
          totalTokens = aiResponse.usage?.totalTokens || Math.ceil(assistantContent.length / 4);

          // Stream chunks
          const chunkSize = 20;
          for (let i = 0; i < assistantContent.length; i += chunkSize) {
            const chunk = assistantContent.slice(i, i + chunkSize);
            res.write(`event: message.delta\ndata: ${JSON.stringify({
              id: messageId,
              delta: chunk,
            })}\n\n`);
          }

          // Persist assistant message in DB
          const assistantMessage = await prisma.message.create({
            data: {
              conversationId,
              role: 'assistant',
              senderType: 'CHARACTER',
              senderId: character.id,
              content: assistantContent,
              status: 'SENT',
              totalTokens,
            },
          });

          // Send completed event
          res.write(`event: message.completed\ndata: ${JSON.stringify(PublicConversationController.toPublicMessageDTO(assistantMessage))}\n\n`);
          res.end();

          // Usage & Webhook async dispatch
          DeveloperUsageMeteringService.getInstance().recordUsage({
            projectId: req.developerContext.projectId,
            metric: 'AI_TOKENS',
            quantity: totalTokens,
            endpoint: `/v1/conversations/${conversationId}/messages`,
            environment: req.developerContext.environment,
          }).catch(() => {});

          WebhookService.getInstance().dispatchWebhookEvent(
            req.developerContext.projectId,
            'message.completed',
            {
              message_id: assistantMessage.id,
              conversation_id: conversationId,
              content: assistantContent,
              tokens: totalTokens,
            }
          ).catch(() => {});

        } catch (streamErr: any) {
          logger.error(`[PublicAPI] Stream generation error:`, streamErr);
          res.write(`event: message.failed\ndata: ${JSON.stringify({ error: streamErr.message || 'Generation failed' })}\n\n`);
          res.end();
        }
      } else {
        // Non-streaming JSON mode
        const aiResponse = await AIOrchestrator.getInstance().generateText({
          systemPrompt,
          messages: history,
          temperature: 0.7,
          maxTokens: 500,
        });

        const totalTokens = aiResponse.usage?.totalTokens || Math.ceil(aiResponse.text.length / 4);

        const assistantMessage = await prisma.message.create({
          data: {
            conversationId,
            role: 'assistant',
            senderType: 'CHARACTER',
            senderId: character.id,
            content: aiResponse.text,
            status: 'SENT',
            totalTokens,
          },
        });

        // Record metered usage
        DeveloperUsageMeteringService.getInstance().recordUsage({
          projectId: req.developerContext.projectId,
          metric: 'AI_TOKENS',
          quantity: totalTokens,
          endpoint: `/v1/conversations/${conversationId}/messages`,
          environment: req.developerContext.environment,
        }).catch(() => {});

        DeveloperUsageMeteringService.getInstance().recordUsage({
          projectId: req.developerContext.projectId,
          metric: 'API_REQUESTS',
          quantity: 1,
          endpoint: `/v1/conversations/${conversationId}/messages`,
          environment: req.developerContext.environment,
        }).catch(() => {});

        // Dispatch Webhook
        WebhookService.getInstance().dispatchWebhookEvent(
          req.developerContext.projectId,
          'message.completed',
          {
            message_id: assistantMessage.id,
            conversation_id: conversationId,
            content: aiResponse.text,
            tokens: totalTokens,
          }
        ).catch(() => {});

        res.status(200).json({
          data: PublicConversationController.toPublicMessageDTO(assistantMessage),
        });
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /v1/conversations/:id/messages
   * Returns paginated messages for a conversation.
   */
  public static async listMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.developerContext) {
        throw new PermissionDeniedError('Authentication required');
      }

      const conversationId = String(req.params['id'] || '');
      const limitStr = req.query['limit'] as string | undefined;
      const limit = Math.min(Math.max(1, parseInt(limitStr || '50', 10)), 100);
      const after = req.query['after'] as string | undefined;

      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
      });

      if (!conversation || conversation.userId !== req.developerContext.userId) {
        throw new NotFoundError(`Conversation '${conversationId}' not found`);
      }

      const queryOptions: any = {
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
      };

      if (after) {
        queryOptions.cursor = { id: after };
        queryOptions.skip = 1;
      }

      const messages = await prisma.message.findMany(queryOptions);
      const hasMore = messages.length > limit;
      const items = hasMore ? messages.slice(0, limit) : messages;
      const lastItem = items[items.length - 1];
      const nextCursor = hasMore && lastItem ? lastItem.id : undefined;

      // Reverse to chronological order for client display
      const chronological = [...items].reverse();

      res.status(200).json({
        data: chronological.map((m) => PublicConversationController.toPublicMessageDTO(m)),
        has_more: hasMore,
        next_cursor: nextCursor,
      });
    } catch (error) {
      next(error);
    }
  }

  public static toPublicConversationDTO(c: any): PublicConversationDTO {
    return {
      id: c.id,
      characterId: c.characterId,
      title: c.title,
      status: c.status,
      unreadCount: c.unreadCount || 0,
      createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : new Date().toISOString(),
    };
  }

  public static toPublicMessageDTO(m: any): PublicMessageDTO {
    return {
      id: m.id,
      conversationId: m.conversationId,
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
      status: m.status,
      mediaUrl: m.mediaUrl || undefined,
      audioDurationSeconds: m.audioDurationSeconds || undefined,
      createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : new Date().toISOString(),
    };
  }
}
