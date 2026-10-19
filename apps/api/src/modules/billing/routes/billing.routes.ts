import { Router } from 'express';
import { BillingController } from '../controllers/billing.controller.js';
import { RazorpayController } from '../razorpay/razorpay.controller.js';
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
billingRouter.get('/razorpay/config', optionalAuth, RazorpayController.config);

// Webhooks (authoritative asynchronous payment provider updates)
billingRouter.post('/webhooks/razorpay', RazorpayController.webhook);
billingRouter.post('/webhooks/:provider', BillingController.handleWebhook);

// Authenticated User Endpoints
billingRouter.use(authenticateUser);

billingRouter.get('/me', BillingController.getSubscription);
billingRouter.get('/entitlements', BillingController.getEntitlements);
billingRouter.get('/usage', BillingController.getUsage);
billingRouter.get('/allowance', BillingController.getAllowance);

// Razorpay (UPI Autopay / cards), offered next to Google Play through user choice billing.
billingRouter.post('/razorpay/premium', RazorpayController.startPremium);
billingRouter.post('/razorpay/coins', RazorpayController.startCoins);
billingRouter.post('/razorpay/confirm', RazorpayController.confirm);
billingRouter.post('/razorpay/cancel', RazorpayController.cancel);
billingRouter.get('/play-account', BillingController.getPlayAccount);
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
