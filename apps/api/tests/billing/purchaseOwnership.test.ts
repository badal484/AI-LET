import { afterAll, describe, expect, it, vi } from 'vitest';

const pack = vi.hoisted(() => ({ account: undefined as string | undefined, order: 'GPA.0' }));
vi.mock('../../src/modules/billing/providers/googlePlayApi.js', () => ({
  googlePlayConfigured: () => true,
  getSubscription: vi.fn(async () => ({})),
  acknowledgeSubscription: vi.fn(async () => ({})),
  getProductPurchase: vi.fn(async () => ({ purchaseState: 0, consumptionState: 0, orderId: pack.order, obfuscatedExternalAccountId: pack.account })),
  consumeProduct: vi.fn(async () => ({})),
}));

import { prisma } from '../../src/infrastructure/database/prisma.js';
import { PurchaseService } from '../../src/modules/billing/services/PurchaseService.js';
import { CreditWalletService } from '../../src/modules/billing/credits/CreditWalletService.js';
import { playAccountId } from '../../src/modules/billing/providers/GooglePlayBillingProvider.js';
import { createUser, rid } from '../fixtures.js';

/** Audit M-3 / L-6: a Play purchase is granted only to the account it was bought for, and only once. */
describe('Play purchase ownership', () => {
  process.env['GOOGLE_PLAY_PACKAGE_NAME'] = 'com.aicompanionmobile';
  const created: string[] = [];
  afterAll(async () => {
    await prisma.purchaseTransaction.deleteMany({ where: { userId: { in: created } } });
  });
  const buyer = async () => {
    const u = await createUser();
    created.push(u.id);
    return u.id;
  };
  // Every purchase has its own Google order id.
  const verify = (userId: string, token: string) =>
    ((pack.order = `GPA.${token}`), true) &&
    PurchaseService.verifyPurchase(userId, { provider: 'google', productId: 'coins_100', receiptData: token, transactionId: token } as never);

  it('a purchase without the account id is refused (nobody can claim it with just the token)', async () => {
    const user = await buyer();
    pack.account = undefined;
    await expect(verify(user, `tok_${rid()}`)).rejects.toThrow(/can't be matched to your account/);
  });

  it('a purchase made for another account is refused', async () => {
    const owner = await buyer();
    const other = await buyer();
    pack.account = playAccountId(owner);
    await expect(verify(other, `tok_${rid()}`)).rejects.toThrow(/different account/);
  });

  it('the owner gets the coins once; a repeat is "already processed"; another user can neither claim nor see it', async () => {
    const owner = await buyer();
    const other = await buyer();
    pack.account = playAccountId(owner);
    const token = `tok_${rid()}`;
    const before = (await CreditWalletService.getWalletSummary(owner)).availableBalance;
    expect((await verify(owner, token)).success).toBe(true);
    expect((await verify(owner, token)).status).toBe('ALREADY_PROCESSED');
    expect((await CreditWalletService.getWalletSummary(owner)).availableBalance).toBe(before + 100);
    await expect(verify(other, token)).rejects.toThrow(/different account/);
  });

  it('two checks of the same purchase at the same moment add the coins once', async () => {
    const owner = await buyer();
    pack.account = playAccountId(owner);
    const token = `tok_${rid()}`;
    const before = (await CreditWalletService.getWalletSummary(owner)).availableBalance;
    const results = await Promise.allSettled([verify(owner, token), verify(owner, token), verify(owner, token)]);
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    expect(await prisma.purchaseTransaction.count({ where: { providerTransactionId: `GPA.${token}` } })).toBe(1); // stored by Google's order id
    expect((await CreditWalletService.getWalletSummary(owner)).availableBalance).toBe(before + 100);
  });
});
