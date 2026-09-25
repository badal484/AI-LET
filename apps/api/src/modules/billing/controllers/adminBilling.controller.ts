import { Request, Response, NextFunction } from 'express';
import { BillingAnalyticsService } from '../services/BillingAnalyticsService.js';
import { PlanService } from '../services/PlanService.js';
import { PromotionService } from '../services/PromotionService.js';
import { EntitlementService } from '../entitlements/EntitlementService.js';
import { CreditWalletService } from '../credits/CreditWalletService.js';
import { BillingAuditService } from '../services/BillingAuditService.js';
import { ReconciliationService } from '../services/ReconciliationService.js';
import { WebhookIngestionService } from '../webhooks/WebhookIngestionService.js';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { NotFoundError, BadRequestError } from '../../../shared/errors/AppError.js';

export class AdminBillingController {
  public static async getOverview(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const overview = await BillingAnalyticsService.getAdminOverview();
      res.json({ success: true, data: overview });
    } catch (err) {
      next(err);
    }
  }

  public static async listPlansAndPrices(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const products = await PlanService.listAllAdmin();
      res.json({ success: true, data: products });
    } catch (err) {
      next(err);
    }
  }

  public static async createPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plan = await PlanService.createPlan(req.body);
      await BillingAuditService.logAction({
        adminUserId: req.admin?.adminId,
        action: 'PLAN_CREATED',
        targetType: 'PLAN',
        targetId: plan.id,
        afterState: plan as any,
        ipAddress: req.ip,
      });
      res.status(201).json({ success: true, data: plan });
    } catch (err) {
      next(err);
    }
  }

  public static async updatePlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const planId = req.params['id'] as string;
      const existing = await prisma.billingPlan.findUnique({ where: { id: planId } });
      if (!existing) {
        throw new NotFoundError(`Plan '${planId}' not found`);
      }

      const updated = await prisma.billingPlan.update({
        where: { id: planId },
        data: {
          name: req.body.name,
          tagline: req.body.tagline,
          description: req.body.description,
          isActive: req.body.isActive,
          isPopular: req.body.isPopular,
          trialDays: req.body.trialDays,
        },
      });

      await BillingAuditService.logAction({
        adminUserId: req.admin?.adminId,
        action: 'PLAN_UPDATED',
        targetType: 'PLAN',
        targetId: planId,
        beforeState: existing as any,
        afterState: updated as any,
        ipAddress: req.ip,
      });

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  public static async createPrice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const price = await PlanService.createPrice(req.body);
      await BillingAuditService.logAction({
        adminUserId: req.admin?.adminId,
        action: 'PRICE_CREATED',
        targetType: 'PRICE',
        targetId: price.id,
        afterState: price as any,
        ipAddress: req.ip,
      });
      res.status(201).json({ success: true, data: price });
    } catch (err) {
      next(err);
    }
  }

  public static async listPromotions(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const promos = await PromotionService.listPromotionsAdmin();
      res.json({ success: true, data: promos });
    } catch (err) {
      next(err);
    }
  }

  public static async createPromotion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const promo = await PromotionService.createPromotion(req.body);
      await BillingAuditService.logAction({
        adminUserId: req.admin?.adminId,
        action: 'PROMOTION_CREATED',
        targetType: 'PROMOTION',
        targetId: promo.id,
        afterState: promo as any,
        ipAddress: req.ip,
      });
      res.status(201).json({ success: true, data: promo });
    } catch (err) {
      next(err);
    }
  }

  public static async grantManualEntitlement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId, entitlementKey, durationDays, reason } = req.body;
      const entitlement = await EntitlementService.grantManualEntitlement(
        userId,
        entitlementKey,
        reason,
        durationDays,
        req.admin?.adminId
      );

      await BillingAuditService.logAction({
        adminUserId: req.admin?.adminId,
        action: 'ENTITLEMENT_GRANTED',
        targetType: 'USER_ENTITLEMENT',
        targetId: entitlement.id,
        afterState: entitlement as any,
        reason,
        ipAddress: req.ip,
      });

      res.json({ success: true, data: entitlement });
    } catch (err) {
      next(err);
    }
  }

  public static async grantManualCredits(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId, amount, reason, durationDays } = req.body;
      const expiresAt = durationDays ? new Date(Date.now() + durationDays * 86400000) : undefined;
      const idempotencyKey = `admin_grant_${userId}_${Date.now()}`;

      const transaction = await CreditWalletService.grantCredits({
        userId,
        amount,
        type: 'GRANT',
        idempotencyKey,
        description: `Admin Grant: ${reason}`,
        referenceType: 'ADMIN_GRANT',
        referenceId: req.admin?.adminId,
        expiresAt,
      });

      await BillingAuditService.logAction({
        adminUserId: req.admin?.adminId,
        action: 'CREDITS_GRANTED',
        targetType: 'CREDIT_TRANSACTION',
        targetId: transaction.id,
        afterState: transaction as any,
        reason,
        ipAddress: req.ip,
      });

      res.json({ success: true, data: transaction });
    } catch (err) {
      next(err);
    }
  }

  public static async processRefund(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { transactionId, reason, revokeEntitlements, reverseCredits } = req.body;
      const tx = await prisma.purchaseTransaction.findUnique({
        where: { id: transactionId },
        include: { subscription: true },
      });

      if (!tx) {
        throw new NotFoundError(`Transaction '${transactionId}' not found`);
      }

      if (tx.status === 'REFUNDED') {
        throw new BadRequestError(`Transaction '${transactionId}' has already been refunded`);
      }

      const updated = await prisma.purchaseTransaction.update({
        where: { id: transactionId },
        data: {
          status: 'REFUNDED',
          refundReason: reason,
          refundedAt: new Date(),
        },
      });

      if (revokeEntitlements && tx.subscriptionId) {
        await prisma.billingSubscription.update({
          where: { id: tx.subscriptionId },
          data: { status: 'CANCELLED', endedAt: new Date() },
        });
        await EntitlementService.invalidateUserEntitlementsCache(tx.userId);
      }

      if (reverseCredits && tx.productId.toLowerCase().includes('credit')) {
        await CreditWalletService.refundTransaction(tx.id, reason).catch(() => {});
      }

      await BillingAuditService.logAction({
        adminUserId: req.admin?.adminId,
        action: 'REFUND_PROCESSED',
        targetType: 'TRANSACTION',
        targetId: transactionId,
        beforeState: tx as any,
        afterState: updated as any,
        reason,
        ipAddress: req.ip,
      });

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  public static async listAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : 50;
      const logs = await BillingAuditService.listAuditLogsAdmin(limit);
      res.json({ success: true, data: logs });
    } catch (err) {
      next(err);
    }
  }

  public static async listSubscriptions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = Math.max(1, parseInt(String(req.query['page'] ?? '1'), 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? '20'), 10) || 20));
      const status = typeof req.query['status'] === 'string' ? req.query['status'].toUpperCase() : undefined;
      const planCode = typeof req.query['planCode'] === 'string' ? req.query['planCode'] : undefined;
      const where = {
        ...(status ? { status: status as never } : {}),
        ...(planCode ? { plan: { code: planCode } } : {}),
      };
      const [items, total] = await Promise.all([
        prisma.billingSubscription.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: { plan: { select: { code: true, name: true } }, user: { select: { id: true, email: true } } },
        }),
        prisma.billingSubscription.count({ where }),
      ]);
      res.json({ success: true, data: { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } } });
    } catch (err) {
      next(err);
    }
  }

  public static async listWebhooks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = Math.max(1, parseInt(String(req.query['page'] ?? '1'), 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? '20'), 10) || 20));
      const status = typeof req.query['status'] === 'string' ? req.query['status'].toUpperCase() : undefined;
      const where = status ? { status: status as never } : {};
      const [rows, total] = await Promise.all([
        prisma.billingWebhookEvent.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          // Payload and signature stay server-side.
          select: { id: true, provider: true, providerEventId: true, eventType: true, status: true, retryCount: true, failureReason: true, createdAt: true, processedAt: true },
        }),
        prisma.billingWebhookEvent.count({ where }),
      ]);
      res.json({
        success: true,
        data: {
          items: rows.map(({ createdAt, ...r }) => ({ ...r, receivedAt: createdAt })),
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        },
      });
    } catch (err) {
      next(err);
    }
  }

  public static async runReconciliation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const subs = await ReconciliationService.reconcileSubscriptions();
      const wallets = await ReconciliationService.reconcileCreditWallets();
      const result = {
        checkedCount: subs.checkedCount + wallets.checkedCount,
        mismatchesFound: subs.mismatchCount,
        reconciledCount: wallets.correctedCount,
      };
      await BillingAuditService.logAction({
        adminUserId: req.admin?.adminId,
        action: 'RECONCILIATION_RUN',
        targetType: 'BILLING_RECONCILIATION',
        targetId: 'manual',
        afterState: result as any,
        reason: 'Manual reconciliation run from admin console',
        ipAddress: req.ip,
      });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  public static async revokeManualEntitlement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId, entitlementKey, reason } = req.body ?? {};
      if (typeof userId !== 'string' || typeof entitlementKey !== 'string' || typeof reason !== 'string' || reason.trim().length < 3) {
        throw new BadRequestError('userId, entitlementKey and a reason are required');
      }
      await EntitlementService.revokeEntitlement(userId, entitlementKey, reason, req.admin?.adminId);
      await BillingAuditService.logAction({
        adminUserId: req.admin?.adminId,
        action: 'ENTITLEMENT_REVOKED',
        targetType: 'USER_ENTITLEMENT',
        targetId: `${userId}:${entitlementKey}`,
        reason,
        ipAddress: req.ip,
      });
      res.json({ success: true, data: { userId, entitlementKey, revoked: true } });
    } catch (err) {
      next(err);
    }
  }

  public static async listReconciliations(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const records = await ReconciliationService.listReconciliationsAdmin();
      res.json({ success: true, data: records });
    } catch (err) {
      next(err);
    }
  }

  public static async resolveMismatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params['id'] as string;
      const { reason } = req.body;
      const resolved = await ReconciliationService.resolveMismatchAdmin(id, reason, req.admin?.adminId);
      res.json({ success: true, data: resolved });
    } catch (err) {
      next(err);
    }
  }

  public static async retryWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { webhookEventId } = req.body;
      const result = await WebhookIngestionService.retryWebhook(webhookEventId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  public static async runSimulator(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { simulatedPlanCode, simulatedPromoCode, simulatedUsage } = req.body;
      const plan = await prisma.billingPlan.findUnique({
        where: { code: simulatedPlanCode.toUpperCase() },
        include: { entitlements: true, usageLimits: true },
      });

      const entitlementsMap: Record<string, boolean> = {
        chat_basic: true,
      };

      if (plan) {
        for (const ent of plan.entitlements) {
          entitlementsMap[ent.entitlementKey] = true;
        }
      }

      const usageAssessment = Object.entries(simulatedUsage || {}).map(([unit, amount]) => {
        const limitConfig = plan?.usageLimits.find((l) => l.meterUnit === unit);
        const limit = limitConfig ? limitConfig.limitAmount : 1000;
        const requested = Number(amount);
        const allowed = requested <= limit;
        return {
          meterUnit: unit,
          simulatedAmount: requested,
          limitAmount: limit,
          remainingAfter: Math.max(0, limit - requested),
          allowed,
        };
      });

      res.json({
        success: true,
        data: {
          simulatedPlan: plan ? { code: plan.code, name: plan.name } : null,
          simulatedPromoCode,
          effectiveEntitlements: entitlementsMap,
          activeEntitlementsCount: Object.keys(entitlementsMap).length,
          usageAssessment,
          isSimulationOnly: true,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
