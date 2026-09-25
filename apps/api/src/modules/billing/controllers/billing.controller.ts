import { Request, Response, NextFunction } from 'express';
import { PlanService } from '../services/PlanService.js';
import { EntitlementService } from '../entitlements/EntitlementService.js';
import { UsageMeterService } from '../usage/UsageMeterService.js';
import { SubscriptionService } from '../services/SubscriptionService.js';
import { PurchaseService } from '../services/PurchaseService.js';
import { CreditWalletService } from '../credits/CreditWalletService.js';
import { PromotionService } from '../services/PromotionService.js';
import { WebhookIngestionService } from '../webhooks/WebhookIngestionService.js';
import { BillingProviderType } from '@ai-companion/types';

export class BillingController {
  public static async getPlans(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plans = await PlanService.getActivePlans();
      res.json({ success: true, data: plans });
    } catch (err) {
      next(err);
    }
  }

  public static async getPaywallConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const config = await PlanService.getPaywallConfig(req.user?.userId);
      res.json({ success: true, data: config });
    } catch (err) {
      next(err);
    }
  }

  public static async getEntitlements(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const effective = await EntitlementService.getEffectiveEntitlements(userId);
      res.json({ success: true, data: effective });
    } catch (err) {
      next(err);
    }
  }

  public static async getUsage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const meters = await UsageMeterService.getUserUsageMeters(userId);
      res.json({ success: true, data: meters });
    } catch (err) {
      next(err);
    }
  }

  public static async getSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const subscription = await SubscriptionService.getUserSubscription(userId);
      res.json({ success: true, data: subscription });
    } catch (err) {
      next(err);
    }
  }

  public static async getCredits(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const summary = await CreditWalletService.getWalletSummary(userId);
      res.json({ success: true, data: summary });
    } catch (err) {
      next(err);
    }
  }

  public static async getCreditTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : 20;
      const cursor = req.query['cursor'] as string | undefined;
      const result = await CreditWalletService.getTransactionHistory(userId, limit, cursor);
      res.json({ success: true, data: result.items, nextCursor: result.nextCursor });
    } catch (err) {
      next(err);
    }
  }

  public static async verifyPurchase(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const idempotencyKey = (req.headers['x-idempotency-key'] as string) || req.body.idempotencyKey;
      const result = await PurchaseService.verifyPurchase(userId, {
        ...req.body,
        idempotencyKey,
      });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  public static async restorePurchases(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { provider, receiptData } = req.body;
      const result = await PurchaseService.restorePurchases(userId, provider, receiptData);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  public static async changeSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const result = await SubscriptionService.changeSubscription({
        userId,
        planCode: req.body.planCode,
        billingInterval: req.body.billingInterval || 'month',
        provider: req.body.provider || 'mock',
      });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  public static async cancelSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { cancelImmediately, reason } = req.body;
      const result = await SubscriptionService.cancelSubscription(userId, cancelImmediately, reason);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  public static async resumeSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const result = await SubscriptionService.resumeSubscription(userId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  public static async redeemPromotion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { promoCode } = req.body;
      const result = await PromotionService.redeemPromotion(userId, promoCode);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  public static async handleWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const provider = (req.params['provider'] || 'mock') as BillingProviderType;
      const signature = (req.headers['stripe-signature'] || req.headers['x-apple-signature']) as string;
      const rawBody = req.body;

      const result = await WebhookIngestionService.ingestWebhook({
        provider,
        rawBody: typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody),
        signature,
        headers: req.headers,
      });

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}
