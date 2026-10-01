/**
 * Opening messages that used the wrong app name ("Lovish"), pretended an earlier meeting on a first
 * chat ("Kahan gayab the?"), or were missing (Dr MAYA fell back to a line naming Shradha).
 *   npx tsx scripts/maintenance/fixGreetings.ts           # dry run
 *   npx tsx scripts/maintenance/fixGreetings.ts --apply   # applies (backup first)
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();
const apply = process.argv.includes('--apply');

const GREETINGS: Record<string, string> = {
  riya: 'Hii! 🥰 Main Riya. Lovira pe pehli baar baat ho rahi hai na? Batao, kya chal raha hai aaj?',
  'dr-shradha': 'Hello, main Shradha 🌿 Yahan aaram se, bina judge hue baat kar sakte ho. Aaj mann kaisa hai?',
  'dr-maya': 'Hii, main Maya 🌿 Neend, energy ya daily habits — kisi pe bhi saath kaam karte hain. Pehle batao, kal raat neend kaisi aayi?',
};

async function main() {
  const backup: unknown[] = [];
  for (const [slug, greeting] of Object.entries(GREETINGS)) {
    const c = await p.character.findFirst({ where: { slug }, include: { currentPublishedVersion: true } });
    const v = c?.currentPublishedVersion;
    if (!c || !v) throw new Error(`No published version for ${slug}`);
    const comm = (v.communicationData as Record<string, unknown> | null) ?? {};
    console.log(`${slug}: "${comm['initialGreeting'] ?? '(none)'}" → "${greeting}"`);
    backup.push({ versionId: v.id, slug, communicationData: comm });
    if (apply) {
      await p.characterVersion.update({ where: { id: v.id }, data: { communicationData: { ...comm, initialGreeting: greeting } as never } });
    }
  }
  if (!apply) return console.log('(dry run — pass --apply to change)');
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'backups');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `fixGreetings.${Date.now()}.json`), JSON.stringify(backup, null, 2));
  console.log('Applied (backup written).');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => p.$disconnect());
