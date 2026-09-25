import {
  IBillingProvider,
  VerifiedPurchaseResult,
  RestoredPurchaseItem,
  WebhookEventPayload,
  ParsedWebhookResult,
} from './IBillingProvider.js';
import { BillingProviderType, PriceCurrency } from '@ai-companion/types';

export class MockBillingProvider implements IBillingProvider {
  public readonly providerType: BillingProviderType = 'mock';

  public async verifyPurchase(params: {
    receiptData: string;
    productId: string;
    transactionId: string;
    planCode?: string;
    currency?: PriceCurrency;
    priceAmountMinorUnits?: number;
  }): Promise<VerifiedPurchaseResult> {
    // If test receipt specifically says "INVALID_RECEIPT", reject it
    if (params.receiptData === 'INVALID_RECEIPT') {
      return {
        isValid: false,
        provider: 'mock',
        providerTransactionId: params.transactionId,
        productId: params.productId,
        currency: params.currency || 'USD',
        amountMinorUnits: params.priceAmountMinorUnits || 999,
        paymentStatus: 'FAILED',
        rawPayload: { error: 'Mock receipt verification failed' },
        errorMessage: 'Invalid mock receipt',
      };
    }

    const now = new Date();
    const isYearly = params.productId.toLowerCase().includes('yearly');
    const periodDurationDays = isYearly ? 365 : 30;
    const currentPeriodEnd = new Date(now.getTime() + periodDurationDays * 86400000);

    return {
      isValid: true,
      provider: 'mock',
      providerTransactionId: params.transactionId,
      providerSubscriptionId: `mock_sub_${params.transactionId}`,
      productId: params.productId,
      planCode: params.planCode || (params.productId.toUpperCase().includes('PRO') ? 'PRO' : 'PLUS'),
      currency: params.currency || 'USD',
      amountMinorUnits: params.priceAmountMinorUnits || (isYearly ? 9999 : 999),
      paymentStatus: 'SUCCEEDED',
      subscriptionStatus: 'active',
      currentPeriodStart: now,
      currentPeriodEnd,
      rawPayload: {
        mock: true,
        verifiedAt: now.toISOString(),
        receipt: params.receiptData,
      },
    };
  }

  public async restorePurchases(params: {
    receiptData?: string;
    deviceAccountId?: string;
  }): Promise<RestoredPurchaseItem[]> {
    if (params.receiptData === 'EMPTY_RECEIPT') {
      return [];
    }

    const now = new Date();
    return [
      {
        productId: 'companion_pro_monthly',
        transactionId: `mock_restored_${Date.now()}`,
        subscriptionId: `mock_sub_restored_${Date.now()}`,
        status: 'active',
        currentPeriodEnd: new Date(now.getTime() + 30 * 86400000),
      },
    ];
  }

  public async cancelSubscription(_providerSubscriptionId: string): Promise<boolean> {
    return true;
  }

  public async verifyAndParseWebhook(event: WebhookEventPayload): Promise<ParsedWebhookResult> {
    const rawString = typeof event.rawBody === 'string' ? event.rawBody : event.rawBody.toString('utf-8');
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(rawString);
    } catch {
      parsed = { raw: rawString };
    }

    return {
      isValidSignature: true,
      providerEventId: event.eventId || `mock_evt_${Date.now()}`,
      eventType: event.eventType || 'subscription.updated',
      providerTransactionId: (parsed['transactionId'] as string) || `mock_tx_${Date.now()}`,
      providerSubscriptionId: (parsed['subscriptionId'] as string) || `mock_sub_123`,
      subscriptionStatus: (parsed['status'] as any) || 'active',
      paymentStatus: 'SUCCEEDED',
      currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
      userId: parsed['userId'] as string,
      metadata: parsed,
    };
  }
}
