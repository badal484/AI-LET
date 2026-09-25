import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreditWalletService } from '../src/modules/billing/credits/CreditWalletService.js';
import { prisma } from '../src/infrastructure/database/prisma.js';

describe('CreditWalletService & Immutable Ledger', () => {
  const userId = 'usr_test_credit_wallet_123';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('handles grantCredits with strict idempotency (does not double-credit on retry)', async () => {
    const existingTx = {
      id: 'tx_existing_grant_1',
      userId,
      amount: 500,
      balanceAfter: 500,
      idempotencyKey: 'idemp_grant_welcome_1',
      type: 'GRANT',
    };

    vi.spyOn(prisma.creditTransaction, 'findUnique').mockResolvedValue(existingTx as any);

    const transaction = await CreditWalletService.grantCredits({
      userId,
      amount: 500,
      type: 'GRANT',
      isPromotional: true,
      description: 'Welcome promotion',
      idempotencyKey: 'idemp_grant_welcome_1',
    });

    expect(transaction.id).toBe(existingTx.id);
  });

  it('rejects credit consumption when balance is insufficient', async () => {
    vi.spyOn(prisma.creditTransaction, 'findUnique').mockResolvedValue(null);
    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
      return cb({
        creditWallet: {
          findUnique: vi.fn().mockResolvedValue({
            userId,
            availableBalance: 20,
            promotionalCredits: 20,
            purchasedCredits: 0,
          }),
        },
      });
    });

    await expect(
      CreditWalletService.consumeCredits({
        userId,
        amount: 50,
        description: 'Image generation',
        idempotencyKey: 'idemp_gen_image_1',
      }),
    ).rejects.toThrow(/Insufficient credit balance/i);
  });

  it('prioritizes consuming promotional credits before purchased credits', async () => {
    vi.spyOn(prisma.creditTransaction, 'findUnique').mockResolvedValue(null);

    let updatedWalletData: any = null;
    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
      return cb({
        creditWallet: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'wallet_123',
            userId,
            availableBalance: 100, // 30 promo + 70 purchased
            promotionalCredits: 30,
            purchasedCredits: 70,
            lifetimeConsumed: 0,
          }),
          update: vi.fn().mockImplementation((args: any) => {
            updatedWalletData = args.data;
            return {
              id: 'wallet_123',
              userId,
              availableBalance: 50,
              promotionalCredits: 0,
              purchasedCredits: 50,
              updatedAt: new Date(),
            };
          }),
        },
        creditTransaction: {
          create: vi.fn().mockResolvedValue({
            id: 'tx_consume_50',
            userId,
            amount: -50,
            balanceAfter: 50,
            idempotencyKey: 'idemp_consume_50',
            type: 'CONSUMPTION',
          }),
        },
      });
    });

    // Consuming 50 credits: should take all 30 promo credits, and 20 purchased credits
    const transaction = await CreditWalletService.consumeCredits({
      userId,
      amount: 50,
      description: 'Voice call 10 mins',
      idempotencyKey: 'idemp_consume_50',
    });

    expect(updatedWalletData).not.toBeNull();
    expect(updatedWalletData.promotionalCredits).toEqual({ decrement: 30 });
    expect(updatedWalletData.purchasedCredits).toEqual({ decrement: 20 });
    expect(updatedWalletData.availableBalance).toEqual({ decrement: 50 });
    expect(transaction.amount).toBe(-50);
  });
});
