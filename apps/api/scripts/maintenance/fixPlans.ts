/**
 * Plans must only promise what the app does. Voice calls and photo generation don't exist, so they come
 * out of the plans (entitlements, usage limits, copy). Prices are untouched — that's a product decision.
 *   npx tsx scripts/maintenance/fixPlans.ts           # dry run
 *   npx tsx scripts/maintenance/fixPlans.ts --apply   # applies (backup first) and clears plan caches
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { redis } from '../../src/infrastructure/redis/redis.js';

const p = new PrismaClient();
const apply = process.argv.includes('--apply');

const COPY: Record<string, { tagline: string; description: string }> = {
  FREE: { tagline: 'Chat with every character', description: 'Chat with every character, with memory and gentle check-ins.' },
  PLUS: { tagline: 'More messages', description: 'A bigger monthly message budget and faster replies.' },
  PRO: { tagline: 'More messages & deeper memory', description: 'A large message budget, deeper memory and follow-ups, and faster replies.' },
  ULTRA: { tagline: 'The most messages', description: 'The biggest message budget for people who chat a lot, plus early access to new features.' },
};
const FAKE_ENTITLEMENTS = ['voice_access', 'image_generation', 'custom_voice'];
const FAKE_METERS = ['voice_seconds', 'image_generations'];

async function main() {
  const plans = await p.billingPlan.findMany({ where: { code: { in: Object.keys(COPY) } }, include: { entitlements: true, usageLimits: true } });
  const products = await p.billingProduct.findMany({ where: { slug: { in: ['ai-companion-membership', 'ai-credits'] } } });
  for (const plan of plans) {
    const ents = plan.entitlements.filter((e) => FAKE_ENTITLEMENTS.includes(e.entitlementKey)).map((e) => e.entitlementKey);
    const meters = plan.usageLimits.filter((l) => FAKE_METERS.includes(l.meterUnit)).map((l) => l.meterUnit);
    console.log(`${plan.code}: "${plan.tagline}" → "${COPY[plan.code]!.tagline}"; remove ${[...ents, ...meters].join(', ') || 'nothing'}`);
  }
  if (!apply) return console.log('(dry run — pass --apply to change)');

  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'backups');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `fixPlans.${Date.now()}.json`), JSON.stringify({ plans, products }, null, 2));

  for (const plan of plans) {
    await p.billingPlan.update({ where: { id: plan.id }, data: COPY[plan.code]! });
    await p.planEntitlement.deleteMany({ where: { planId: plan.id, entitlementKey: { in: FAKE_ENTITLEMENTS } } });
    await p.planUsageLimit.deleteMany({ where: { planId: plan.id, meterUnit: { in: FAKE_METERS } } });
  }
  await p.billingProduct.updateMany({ where: { slug: 'ai-companion-membership' }, data: { description: 'Membership tiers for companion chat: message budget, memory and faster replies.' } });
  await p.billingProduct.updateMany({ where: { slug: 'ai-credits' }, data: { description: 'Pay-as-you-go credits for extra messages.' } });
  const keys = [...(await redis.keys('billing:*')), ...(await redis.keys('*plans*'))];
  if (keys.length) await redis.del(...keys);
  console.log(`Applied (backup written). Cleared ${keys.length} cached entries.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await p.$disconnect();
    redis.disconnect();
  });
