import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { BadRequestError } from '../../../shared/errors/AppError.js';
import { cancelPremium, confirm, handleWebhook, razorpayClientConfig, startCoinPack, startPremium } from './razorpay.service.js';

const token = z.string().min(1).max(4000).optional();
const startPremiumBody = z.object({ googleToken: token });
const startCoinsBody = z.object({ packId: z.string().max(40), googleToken: token });
const confirmBody = z.object({
  kind: z.enum(['premium', 'coins']),
  paymentId: z.string().regex(/^pay_[A-Za-z0-9]+$/),
  signature: z.string().max(200),
  subscriptionId: z.string().regex(/^sub_[A-Za-z0-9]+$/).optional(),
  orderId: z.string().regex(/^order_[A-Za-z0-9]+$/).optional(),
});

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const r = schema.safeParse(body ?? {});
  if (!r.success) throw new BadRequestError('Invalid request.');
  return r.data;
}

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res)
      .then((data) => res.json({ success: true, data }))
      .catch(next);

export const RazorpayController = {
  config: wrap(async (req) => razorpayClientConfig(req.user?.userId)),
  startPremium: wrap(async (req) => startPremium(req.user!.userId, parse(startPremiumBody, req.body))),
  startCoins: wrap(async (req) => {
    const b = parse(startCoinsBody, req.body);
    return startCoinPack(req.user!.userId, b.packId, { googleToken: b.googleToken });
  }),
  confirm: wrap(async (req) => confirm(req.user!.userId, parse(confirmBody, req.body))),
  cancel: wrap(async (req) => cancelPremium(req.user!.userId)),
  /** Razorpay → us. Signed over the raw body (kept by the JSON parser for this path). */
  webhook: wrap(async (req) =>
    handleWebhook(
      (req as Request & { rawBody?: string }).rawBody ?? '',
      req.headers['x-razorpay-signature'] as string | undefined,
      req.headers['x-razorpay-event-id'] as string | undefined,
    ),
  ),
};
