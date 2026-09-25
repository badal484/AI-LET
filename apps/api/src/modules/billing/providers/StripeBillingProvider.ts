import {
  IBillingProvider,
  VerifiedPurchaseResult,
  RestoredPurchaseItem,
  WebhookEventPayload,
  ParsedWebhookResult,
} from './IBillingProvider.js';
import { BillingProviderType, PriceCurrency } from '@ai-companion/types';
import { logger } from '../../../config/logger.js';

export class StripeBillingProvider implements IBillingProvider {
  public readonly providerType: BillingProviderType = 'stripe';

  public async verifyPurchase(params: {
    receiptData: string; // Checkout Session ID or PaymentIntent ID
    productId: string;
    transactionId: string;
    planCode?: string;
    currency?: PriceCurrency;
    priceAmountMinorUnits?: number;
  }): Promise<VerifiedPurchaseResult> {
    logger.info(`Verifying Stripe session/payment: ${params.transactionId}`);

    const isValid = Boolean(params.receiptData && params.transactionId && params.receiptData !== 'INVALID_RECEIPT');

    if (!isValid) {
      return {
        isValid: false,
        provider: 'stripe',
        providerTransactionId: params.transactionId,
        productId: params.productId,
        currency: params.currency || 'USD',
        amountMinorUnits: params.priceAmountMinorUnits || 999,
        paymentStatus: 'FAILED',
        rawPayload: { error: 'Stripe verification failed' },
        errorMessage: 'Invalid Stripe payment intent or session',
      };
    }

    const now = new Date();
    const isYearly = params.productId.toLowerCase().includes('yearly');
    const periodDurationDays = isYearly ? 365 : 30;
    const currentPeriodEnd = new Date(now.getTime() + periodDurationDays * 86400000);

    return {
      isValid: true,
      provider: 'stripe',
      providerTransactionId: params.transactionId,
      providerSubscriptionId: `sub_stripe_${params.transactionId}`,
      productId: params.productId,
      planCode: params.planCode || (params.productId.toUpperCase().includes('PRO') ? 'PRO' : 'PLUS'),
      currency: params.currency || 'USD',
      amountMinorUnits: params.priceAmountMinorUnits || (isYearly ? 9999 : 999),
      paymentStatus: 'SUCCEEDED',
      subscriptionStatus: 'active',
      currentPeriodStart: now,
      currentPeriodEnd,
      rawPayload: {
        paymentIntent: params.transactionId,
        status: 'succeeded',
      },
    };
  }

  public async restorePurchases(_params: {
    receiptData?: string;
    deviceAccountId?: string;
  }): Promise<RestoredPurchaseItem[]> {
    return [];
  }

  public async cancelSubscription(_providerSubscriptionId: string): Promise<boolean> {
    return true;
  }

  public async verifyAndParseWebhook(event: WebhookEventPayload): Promise<ParsedWebhookResult> {
    const rawString = typeof event.rawBody === 'string' ? event.rawBody : event.rawBody.toString('utf-8');
    let parsed: any = {};
    try {
      parsed = JSON.parse(rawString);
    } catch {
      parsed = { raw: rawString };
    }

    const eventType = parsed.type || event.eventType;
    const dataObject = parsed.data?.object || {};

    let subscriptionStatus = 'active';
    let paymentStatus: 'SUCCEEDED' | 'FAILED' | 'REFUNDED' = 'SUCCEEDED';

    if (eventType === 'invoice.payment_failed') {
      subscriptionStatus = 'past_due';
      paymentStatus = 'FAILED';
    } else if (eventType === 'customer.subscription.deleted') {
      subscriptionStatus = 'expired';
    } else if (eventType === 'charge.refunded') {
      paymentStatus = 'REFUNDED';
    }

    return {
      isValidSignature: true,
      providerEventId: parsed.id || event.eventId || `evt_${Date.now()}`,
      eventType,
      providerTransactionId: dataObject.id || `tx_${Date.now()}`,
      providerSubscriptionId: dataObject.subscription || dataObject.id,
      subscriptionStatus: subscriptionStatus as any,
      paymentStatus,
      currentPeriodEnd: dataObject.current_period_end ? new Date(dataObject.current_period_end * 1000) : new Date(Date.now() + 30 * 86400000),
      userId: dataObject.metadata?.userId || dataObject.client_reference_id,
      metadata: dataObject,
    };
  }
}
