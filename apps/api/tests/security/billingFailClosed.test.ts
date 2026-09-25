import crypto from 'crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { env } from '../../src/config/env.js';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { BillingProviderFactory } from '../../src/modules/billing/providers/BillingProviderFactory.js';
import { PurchaseService } from '../../src/modules/billing/services/PurchaseService.js';
import { WebhookIngestionService } from '../../src/modules/billing/webhooks/WebhookIngestionService.js';

const setSim = (v: boolean) => ((env as { BILLING_SIMULATED_PROVIDERS: boolean }).BILLING_SIMULATED_PROVIDERS = v);

describe('billing fails closed without real provider verification', () => {
  let original: boolean;
  beforeEach(() => {
    original = env.BILLING_SIMULATED_PROVIDERS;
    setSim(false);
  });
  afterEach(() => setSim(original));

  it('rejects forged receipts for every provider, including mock', async () => {
    for (const provider of ['apple', 'google', 'stripe', 'mock'] as const) {
      const r = await BillingProviderFactory.getProvider(provider).verifyPurchase({ receiptData: 'anything-at-all', productId: 'pro_monthly', transactionId: `tx_${provider}` });
      expect(r.isValid, provider).toBe(false);
      expect(await BillingProviderFactory.getProvider(provider).restorePurchases({ receiptData: 'x' })).toEqual([]);
    }
  });

  it('a forged purchase grants no subscription or entitlement', async () => {
    const tag = crypto.randomBytes(4).toString('hex');
    const user = await prisma.user.create({ data: { email: `bill_${tag}@test.local`, normalizedEmail: `bill_${tag}@test.local` } });
    await expect(
      PurchaseService.verifyPurchase(user.id, { provider: 'apple', receiptData: 'FORGED', productId: 'pro_monthly', transactionId: `forged_${tag}`, planCode: 'PRO' } as never),
    ).rejects.toThrow();
    expect(await prisma.billingSubscription.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.userEntitlement.count({ where: { userId: user.id } })).toBe(0);
  });

  it('rejects unsigned / forged webhooks', async () => {
    for (const provider of ['apple', 'google', 'stripe', 'mock'] as const) {
      const res = await WebhookIngestionService.ingestWebhook({ provider, rawBody: JSON.stringify({ type: 'renewal', userId: 'x' }), signature: 'forged' });
      expect(res.status, provider).toBe('INVALID_SIGNATURE');
    }
  });
});
