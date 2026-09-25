import { api } from './client.js';
import {
  BillingPlan,
  BillingSubscription,
  CreditTransactionItem,
  CreditWalletSummary,
  EffectiveEntitlementsResponse,
  PaywallConfig,
  PurchaseVerificationResponse,
  UsageMeterItem,
} from '@ai-companion/types';

export interface UserBillingState {
  subscription: BillingSubscription | null;
  entitlements: EffectiveEntitlementsResponse | null;
  usageMeters: UsageMeterItem[];
  creditWallet: CreditWalletSummary | null;
}

/** Mirrors the server's `verifyPurchaseSchema`: a real store receipt is always required. */
export interface VerifyPurchaseInput {
  provider: 'apple' | 'google' | 'stripe';
  productId: string;
  receiptData: string;
  transactionId?: string;
  planCode?: string;
  idempotencyKey: string;
}

export interface RestorePurchasesInput {
  provider: 'apple' | 'google' | 'stripe';
  receiptData: string;
  deviceAccountId?: string;
}

export const billingApi = {
  async getPaywallConfig(): Promise<PaywallConfig> {
    const response = await api.get('/billing/paywall/config');
    return response.data.data;
  },

  async getPlans(): Promise<BillingPlan[]> {
    const response = await api.get('/billing/plans');
    return response.data.data;
  },

  /** The server exposes subscription, entitlements, usage and wallet as separate resources. */
  async getMyBillingState(): Promise<UserBillingState> {
    const [subscription, entitlements, usageMeters, creditWallet] = await Promise.all([
      api.get('/billing/me').then(r => r.data.data as BillingSubscription | null),
      api.get('/billing/entitlements').then(r => r.data.data as EffectiveEntitlementsResponse),
      api.get('/billing/usage').then(r => (r.data.data ?? []) as UsageMeterItem[]),
      api.get('/billing/credits').then(r => r.data.data as CreditWalletSummary),
    ]);
    return { subscription: subscription ?? null, entitlements, usageMeters, creditWallet };
  },

  async getMyEntitlements(): Promise<EffectiveEntitlementsResponse> {
    const response = await api.get('/billing/entitlements');
    return response.data.data;
  },

  async getMyUsage(): Promise<UsageMeterItem[]> {
    const response = await api.get('/billing/usage');
    return response.data.data;
  },

  async getMyTransactions(): Promise<CreditTransactionItem[]> {
    const response = await api.get('/billing/credits/transactions');
    return response.data.data;
  },

  async verifyPurchase(payload: VerifyPurchaseInput): Promise<PurchaseVerificationResponse> {
    const response = await api.post('/billing/purchases/verify', payload, {
      headers: { 'Idempotency-Key': payload.idempotencyKey },
    });
    return response.data.data;
  },

  async restorePurchases(payload: RestorePurchasesInput): Promise<{
    restoredCount: number;
    activeSubscription?: BillingSubscription;
    entitlements: string[];
  }> {
    const response = await api.post('/billing/purchases/restore', payload);
    return response.data.data;
  },

  async changeSubscription(payload: {
    planCode: string;
    billingInterval?: 'month' | 'year' | 'one_time';
    provider: 'apple' | 'google' | 'stripe';
  }): Promise<BillingSubscription> {
    const response = await api.post('/billing/subscriptions/change', payload);
    return response.data.data;
  },

  async cancelSubscription(payload?: { cancelImmediately?: boolean; reason?: string }): Promise<BillingSubscription> {
    const response = await api.post('/billing/subscriptions/cancel', payload || {});
    return response.data.data;
  },

  async resumeSubscription(): Promise<BillingSubscription> {
    const response = await api.post('/billing/subscriptions/resume', {});
    return response.data.data;
  },

  async getCreditWallet(): Promise<{ wallet: CreditWalletSummary; recentTransactions: CreditTransactionItem[] }> {
    const [wallet, recentTransactions] = await Promise.all([
      api.get('/billing/credits').then(r => r.data.data as CreditWalletSummary),
      api.get('/billing/credits/transactions').then(r => (r.data.data ?? []) as CreditTransactionItem[]),
    ]);
    return { wallet, recentTransactions };
  },

  async redeemPromotion(promoCode: string): Promise<{
    redemption: any;
    bonusCredits?: number;
  }> {
    const response = await api.post('/billing/promotions/redeem', { promoCode });
    return response.data.data;
  },
};
