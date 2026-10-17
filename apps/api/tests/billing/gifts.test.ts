import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { CreditWalletService } from '../../src/modules/billing/credits/CreditWalletService.js';
import { GiftService, giftsFor } from '../../src/modules/billing/gifts.service.js';
import { COIN_PACKS } from '../../src/modules/billing/providers/GooglePlayBillingProvider.js';
import { signAccessToken } from '../../src/security/tokens.js';
import { createCharacter, createConversation, createUser, rid } from '../fixtures.js';

/** Gifts cost coins (17 Oct 2026): paid on the server once per gift, and only paid gifts reach the chat. */
describe('gifts and coins', async () => {
  const app = createApp();
  const user = await createUser();
  const character = await createCharacter();
  const { conversationId } = await createConversation(user.id, character.id, []);
  const auth = { Authorization: `Bearer ${signAccessToken({ userId: user.id, email: user.email, roles: ['user'] })}` };

  afterAll(async () => {
    delete process.env['BILLING_ENFORCE_LIMITS'];
    await prisma.creditTransaction.deleteMany({ where: { userId: user.id } });
    await prisma.creditWallet.deleteMany({ where: { userId: user.id } });
  });

  it('a kiss for romance characters, a star for everyone else (same price)', () => {
    const romance = giftsFor('muskan-arora').map((g) => g.id);
    const mentor = giftsFor('dev-bhatia').map((g) => g.id);
    expect(romance).toContain('kiss');
    expect(romance).not.toContain('star');
    expect(mentor).toContain('star');
    expect(mentor).not.toContain('kiss');
    expect(giftsFor('muskan-arora').find((g) => g.id === 'kiss')).toMatchObject({ icon: '💋', coins: 200 });
  });

  it('coin packs: how many coins each gives is the server’s, and the old ₹49 pack is 100 coins', () => {
    expect(COIN_PACKS['coins_100']).toEqual({ coins: 100, amountMinorUnits: 4900 });
    expect(COIN_PACKS['coins_330']).toEqual({ coins: 330, amountMinorUnits: 14900 });
    expect(COIN_PACKS['coins_1000']).toEqual({ coins: 1000, amountMinorUnits: 39900 });
    expect(COIN_PACKS['messages_100']?.coins).toBe(100);
  });

  it('not enough coins → refused, nothing marked paid', async () => {
    process.env['BILLING_ENFORCE_LIMITS'] = 'true';
    const res = await request(app).post(`/api/v1/conversations/${conversationId}/gifts`).set(auth).send({ giftId: 'teddy', clientRequestId: `req-${rid()}` });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CREDIT_BALANCE_INSUFFICIENT');
  });

  it('with coins: charged once even if the request is repeated (double tap / retry)', async () => {
    process.env['BILLING_ENFORCE_LIMITS'] = 'true';
    await CreditWalletService.grantCredits({ userId: user.id, amount: 100, type: 'PURCHASE', idempotencyKey: `test_${rid()}`, description: 'test coins' });
    const clientRequestId = `req-${rid()}`;
    const first = await request(app).post(`/api/v1/conversations/${conversationId}/gifts`).set(auth).send({ giftId: 'rose', clientRequestId });
    const again = await request(app).post(`/api/v1/conversations/${conversationId}/gifts`).set(auth).send({ giftId: 'rose', clientRequestId });
    expect(first.status).toBe(200);
    expect(again.status).toBe(200);
    expect(first.body.data.text).toBe('[Sent a Gift: 🌹 Red Rose]');
    expect((await CreditWalletService.getWalletSummary(user.id)).availableBalance).toBe(90); // 100 − one rose
  });

  it('only a paid gift reaches the chat, and only once', async () => {
    process.env['BILLING_ENFORCE_LIMITS'] = 'true';
    const clientRequestId = `req-${rid()}`;
    await GiftService.send({ userId: user.id, conversationId, giftId: 'rose', clientRequestId });
    expect(await GiftService.claimPaid(user.id, clientRequestId, '[Sent a Gift: 💍 Diamond Ring]')).toBe(false); // not what was paid
    expect(await GiftService.claimPaid(user.id, clientRequestId, '[Sent a Gift: 🌹 Red Rose]')).toBe(true);
    expect(await GiftService.claimPaid(user.id, clientRequestId, '[Sent a Gift: 🌹 Red Rose]')).toBe(false); // used up
    expect(await GiftService.claimPaid(user.id, `req-${rid()}`, '[Sent a Gift: 🌹 Red Rose]')).toBe(false); // never paid
  });

  it('a gift typed by hand is refused in the chat once coins are charged', async () => {
    process.env['BILLING_ENFORCE_LIMITS'] = 'true';
    const res = await request(app)
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set(auth)
      .send({ content: '[Sent a Gift: 💍 Diamond Ring]', clientRequestId: `req-${rid()}` });
    expect(res.text).toContain('Send gifts with the gift button');
    expect(await prisma.message.count({ where: { conversationId, content: '[Sent a Gift: 💍 Diamond Ring]' } })).toBe(0);
  });

  it('another user cannot send a gift in this chat', async () => {
    const other = await createUser();
    const otherAuth = { Authorization: `Bearer ${signAccessToken({ userId: other.id, email: other.email, roles: ['user'] })}` };
    const res = await request(app).post(`/api/v1/conversations/${conversationId}/gifts`).set(otherAuth).send({ giftId: 'rose', clientRequestId: `req-${rid()}` });
    expect(res.status).toBe(404);
  });
});
