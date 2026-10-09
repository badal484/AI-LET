import { describe, expect, it, vi, beforeEach } from 'vitest';

const sub = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('../../src/modules/billing/providers/googlePlayApi.js', () => ({
  googlePlayConfigured: () => true,
  getSubscription: vi.fn(async () => sub.current),
  acknowledgeSubscription: vi.fn(async () => ({})),
  getProductPurchase: vi.fn(async () => ({ purchaseState: 0, consumptionState: 0, orderId: 'GPA.pack-1' })),
  consumeProduct: vi.fn(async () => ({})),
}));

import { GooglePlayBillingProvider, playAccountId, playGrantsAccess } from '../../src/modules/billing/providers/GooglePlayBillingProvider.js';
import * as api from '../../src/modules/billing/providers/googlePlayApi.js';

const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

describe('Google Play purchases', () => {
  beforeEach(() => {
    process.env['GOOGLE_PLAY_PACKAGE_NAME'] = 'com.aicompanionmobile';
  });

  it('access: active and grace yes; cancelled only until the paid period ends; expired/on hold no', () => {
    const item = (d: number) => [{ productId: 'companion_premium', expiryTime: inDays(d) }];
    expect(playGrantsAccess({ subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE', lineItems: item(30) })).toBe(true);
    expect(playGrantsAccess({ subscriptionState: 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', lineItems: item(2) })).toBe(true);
    expect(playGrantsAccess({ subscriptionState: 'SUBSCRIPTION_STATE_CANCELED', lineItems: item(5) })).toBe(true);
    expect(playGrantsAccess({ subscriptionState: 'SUBSCRIPTION_STATE_CANCELED', lineItems: item(-1) })).toBe(false);
    expect(playGrantsAccess({ subscriptionState: 'SUBSCRIPTION_STATE_ON_HOLD', lineItems: item(5) })).toBe(false);
    expect(playGrantsAccess({ subscriptionState: 'SUBSCRIPTION_STATE_EXPIRED', lineItems: item(-3) })).toBe(false);
  });

  it('a ₹1 trial purchase is verified as a trial, acknowledged, and tied to its account', async () => {
    sub.current = {
      subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
      acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING',
      latestOrderId: 'GPA.1234',
      startTime: new Date().toISOString(),
      externalAccountIdentifiers: { obfuscatedExternalAccountId: playAccountId('user-1') },
      lineItems: [{ productId: 'companion_premium', expiryTime: inDays(3), offerDetails: { basePlanId: 'monthly', offerId: 'trial' } }],
    };
    const r = await new GooglePlayBillingProvider().verifyPurchase({ receiptData: 'tok', productId: 'companion_premium', transactionId: 'tok' });
    expect(r.isValid).toBe(true);
    expect(r.subscriptionStatus).toBe('trialing');
    expect(r.planCode).toBe('PREMIUM');
    expect(r.providerSubscriptionId).toBe('tok');
    expect(r.amountMinorUnits).toBe(100);
    expect(api.acknowledgeSubscription).toHaveBeenCalled();
    expect((r.rawPayload as { obfuscatedAccountId: string }).obfuscatedAccountId).toBe(playAccountId('user-1'));
    expect(playAccountId('user-1')).not.toBe(playAccountId('user-2'));
  });

  it('an expired subscription or unknown product is not valid', async () => {
    sub.current = { subscriptionState: 'SUBSCRIPTION_STATE_EXPIRED', lineItems: [{ productId: 'companion_premium', expiryTime: inDays(-1) }] };
    expect((await new GooglePlayBillingProvider().verifyPurchase({ receiptData: 't', productId: 'companion_premium', transactionId: 't' })).isValid).toBe(false);
    sub.current = { subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE', lineItems: [{ productId: 'something_else', expiryTime: inDays(9) }] };
    expect((await new GooglePlayBillingProvider().verifyPurchase({ receiptData: 't', productId: 'companion_premium', transactionId: 't' })).isValid).toBe(false);
  });

  it('a message pack is consumed and marked as a pack', async () => {
    const r = await new GooglePlayBillingProvider().verifyPurchase({ receiptData: 'pt', productId: 'messages_100', transactionId: 'pt' });
    expect(r.isValid).toBe(true);
    expect((r.rawPayload as { kind: string }).kind).toBe('pack');
    expect(api.consumeProduct).toHaveBeenCalledWith('messages_100', 'pt');
  });

  it('a Play notification re-reads the real state (cancel → keeps access to period end)', async () => {
    sub.current = { subscriptionState: 'SUBSCRIPTION_STATE_CANCELED', latestOrderId: 'GPA.9', lineItems: [{ productId: 'companion_premium', expiryTime: inDays(10) }] };
    const data = Buffer.from(JSON.stringify({ packageName: 'com.aicompanionmobile', subscriptionNotification: { notificationType: 3, purchaseToken: 'tok' } })).toString('base64');
    const parsed = await new GooglePlayBillingProvider().verifyAndParseWebhook({ eventId: 'x', eventType: 'webhook', provider: 'google', rawBody: JSON.stringify({ message: { messageId: 'm1', data } }) });
    expect(parsed.isValidSignature).toBe(true);
    expect(parsed.eventType).toBe('CANCEL_AT_PERIOD_END');
    expect(parsed.providerSubscriptionId).toBe('tok');
    const wrongApp = Buffer.from(JSON.stringify({ packageName: 'com.other', subscriptionNotification: { purchaseToken: 'tok' } })).toString('base64');
    expect((await new GooglePlayBillingProvider().verifyAndParseWebhook({ eventId: 'y', eventType: 'webhook', provider: 'google', rawBody: JSON.stringify({ message: { data: wrongApp } }) })).isValidSignature).toBe(false);
  });
});
