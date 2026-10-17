/**
 * The plans this app sells, on Google Play (run once per database; safe to re-run):
 *   PREMIUM — ₹499/month, starting with ₹1 for the first day; fair use 150 messages a day. The only plan:
 *             no weekly or yearly plan, and no free messages (limits.freeDaily = 0; the admin can change it).
 *   Coin packs (one-time) — ₹49 = 100, ₹149 = 330, ₹399 = 1,000 coins. Coins pay for gifts and for extra
 *             messages beyond the daily allowance (1 coin each).
 * The old placeholder plans (PLUS, PRO, ULTRA with MOCK prices) are hidden from the paywall.
 *
 *   npx tsx scripts/billing/setupPlayPlans.ts          (dry run)
 *   npx tsx scripts/billing/setupPlayPlans.ts --apply
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();
const apply = process.argv.includes('--apply');
const SUB = process.env['PLAY_SUBSCRIPTION_ID'] || 'companion_premium';
const COIN_PACKS = [
  { id: 'coins_100', coins: 100, amount: 4900 },
  { id: 'coins_330', coins: 330, amount: 14900 },
  { id: 'coins_1000', coins: 1000, amount: 39900 },
];

const PRICES = [
  { id: `${SUB}:monthly`, amount: 49900, interval: 'MONTH' as const },
];
// Plans no longer sold — switched off if an earlier run created them.
const RETIRED = [`${SUB}:weekly`, `${SUB}:yearly`];

console.log(apply ? 'Applying…' : 'Dry run (add --apply to write):');
console.log(`- PREMIUM plan: ${PRICES.map((x) => `${x.id} ₹${x.amount / 100}/${x.interval.toLowerCase()}`).join(', ')}; 1-day ₹1 trial on monthly`);
console.log(`- Coin packs: ${COIN_PACKS.map((p) => `${p.id} ₹${p.amount / 100} → ${p.coins} coins`).join(', ')}`);
console.log(`- Switch off retired prices: ${RETIRED.join(', ')}`);
console.log('- Hide PLUS, PRO, ULTRA from the paywall (isActive=false); keep FREE (= no subscription)');

if (apply) {
  const product = await p.billingProduct.upsert({
    where: { slug: 'companion-premium' },
    create: { name: 'Premium', slug: 'companion-premium', description: 'All characters, full courses and health programs, long memory', type: 'SUBSCRIPTION' },
    update: {},
  });
  const plan = await p.billingPlan.upsert({
    where: { code: 'PREMIUM' },
    create: {
      productId: product.id,
      code: 'PREMIUM',
      name: 'Premium',
      tagline: '₹1 for the first day, then ₹499/month. Cancel anytime.',
      description: 'Chat with every character, full courses and health programs, long memory. Fair use: 150 messages a day.',
      isPopular: true,
      trialDays: 1,
    },
    update: { isActive: true, trialDays: 1, tagline: '₹1 for the first day, then ₹499/month. Cancel anytime.' },
  });
  for (const x of PRICES) {
    await p.billingPrice.upsert({
      where: { provider_providerPriceId: { provider: 'GOOGLE', providerPriceId: x.id } },
      create: { productId: product.id, planId: plan.id, currency: 'INR', amountMinorUnits: x.amount, billingInterval: x.interval, provider: 'GOOGLE', providerPriceId: x.id, country: 'IN' },
      update: { amountMinorUnits: x.amount, active: true },
    });
  }
  await p.billingPrice.updateMany({ where: { provider: 'GOOGLE', providerPriceId: { in: RETIRED } }, data: { active: false } });
  for (const key of ['chat_basic', 'chat_priority', 'premium_characters', 'advanced_memory', 'proactive_messages']) {
    await p.planEntitlement.upsert({ where: { planId_entitlementKey: { planId: plan.id, entitlementKey: key } }, create: { planId: plan.id, entitlementKey: key }, update: {} });
  }
  const coinProduct = await p.billingProduct.upsert({
    where: { slug: 'coins' },
    create: { name: 'Coins', slug: 'coins', type: 'CREDIT_PACK', description: 'For gifts and extra messages' },
    update: {},
  });
  for (const pack of COIN_PACKS) {
    await p.billingPrice.upsert({
      where: { provider_providerPriceId: { provider: 'GOOGLE', providerPriceId: pack.id } },
      create: { productId: coinProduct.id, currency: 'INR', amountMinorUnits: pack.amount, billingInterval: 'ONE_TIME', provider: 'GOOGLE', providerPriceId: pack.id, country: 'IN' },
      update: { amountMinorUnits: pack.amount, active: true },
    });
  }
  await p.billingPlan.updateMany({ where: { code: { in: ['PLUS', 'PRO', 'ULTRA'] } }, data: { isActive: false } });
  console.log('Done.');
}
await p.$disconnect();
