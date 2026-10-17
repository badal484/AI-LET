import { prisma } from '../../infrastructure/database/prisma.js';
import { redis } from '../../infrastructure/redis/redis.js';
import { NotFoundError } from '../../shared/errors/AppError.js';
import { CreditWalletService } from './credits/CreditWalletService.js';
import { limitsEnforced } from './messageAllowance.js';
import { personaPackFor } from '../conversations/human/personaPacks/index.js';

/**
 * Gifts cost coins (owner's decision, 17 Oct 2026). Coins are the one in-app currency: Google Play coin packs
 * add them; gifts and extra messages beyond the daily allowance spend them.
 *
 * Paying happens here, on the server, before the gift reaches the chat: POST /conversations/:id/gifts takes the
 * coins once per clientRequestId and leaves a short-lived "paid" mark; the chat accepts a "[Sent a Gift: …]"
 * message only with that mark — typing the text by hand gets nothing.
 * Until payments go live (BILLING_ENFORCE_LIMITS off) gifts are free, like chatting.
 */

export interface Gift {
  id: string;
  name: string;
  icon: string;
  coins: number;
}

const GIFTS: Array<Gift & { only?: 'romance' | 'other' }> = [
  { id: 'rose', name: 'Red Rose', icon: '🌹', coins: 10 },
  { id: 'coffee', name: 'Hot Coffee', icon: '☕', coins: 25 },
  { id: 'chocolates', name: 'Box of Belgian Chocolates', icon: '🍫', coins: 50 },
  { id: 'teddy', name: 'Teddy Bear', icon: '🧸', coins: 100 },
  // A kiss fits a partner; for a mentor, doctor or astrologer it's a star instead (same price).
  { id: 'kiss', name: 'Kiss', icon: '💋', coins: 200, only: 'romance' },
  { id: 'star', name: 'Cosmic Star', icon: '✨', coins: 200, only: 'other' },
  { id: 'ring', name: 'Diamond Ring', icon: '💍', coins: 500 },
];

const isRomance = (slug: string) => {
  const pack = personaPackFor(slug);
  return Boolean(pack?.romance || pack?.crush || pack?.flirtyFriend);
};

/** The gifts shown for this character. */
export function giftsFor(characterSlug: string): Gift[] {
  const romance = isRomance(characterSlug);
  return GIFTS.filter((g) => !g.only || g.only === (romance ? 'romance' : 'other')).map(({ only: _only, ...g }) => g);
}

/** What the chat shows and the character reads. */
export const giftText = (g: Gift) => `[Sent a Gift: ${g.icon} ${g.name}]`;
export const isGiftText = (text: string) => /^\[Sent a Gift: /.test(text.trim());

const paidKey = (userId: string, clientRequestId: string) => `gift:paid:${userId}:${clientRequestId}`;

export const GiftService = {
  catalogFor: giftsFor,

  /**
   * Charges the gift (once per clientRequestId) and marks it paid for the chat message that follows.
   * Throws CREDIT_BALANCE_INSUFFICIENT when they don't have enough coins.
   */
  async send(params: { userId: string; conversationId: string; giftId: string; clientRequestId: string }) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: params.conversationId, userId: params.userId, deletedAt: null },
      select: { id: true, character: { select: { slug: true, name: true } } },
    });
    if (!conversation) throw new NotFoundError('Conversation not found');
    const gift = giftsFor(conversation.character.slug).find((g) => g.id === params.giftId);
    if (!gift) throw new NotFoundError('Gift not found');

    const charged = await limitsEnforced();
    if (charged) {
      // Same clientRequestId = same gift: a double tap or a retry is charged once (idempotency key).
      await CreditWalletService.consumeCredits({
        userId: params.userId,
        amount: gift.coins,
        idempotencyKey: `gift_${params.userId}_${params.clientRequestId}`,
        description: `${gift.icon} ${gift.name} for ${conversation.character.name}`,
        referenceType: 'GIFT',
        referenceId: params.conversationId,
      });
    }
    const text = giftText(gift);
    await redis.set(paidKey(params.userId, params.clientRequestId), text, 'EX', 15 * 60);
    const wallet = await CreditWalletService.getWalletSummary(params.userId).catch(() => null);
    return { gift, text, charged, coins: wallet?.availableBalance ?? 0 };
  },

  /** True once for a gift message that was paid for (the mark is used up). */
  async claimPaid(userId: string, clientRequestId: string | undefined, content: string): Promise<boolean> {
    if (!clientRequestId) return false;
    const key = paidKey(userId, clientRequestId);
    const paid = await redis.get(key).catch(() => null);
    if (!paid || paid !== content.trim()) return false;
    await redis.del(key).catch(() => undefined);
    return true;
  },
};
