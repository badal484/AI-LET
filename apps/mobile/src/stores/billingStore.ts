import { create } from 'zustand';
import {
  BillingPlan,
  BillingSubscription,
  CreditTransactionItem,
  CreditWalletSummary,
  PaywallConfig,
  EffectiveEntitlementsResponse,
  UsageMeterItem,
} from '@ai-companion/types';
import { billingApi, VerifyPurchaseInput } from '../services/api/billingApi.js';
import { StoreBilling } from '../services/storeBilling.js';

export type PurchaseFlowState = 'idle' | 'purchasing' | 'verifying' | 'active' | 'restoring' | 'failed';

interface BillingState {
  // State
  paywallConfig: PaywallConfig | null;
  plans: BillingPlan[];
  subscription: BillingSubscription | null;
  entitlements: EffectiveEntitlementsResponse | null;
  usageMeters: UsageMeterItem[];
  creditWallet: CreditWalletSummary | null;
  recentCreditTransactions: CreditTransactionItem[];
  recentPurchases: any[];

  isLoading: boolean;
  purchaseState: PurchaseFlowState;
  errorMessage: string | null;

  // Actions
  loadBillingState: () => Promise<void>;
  loadPaywallConfig: () => Promise<void>;
  loadPlans: () => Promise<void>;
  loadCredits: () => Promise<void>;
  verifyPurchase: (payload: VerifyPurchaseInput) => Promise<boolean>;
  restorePurchases: () => Promise<number>;
  cancelSubscription: (cancelImmediately?: boolean, reason?: string) => Promise<boolean>;
  resumeSubscription: () => Promise<boolean>;
  redeemPromoCode: (code: string) => Promise<{ success: boolean; message: string }>;
  purchaseCreditPack: (priceId: string) => Promise<boolean>;
  hasEntitlement: (key: string) => boolean;
  getUsageMeter: (metricUnit: string) => UsageMeterItem | undefined;
  resetPurchaseState: () => void;
}

export const useBillingStore = create<BillingState>((set, get) => ({
  paywallConfig: null,
  plans: [],
  subscription: null,
  entitlements: null,
  usageMeters: [],
  creditWallet: null,
  recentCreditTransactions: [],
  recentPurchases: [],

  isLoading: false,
  purchaseState: 'idle',
  errorMessage: null,

  loadBillingState: async () => {
    try {
      set({ isLoading: true, errorMessage: null });
      const [billingState, plans] = await Promise.all([
        billingApi.getMyBillingState(),
        billingApi.getPlans(),
      ]);

      set({
        subscription: billingState.subscription,
        entitlements: billingState.entitlements,
        usageMeters: billingState.usageMeters,
        creditWallet: billingState.creditWallet,
        plans,
        isLoading: false,
      });
    } catch (err: any) {
      set({
        isLoading: false,
        errorMessage: err?.message || 'Failed to load subscription status.',
      });
    }
  },

  loadPaywallConfig: async () => {
    try {
      const config = await billingApi.getPaywallConfig();
      set({ paywallConfig: config });
    } catch (err: any) {
      console.warn('Failed to load paywall config', err);
    }
  },

  loadPlans: async () => {
    try {
      const plans = await billingApi.getPlans();
      set({ plans });
    } catch (err: any) {
      console.warn('Failed to load billing plans', err);
    }
  },

  loadCredits: async () => {
    try {
      const { wallet, recentTransactions } = await billingApi.getCreditWallet();
      set({ creditWallet: wallet, recentCreditTransactions: recentTransactions });
    } catch (err: any) {
      console.warn('Failed to load credit wallet', err);
    }
  },

  verifyPurchase: async (payload: VerifyPurchaseInput) => {
    set({ purchaseState: 'verifying', errorMessage: null });
    try {
      const res = await billingApi.verifyPurchase(payload);
      if (res.subscription) {
        set({
          subscription: res.subscription,
          purchaseState: 'active',
        });
      } else {
        set({
          purchaseState: 'active',
        });
      }

      // Refresh full billing state in background
      get().loadBillingState();
      return true;
    } catch (err: any) {
      set({
        purchaseState: 'failed',
        errorMessage: err?.message || 'Unable to verify purchase with server. Please try restoring purchases.',
      });
      return false;
    }
  },

  restorePurchases: async () => {
    // Restoring needs the store's receipt; without native store billing there is nothing to send.
    if (!StoreBilling.isAvailable) {
      set({ purchaseState: 'failed', errorMessage: StoreBilling.unavailableMessage });
      return 0;
    }
    set({ purchaseState: 'restoring', errorMessage: null });
    await get().loadBillingState();
    set({ purchaseState: 'idle' });
    return 0;
  },

  cancelSubscription: async (cancelImmediately = false, reason?: string) => {
    try {
      set({ isLoading: true, errorMessage: null });
      const subscription = await billingApi.cancelSubscription({ cancelImmediately, reason });
      set({ subscription, isLoading: false });
      await get().loadBillingState();
      return true;
    } catch (err: any) {
      set({
        isLoading: false,
        errorMessage: err?.message || 'Failed to cancel subscription.',
      });
      return false;
    }
  },

  resumeSubscription: async () => {
    try {
      set({ isLoading: true, errorMessage: null });
      const subscription = await billingApi.resumeSubscription();
      set({ subscription, isLoading: false });
      await get().loadBillingState();
      return true;
    } catch (err: any) {
      set({
        isLoading: false,
        errorMessage: err?.message || 'Failed to resume subscription.',
      });
      return false;
    }
  },

  redeemPromoCode: async (code: string) => {
    try {
      set({ isLoading: true, errorMessage: null });
      const res = await billingApi.redeemPromotion(code);
      await get().loadBillingState();
      await get().loadCredits();
      set({ isLoading: false });

      if (res.bonusCredits) {
        return { success: true, message: `Successfully redeemed! Added ${res.bonusCredits} AI credits.` };
      }
      return { success: true, message: 'Promotion successfully applied!' };
    } catch (err: any) {
      set({ isLoading: false });
      return { success: false, message: err?.message || 'Invalid or expired promo code.' };
    }
  },

  purchaseCreditPack: async (_priceId: string) => {
    // Credit packs are sold through the app stores; there is no server-side card flow to call.
    set({ purchaseState: 'failed', errorMessage: StoreBilling.unavailableMessage });
    return false;
  },

  hasEntitlement: (key: string) => {
    const effective = get().entitlements;
    if (!effective?.entitlements[key]) return false;
    if (effective.expiresAt && new Date(effective.expiresAt) < new Date()) return false;
    return true;
  },

  getUsageMeter: (metricUnit: string) => {
    return get().usageMeters.find(m => m.meterUnit === metricUnit);
  },

  resetPurchaseState: () => {
    set({ purchaseState: 'idle', errorMessage: null });
  },
}));
