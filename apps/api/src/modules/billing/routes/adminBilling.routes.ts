import { Router } from 'express';
import { AdminBillingController } from '../controllers/adminBilling.controller.js';
import {
  authenticateAdmin,
  requirePermission,
} from '../../../shared/middleware/adminAuth.middleware.js';
import { validateBody } from '../../../shared/middleware/validateRequest.js';
import { ADMIN_PERMISSIONS } from '@ai-companion/config';
import {
  adminCreatePlanSchema,
  adminUpdatePlanSchema,
  adminCreatePriceSchema,
  adminCreatePromotionSchema,
  adminManualEntitlementGrantSchema,
  adminManualCreditGrantSchema,
  adminProcessRefundSchema,
  adminWebhookRetrySchema,
  adminBillingSimulatorSchema,
} from '@ai-companion/validation';

export const adminBillingRouter: Router = Router();

// Guard all admin billing routes with Admin Authentication
adminBillingRouter.use(authenticateAdmin);

// Overview & Analytics
adminBillingRouter.get(
  '/overview',
  requirePermission(ADMIN_PERMISSIONS.BILLING_READ),
  AdminBillingController.getOverview
);

// Plans & Prices
adminBillingRouter.get(
  '/plans',
  requirePermission(ADMIN_PERMISSIONS.BILLING_PLANS_READ),
  AdminBillingController.listPlansAndPrices
);

adminBillingRouter.post(
  '/plans',
  requirePermission(ADMIN_PERMISSIONS.BILLING_PLANS_WRITE),
  validateBody(adminCreatePlanSchema),
  AdminBillingController.createPlan
);

adminBillingRouter.put(
  '/plans/:id',
  requirePermission(ADMIN_PERMISSIONS.BILLING_PLANS_WRITE),
  validateBody(adminUpdatePlanSchema),
  AdminBillingController.updatePlan
);

adminBillingRouter.post(
  '/prices',
  requirePermission(ADMIN_PERMISSIONS.BILLING_PLANS_WRITE),
  validateBody(adminCreatePriceSchema),
  AdminBillingController.createPrice
);

// Promotions
adminBillingRouter.get(
  '/promotions',
  requirePermission(ADMIN_PERMISSIONS.BILLING_READ),
  AdminBillingController.listPromotions
);

adminBillingRouter.post(
  '/promotions',
  requirePermission(ADMIN_PERMISSIONS.BILLING_PROMOTIONS_WRITE),
  validateBody(adminCreatePromotionSchema),
  AdminBillingController.createPromotion
);

// Manual Grants & Financial Mutations
adminBillingRouter.post(
  '/entitlements/grant',
  requirePermission(ADMIN_PERMISSIONS.BILLING_WRITE),
  validateBody(adminManualEntitlementGrantSchema),
  AdminBillingController.grantManualEntitlement
);

adminBillingRouter.post(
  '/credits/grant',
  requirePermission(ADMIN_PERMISSIONS.BILLING_CREDITS_GRANT),
  validateBody(adminManualCreditGrantSchema),
  AdminBillingController.grantManualCredits
);

adminBillingRouter.post(
  '/refunds',
  requirePermission(ADMIN_PERMISSIONS.BILLING_REFUNDS_WRITE),
  validateBody(adminProcessRefundSchema),
  AdminBillingController.processRefund
);

// Audit & Reconciliation
adminBillingRouter.get(
  '/audit',
  requirePermission(ADMIN_PERMISSIONS.BILLING_AUDIT_READ),
  AdminBillingController.listAuditLogs
);

adminBillingRouter.get(
  '/reconciliation',
  requirePermission(ADMIN_PERMISSIONS.BILLING_READ),
  AdminBillingController.listReconciliations
);

adminBillingRouter.post(
  '/reconciliation/:id/resolve',
  requirePermission(ADMIN_PERMISSIONS.BILLING_RECONCILIATION_WRITE),
  AdminBillingController.resolveMismatch
);

adminBillingRouter.post(
  '/reconciliation/run',
  requirePermission(ADMIN_PERMISSIONS.BILLING_RECONCILIATION_WRITE),
  AdminBillingController.runReconciliation
);

adminBillingRouter.post(
  '/entitlements/revoke',
  requirePermission(ADMIN_PERMISSIONS.BILLING_WRITE),
  AdminBillingController.revokeManualEntitlement
);

adminBillingRouter.get(
  '/subscriptions',
  requirePermission(ADMIN_PERMISSIONS.BILLING_SUBSCRIPTIONS_READ),
  AdminBillingController.listSubscriptions
);

adminBillingRouter.get(
  '/webhooks',
  requirePermission(ADMIN_PERMISSIONS.BILLING_WEBHOOKS_READ),
  AdminBillingController.listWebhooks
);

// Webhook Retry
adminBillingRouter.post(
  '/webhooks/retry',
  requirePermission(ADMIN_PERMISSIONS.BILLING_WEBHOOKS_RETRY),
  validateBody(adminWebhookRetrySchema),
  AdminBillingController.retryWebhook
);

// Billing Simulator
adminBillingRouter.post(
  '/simulator',
  requirePermission(ADMIN_PERMISSIONS.BILLING_READ),
  validateBody(adminBillingSimulatorSchema),
  AdminBillingController.runSimulator
);
