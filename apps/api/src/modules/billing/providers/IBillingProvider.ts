import {
  BillingProviderType,
  PriceCurrency,
  SubscriptionStatus,
  PaymentStatus,
} from '@ai-companion/types';

export interface VerifiedPurchaseResult {
  isValid: boolean;
  provider: BillingProviderType;
  providerTransactionId: string;
  providerSubscriptionId?: string;
  productId: string;
  planCode?: string;
  currency: PriceCurrency;
  amountMinorUnits: number;
  paymentStatus: PaymentStatus;
  subscriptionStatus?: SubscriptionStatus;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  trialStart?: Date;
  trialEnd?: Date;
  rawPayload: Record<string, unknown>;
  errorMessage?: string;
}

export interface RestoredPurchaseItem {
  productId: string;
  transactionId: string;
  subscriptionId?: string;
  status: SubscriptionStatus;
  currentPeriodEnd: Date;
}

export interface WebhookEventPayload {
  eventId: string;
  eventType: string;
  provider: BillingProviderType;
  rawBody: string | Buffer;
  signature?: string;
  headers?: Record<string, string | string[] | undefined>;
}

export interface ParsedWebhookResult {
  isValidSignature: boolean;
  providerEventId: string;
  eventType: string;
  providerTransactionId?: string;
  providerSubscriptionId?: string;
  subscriptionStatus?: SubscriptionStatus;
  paymentStatus?: PaymentStatus;
  currentPeriodEnd?: Date;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface IBillingProvider {
  readonly providerType: BillingProviderType;

  verifyPurchase(params: {
    receiptData: string;
    productId: string;
    transactionId: string;
    planCode?: string;
    currency?: PriceCurrency;
    priceAmountMinorUnits?: number;
  }): Promise<VerifiedPurchaseResult>;

  restorePurchases(params: {
    receiptData?: string;
    deviceAccountId?: string;
  }): Promise<RestoredPurchaseItem[]>;

  cancelSubscription(providerSubscriptionId: string): Promise<boolean>;

  verifyAndParseWebhook(event: WebhookEventPayload): Promise<ParsedWebhookResult>;
}
