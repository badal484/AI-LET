import { Router } from 'express';
import { BillingController } from '../controllers/billing.controller.js';
import { authenticateUser, optionalAuth } from '../../../shared/middleware/auth.middleware.js';
import { validateBody } from '../../../shared/middleware/validateRequest.js';
import {
  verifyPurchaseSchema,
  restorePurchasesSchema,
  changeSubscriptionSchema,
  cancelSubscriptionSchema,
  redeemPromotionSchema,
} from '@ai-companion/validation';

export const billingRouter: Router = Router();

// Public / Optional auth
billingRouter.get('/plans', BillingController.getPlans);
billingRouter.get('/paywall/config', optionalAuth, BillingController.getPaywallConfig);

// Webhooks (authoritative asynchronous payment provider updates)
billingRouter.post('/webhooks/:provider', BillingController.handleWebhook);

// Authenticated User Endpoints
billingRouter.use(authenticateUser);

billingRouter.get('/me', BillingController.getSubscription);
billingRouter.get('/entitlements', BillingController.getEntitlements);
billingRouter.get('/usage', BillingController.getUsage);
billingRouter.get('/credits', BillingController.getCredits);
billingRouter.get('/credits/transactions', BillingController.getCreditTransactions);

billingRouter.post(
  '/purchases/verify',
  validateBody(verifyPurchaseSchema),
  BillingController.verifyPurchase
);

billingRouter.post(
  '/purchases/restore',
  validateBody(restorePurchasesSchema),
  BillingController.restorePurchases
);

billingRouter.post(
  '/subscriptions/change',
  validateBody(changeSubscriptionSchema),
  BillingController.changeSubscription
);

billingRouter.post(
  '/subscriptions/cancel',
  validateBody(cancelSubscriptionSchema),
  BillingController.cancelSubscription
);

billingRouter.post('/subscriptions/resume', BillingController.resumeSubscription);

billingRouter.post(
  '/promotions/redeem',
  validateBody(redeemPromotionSchema),
  BillingController.redeemPromotion
);
