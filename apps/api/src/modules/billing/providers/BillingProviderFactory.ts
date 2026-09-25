import { BillingProviderType } from '@ai-companion/types';
import { env } from '../../../config/env.js';
import { logger } from '../../../config/logger.js';
import { IBillingProvider, ParsedWebhookResult, RestoredPurchaseItem, VerifiedPurchaseResult, WebhookEventPayload } from './IBillingProvider.js';
import { MockBillingProvider } from './MockBillingProvider.js';
import { AppleBillingProvider } from './AppleBillingProvider.js';
import { GoogleBillingProvider } from './GoogleBillingProvider.js';
import { StripeBillingProvider } from './StripeBillingProvider.js';

/** Simulated receipt/webhook verification is only ever allowed in development and test. */
export function billingSimulationAllowed(): boolean {
  return env.BILLING_SIMULATED_PROVIDERS && (env.NODE_ENV === 'development' || env.NODE_ENV === 'test');
}

/**
 * Fails closed for a provider that has no real store/processor verification. Nothing is granted:
 * receipts are rejected, restores return nothing, and webhooks are treated as unsigned.
 */
class UnverifiedProviderGuard implements IBillingProvider {
  constructor(public readonly providerType: BillingProviderType) {}

  public async verifyPurchase(params: { productId: string; transactionId: string; planCode?: string }): Promise<VerifiedPurchaseResult> {
    logger.warn(`[Billing] Rejected ${this.providerType} purchase: provider verification is not configured`, { productId: params.productId });
    return {
      isValid: false,
      provider: this.providerType,
      providerTransactionId: params.transactionId,
      productId: params.productId,
      planCode: params.planCode,
      currency: 'USD',
      amountMinorUnits: 0,
      paymentStatus: 'FAILED',
      rawPayload: { reason: 'PROVIDER_VERIFICATION_NOT_CONFIGURED' },
      errorMessage: 'Purchases are temporarily unavailable. You have not been charged by us and nothing was granted.',
    };
  }

  public async restorePurchases(): Promise<RestoredPurchaseItem[]> {
    return [];
  }

  public async cancelSubscription(): Promise<boolean> {
    return false;
  }

  public async verifyAndParseWebhook(event: WebhookEventPayload): Promise<ParsedWebhookResult> {
    logger.warn(`[Billing] Rejected ${this.providerType} webhook: signature verification is not configured`, { eventId: event.eventId });
    return { isValidSignature: false, providerEventId: event.eventId, eventType: event.eventType };
  }
}

export class BillingProviderFactory {
  private static readonly simulated: Record<BillingProviderType, IBillingProvider> = {
    mock: new MockBillingProvider(),
    apple: new AppleBillingProvider(),
    google: new GoogleBillingProvider(),
    stripe: new StripeBillingProvider(),
  };

  /**
   * Apple/Google/Stripe adapters do not yet perform real verification (they accept any receipt), so
   * outside development/test every provider — including `mock` — is replaced by a fail-closed guard.
   */
  public static getProvider(type: BillingProviderType = 'mock'): IBillingProvider {
    if (!billingSimulationAllowed()) return new UnverifiedProviderGuard(type);
    return this.simulated[type] ?? this.simulated.mock;
  }
}
