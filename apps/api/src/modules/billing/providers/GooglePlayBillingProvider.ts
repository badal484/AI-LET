import { createHash } from 'node:crypto';
import type { BillingProviderType, SubscriptionStatus } from '@ai-companion/types';
import { logger } from '../../../config/logger.js';
import type { IBillingProvider, ParsedWebhookResult, RestoredPurchaseItem, VerifiedPurchaseResult, WebhookEventPayload } from './IBillingProvider.js';
import { acknowledgeSubscription, consumeProduct, getProductPurchase, getSubscription, type PlaySubscription } from './googlePlayApi.js';

/**
 * The Play catalog this app sells (create the same IDs in Play Console → Monetize):
 *  - subscription `companion_premium`, base plans `monthly` (₹399), `weekly` (₹99), `yearly` (₹3,999);
 *    on `monthly`, an introductory offer of ₹1 for 3 days (offer id `trial`), new customers only.
 *  - one-time consumable `messages_100` (₹49): 100 extra messages.
 */
export const PLAY_CATALOG = {
  subscriptionProductId: process.env['PLAY_SUBSCRIPTION_ID'] || 'companion_premium',
  packProductId: process.env['PLAY_PACK_ID'] || 'messages_100',
  packMessages: 100,
  planCode: 'PREMIUM',
};

/** The id the app passes to Play as obfuscatedAccountId, so a purchase can't be claimed by another account. */
export const playAccountId = (userId: string) => createHash('sha256').update(`ai-companion:${userId}`).digest('hex').slice(0, 64);

const STATUS: Record<string, SubscriptionStatus> = {
  SUBSCRIPTION_STATE_ACTIVE: 'active',
  SUBSCRIPTION_STATE_IN_GRACE_PERIOD: 'grace_period',
  SUBSCRIPTION_STATE_ON_HOLD: 'past_due',
  SUBSCRIPTION_STATE_PAUSED: 'paused',
  // Cancelled but paid up: access continues until the expiry time.
  SUBSCRIPTION_STATE_CANCELED: 'cancelled',
  SUBSCRIPTION_STATE_EXPIRED: 'expired',
  SUBSCRIPTION_STATE_PENDING: 'incomplete',
  SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED: 'expired',
};

/** Still gives access right now (cancelled subscriptions run to the end of what was paid). */
export function playGrantsAccess(sub: PlaySubscription): boolean {
  const expiry = sub.lineItems?.[0]?.expiryTime ? new Date(sub.lineItems[0].expiryTime).getTime() : 0;
  if (sub.subscriptionState === 'SUBSCRIPTION_STATE_ACTIVE' || sub.subscriptionState === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD') return true;
  return sub.subscriptionState === 'SUBSCRIPTION_STATE_CANCELED' && expiry > Date.now();
}

export class GooglePlayBillingProvider implements IBillingProvider {
  public readonly providerType: BillingProviderType = 'google';

  public async verifyPurchase(params: { receiptData: string; productId: string; transactionId: string; planCode?: string }): Promise<VerifiedPurchaseResult> {
    const token = params.receiptData;
    const fail = (reason: string): VerifiedPurchaseResult => ({
      isValid: false,
      provider: 'google',
      providerTransactionId: params.transactionId,
      productId: params.productId,
      currency: 'INR',
      amountMinorUnits: 0,
      paymentStatus: 'FAILED',
      rawPayload: { reason },
      errorMessage: 'We could not confirm this purchase with Google Play. You have not been charged twice — please try Restore in a minute.',
    });
    try {
      if (params.productId === PLAY_CATALOG.packProductId) {
        const p = await getProductPurchase(params.productId, token);
        if (p.purchaseState !== 0) return fail(`pack purchaseState ${p.purchaseState}`);
        if (p.consumptionState === 1) return fail('pack already consumed');
        await consumeProduct(params.productId, token);
        return {
          isValid: true,
          provider: 'google',
          providerTransactionId: p.orderId || token,
          productId: params.productId,
          currency: 'INR',
          amountMinorUnits: 4900,
          paymentStatus: 'SUCCEEDED',
          rawPayload: { kind: 'pack', obfuscatedAccountId: p.obfuscatedExternalAccountId, test: p.purchaseType === 0 },
        };
      }

      const sub = await getSubscription(token);
      const item = sub.lineItems?.[0];
      if (!item || item.productId !== PLAY_CATALOG.subscriptionProductId) return fail(`unknown product ${item?.productId}`);
      if (!playGrantsAccess(sub)) return fail(`state ${sub.subscriptionState}`);
      if (sub.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING') await acknowledgeSubscription(item.productId, token);
      const basePlan = item.offerDetails?.basePlanId ?? 'monthly';
      const inTrial = item.offerDetails?.offerId === 'trial' && (sub.startTime ? Date.now() - new Date(sub.startTime).getTime() < 3.5 * 86_400_000 : false);
      const start = sub.startTime ? new Date(sub.startTime) : new Date();
      const end = item.expiryTime ? new Date(item.expiryTime) : new Date(Date.now() + 86_400_000);
      return {
        isValid: true,
        provider: 'google',
        // One row per paid period: the order id changes on every renewal.
        providerTransactionId: sub.latestOrderId || params.transactionId,
        providerSubscriptionId: token,
        productId: `${item.productId}:${basePlan}`,
        planCode: PLAY_CATALOG.planCode,
        currency: 'INR',
        amountMinorUnits: inTrial ? 100 : basePlan === 'weekly' ? 9900 : basePlan === 'yearly' ? 399900 : 39900,
        paymentStatus: 'SUCCEEDED',
        subscriptionStatus: inTrial ? 'trialing' : STATUS[sub.subscriptionState] ?? 'active',
        currentPeriodStart: start,
        currentPeriodEnd: end,
        ...(inTrial && { trialStart: start, trialEnd: end }),
        rawPayload: {
          kind: 'subscription',
          state: sub.subscriptionState,
          basePlan,
          offerId: item.offerDetails?.offerId,
          linkedPurchaseToken: sub.linkedPurchaseToken,
          obfuscatedAccountId: sub.externalAccountIdentifiers?.obfuscatedExternalAccountId,
          test: Boolean(sub.testPurchase),
        },
      };
    } catch (err) {
      logger.warn(`[Billing] Google Play verification error: ${err instanceof Error ? err.message : 'Unknown'}`);
      return fail('google api error');
    }
  }

  /** Restore = the app re-sends each active purchase token to /purchases/verify (idempotent). */
  public async restorePurchases(): Promise<RestoredPurchaseItem[]> {
    return [];
  }

  /** Users cancel in the Play Store (Play's rules); the app links them there. */
  public async cancelSubscription(): Promise<boolean> {
    return false;
  }

  /**
   * Real-time developer notifications (Pub/Sub push). The payload only says "something changed for this
   * token" — the state is always re-read from Google, so a forged message can't grant anything.
   */
  public async verifyAndParseWebhook(event: WebhookEventPayload): Promise<ParsedWebhookResult> {
    try {
      const body = JSON.parse(event.rawBody.toString()) as { message?: { messageId?: string; data?: string } };
      const data = JSON.parse(Buffer.from(body.message?.data ?? '', 'base64').toString('utf8')) as {
        packageName?: string;
        subscriptionNotification?: { notificationType?: number; purchaseToken?: string };
        testNotification?: unknown;
      };
      const eventId = body.message?.messageId ?? event.eventId;
      const token = data.subscriptionNotification?.purchaseToken;
      if (data.packageName !== process.env['GOOGLE_PLAY_PACKAGE_NAME'] || !token) {
        return { isValidSignature: Boolean(data.testNotification), providerEventId: eventId, eventType: 'TEST' };
      }
      const sub = await getSubscription(token);
      const end = sub.lineItems?.[0]?.expiryTime ? new Date(sub.lineItems[0].expiryTime) : undefined;
      const eventType = playGrantsAccess(sub)
        ? sub.subscriptionState === 'SUBSCRIPTION_STATE_CANCELED'
          ? 'CANCEL_AT_PERIOD_END'
          : 'RENEW'
        : sub.subscriptionState === 'SUBSCRIPTION_STATE_ON_HOLD'
          ? 'PAYMENT_FAIL'
          : 'EXPIRE';
      return {
        isValidSignature: true,
        providerEventId: eventId,
        eventType,
        providerSubscriptionId: token,
        providerTransactionId: sub.latestOrderId,
        subscriptionStatus: STATUS[sub.subscriptionState],
        currentPeriodEnd: end,
        metadata: { notificationType: data.subscriptionNotification?.notificationType, state: sub.subscriptionState },
      };
    } catch (err) {
      logger.warn(`[Billing] Google RTDN parse failed: ${err instanceof Error ? err.message : 'Unknown'}`);
      return { isValidSignature: false, providerEventId: event.eventId, eventType: 'INVALID' };
    }
  }
}
