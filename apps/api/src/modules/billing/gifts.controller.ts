import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../infrastructure/database/prisma.js';
import { ApiResponse } from '../../shared/utils/apiResponse.js';
import { BadRequestError, NotFoundError } from '../../shared/errors/AppError.js';
import { CreditWalletService } from './credits/CreditWalletService.js';
import { limitsEnforced } from './messageAllowance.js';
import { GiftService } from './gifts.service.js';

const sendSchema = z.object({
  giftId: z.string().min(1).max(40),
  clientRequestId: z.string().min(8).max(100),
});

export const GiftsController = {
  /** GET /conversations/:conversationId/gifts — the gifts for this character, their prices and the coin balance. */
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const conversation = await prisma.conversation.findFirst({
        where: { id: String(req.params['conversationId']), userId, deletedAt: null },
        select: { character: { select: { slug: true } } },
      });
      if (!conversation) throw new NotFoundError('Conversation not found');
      const wallet = await CreditWalletService.getWalletSummary(userId).catch(() => null);
      ApiResponse.success(res, {
        gifts: GiftService.catalogFor(conversation.character.slug),
        coins: wallet?.availableBalance ?? 0,
        // Until payments are live, gifts are free (the app hides prices).
        charged: await limitsEnforced(),
      });
    } catch (err) {
      next(err);
    }
  },

  /** POST /conversations/:conversationId/gifts — pay for a gift; the app then sends its message with the same clientRequestId. */
  async send(req: Request, res: Response, next: NextFunction) {
    try {
      const body = sendSchema.safeParse(req.body);
      if (!body.success) throw new BadRequestError('Invalid gift request');
      const result = await GiftService.send({ userId: req.user!.userId, conversationId: String(req.params['conversationId']), ...body.data });
      ApiResponse.success(res, result);
    } catch (err) {
      next(err);
    }
  },
};
