/**
 * Puts characters in the right home-screen category and gives each category one name.
 *   npx tsx scripts/maintenance/fixCategories.ts           # dry run
 *   npx tsx scripts/maintenance/fixCategories.ts --apply   # applies (backup first) and clears feed caches
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { redis } from '../../src/infrastructure/redis/redis.js';

const p = new PrismaClient();
const apply = process.argv.includes('--apply');

// Decided with the product owner on 2026-09-30 (Meera Sen stays in Health & Wellness).
const MOVES: Array<{ slug: string; to: string }> = [
  { slug: 'nandini-reddy', to: 'friendship' },
  { slug: 'sandeep-chaudhary', to: 'professionals' },
];
const RENAMES: Array<{ slug: string; displayName: string }> = [{ slug: 'coaching', displayName: 'Dating & Life Coaching' }];

async function main() {
  const backup: Record<string, unknown[]> = { characters: [], categories: [] };
  for (const move of MOVES) {
    const c = await p.character.findFirst({ where: { slug: move.slug }, select: { id: true, name: true, category: true, categoryId: true } });
    const cat = await p.characterCategory.findUnique({ where: { slug: move.to } });
    if (!c || !cat) throw new Error(`Missing character ${move.slug} or category ${move.to}`);
    console.log(`${c.name}: ${c.category ?? '∅'} → ${cat.slug} (${cat.displayName})`);
    backup['characters']!.push(c);
    if (apply) await p.character.update({ where: { id: c.id }, data: { category: cat.slug, categoryId: cat.id } });
  }
  for (const r of RENAMES) {
    const cat = await p.characterCategory.findUnique({ where: { slug: r.slug }, select: { id: true, slug: true, name: true, displayName: true } });
    if (!cat) throw new Error(`Missing category ${r.slug}`);
    console.log(`Category ${cat.slug}: "${cat.displayName}" / "${cat.name}" → "${r.displayName}"`);
    backup['categories']!.push(cat);
    if (apply) await p.characterCategory.update({ where: { id: cat.id }, data: { name: r.displayName, displayName: r.displayName } });
  }
  if (!apply) return console.log('(dry run — pass --apply to change)');

  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'backups');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `fixCategories.${Date.now()}.json`), JSON.stringify(backup, null, 2));

  // Clear cached catalog and home feeds so the app sees the change immediately.
  const keys = [...(await redis.keys('discovery:*')), ...(await redis.keys('home:*'))];
  if (keys.length) await redis.del(...keys);
  console.log(`Applied. Cleared ${keys.length} cached feed entries.`);
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
