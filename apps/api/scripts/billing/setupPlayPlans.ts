/**
 * The plans this app sells, on Google Play (run once per database; safe to re-run):
 *   PREMIUM — ₹399/month (₹1 for the first 3 days), ₹99/week, ₹3,999/year; fair use 150 messages a day.
 *   FREE    — 5 messages a day.
 *   Message pack — 100 extra messages for ₹49.
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
const PACK = process.env['PLAY_PACK_ID'] || 'messages_100';

const PRICES = [
  { id: `${SUB}:monthly`, amount: 39900, interval: 'MONTH' as const },
  { id: `${SUB}:weekly`, amount: 9900, interval: 'WEEK' as const },
  { id: `${SUB}:yearly`, amount: 399900, interval: 'YEAR' as const },
];

console.log(apply ? 'Applying…' : 'Dry run (add --apply to write):');
console.log(`- PREMIUM plan: ${PRICES.map((x) => `${x.id} ₹${x.amount / 100}/${x.interval.toLowerCase()}`).join(', ')}; 3-day ₹1 trial on monthly`);
console.log(`- Message pack: ${PACK} ₹49 → 100 messages`);
console.log('- Hide PLUS, PRO, ULTRA from the paywall (isActive=false); keep FREE');

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
      tagline: '₹1 for 3 days, then ₹399/month. Cancel anytime.',
      description: 'Chat with every character, full courses and health programs, long memory. Fair use: 150 messages a day.',
      isPopular: true,
      trialDays: 3,
    },
    update: { isActive: true, trialDays: 3, tagline: '₹1 for 3 days, then ₹399/month. Cancel anytime.' },
  });
  for (const x of PRICES) {
    await p.billingPrice.upsert({
      where: { provider_providerPriceId: { provider: 'GOOGLE', providerPriceId: x.id } },
      create: { productId: product.id, planId: plan.id, currency: 'INR', amountMinorUnits: x.amount, billingInterval: x.interval, provider: 'GOOGLE', providerPriceId: x.id, country: 'IN' },
      update: { amountMinorUnits: x.amount, active: true },
    });
  }
  for (const key of ['chat_basic', 'chat_priority', 'premium_characters', 'advanced_memory', 'proactive_messages']) {
    await p.planEntitlement.upsert({ where: { planId_entitlementKey: { planId: plan.id, entitlementKey: key } }, create: { planId: plan.id, entitlementKey: key }, update: {} });
  }
  const pack = await p.billingProduct.upsert({
    where: { slug: 'message-pack-100' },
    create: { name: '100 extra messages', slug: 'message-pack-100', type: 'CREDIT_PACK' },
    update: {},
  });
  await p.billingPrice.upsert({
    where: { provider_providerPriceId: { provider: 'GOOGLE', providerPriceId: PACK } },
    create: { productId: pack.id, currency: 'INR', amountMinorUnits: 4900, billingInterval: 'ONE_TIME', provider: 'GOOGLE', providerPriceId: PACK, country: 'IN' },
    update: { amountMinorUnits: 4900, active: true },
  });
  await p.billingPlan.updateMany({ where: { code: { in: ['PLUS', 'PRO', 'ULTRA'] } }, data: { isActive: false } });
  console.log('Done.');
}
await p.$disconnect();
