/**
 * Opening messages that used the wrong app name ("Lovish"), pretended an earlier meeting on a first
 * chat ("Kahan gayab the?", "Kitna miss karwaya", "finally online"), called a stranger "baby"/"bhai", or were missing (Dr MAYA fell back to a line naming Shradha).
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

/**
 * Simple first messages — a plain hi, like a real person — two each, picked at random. Never pretend
 * an earlier meeting, never name a time of day (the same text can be shown at any hour).
 */
const GREETINGS: Record<string, string | string[]> = {
  'ritika-sharma': [
    'Hi! Main Ritika 🙂 kaise ho?',
    'Hello! Kya chal raha hai?',
  ],
  'kabir-sethi': [
    'Hey! Main Kabir 🙂 kaise ho?',
    'Hey, kya scene hai?',
  ],
  'aarav-malhotra': [
    'hey 🙂 main aarav. kaise ho?',
    'hi! kya chal raha hai?',
  ],
  'ishita-rao': [
    'Hii! Main Ishita 🤍 kaise ho?',
    'Hey! Kya chal raha hai?',
  ],
  'zoya-qureshi': [
    'Assalamu alaikum 🤍 Main Zoya. Aap kaise hain?',
    'Aadab! Kya haal hai aapka?',
  ],
  'sandeep-chaudhary': [
    'Ram Ram ji! 🙂 Kya haal chaal?',
    'Ram Ram! Main Sandeep. Kaise ho?',
  ],
  'raj-bansal': [
    'Hey! Main Raj 🙂 kaise ho?',
    'Wassup! Kya chal raha hai?',
  ],
  riya: ['Hii! Main Riya 🥰 kaise ho?', 'Hey! Kya chal raha hai?'],
  'aanya-mehta': ['Hii! Main Aanya 🤍 kaise ho?', 'Hey! Kya chal raha hai?'],
  'muskan-arora': ['Hii! Main Muskan ✨ kaise ho?', 'Hey! Kya chal raha hai?'],
  'sakshi': ['Hii! Main Sakshi ✨ kaise ho?', 'Hello! Kya chal raha hai?'],
  'jiya-singhal': ['Hi! Main Jiya 😊 kaise ho?', 'Hello! Kya chal raha hai?'],
  'shreya-mehta': ['Hey! Main Shreya ✨ kaise ho?', 'Hii! Kya chal raha hai?'],
  'aditya-agarwal': ['Hi! Main Aditya 🙂 kaise ho?', 'Hello! Kya chal raha hai?'],
  'arjun-mehra': ['Hey! Main Arjun 🙂 kaise ho?', 'Hi! Kya chal raha hai?'],
  'rohan-desai': ['Kem cho! Main Rohan 😄 kaise ho?', 'Hey! Kya chal raha hai?'],
  'nandini-reddy': ['Hey! Main Nandini 🌿 kaise ho?', 'Hii! Kya chal raha hai?'],
  'vishnu': ['Hey! Main Vishnu 😄 kaise ho?', 'Machane! Kya scene hai?'],
  'priya-mishra': ['Hii! Main Priya 😊 kaise ho?', 'Arey hello! Kya chal raha hai?'],
  'rani-mehta': ['Hii! Main Rani 🎭 kaise ho?', 'Hello! Kya chal raha hai?'],
  'tanu-verma': ['Arey hello! Main Tanu 😄 kaise ho?', 'Hii! Kya scene hai?'],
  'natasha': ['Hey! Main Natasha 💪 kaise ho?', 'Hi! Kya chal raha hai?'],
  'meera-sen': ['Namaste! Main Meera 🌸 Aap kaise hain?', 'Hello! Kya haal hai aapka?'],
  'urvi-arora': ['Hii! Main Urvi 🥗 kaise ho?', 'Hello! Kya chal raha hai?'],
  'joel-antony': ['Hey! Main Joel 💪 kaise ho?', 'Hi! Kya chal raha hai?'],
  'dr-shradha': ['Hello, main Shradha 🌿 kaise ho?', 'Hi! Kaisa chal raha hai sab?'],
  'dr-maya': ['Hii, main Maya 🌿 kaise ho?', 'Hello! Kya chal raha hai?'],
  'kiara-khanna': ['heyy! main Kiara 💕 kaise ho?', 'hii! kya chal raha hai?'],
  'simran-kaur': ['Hey! Main Simran 😊 kaise ho?', 'Hii! Kya chal raha hai?'],
  'aarohi-nair': ['Hi! Main Aarohi 🙂 kaise ho?', 'Hey! Kya chal raha hai?'],
  'neha': ['Namaste! Main Neha 😊 Aap kaise hain?', 'Hello! Kya haal hai aapka?'],
};

async function main() {
  const backup: unknown[] = [];
  for (const [slug, greeting] of Object.entries(GREETINGS)) {
    const c = await p.character.findFirst({ where: { slug }, include: { currentPublishedVersion: true } });
    const v = c?.currentPublishedVersion;
    if (!c || !v) throw new Error(`No published version for ${slug}`);
    const comm = (v.communicationData as Record<string, unknown> | null) ?? {};
    const list = Array.isArray(greeting) ? greeting : [greeting];
    console.log(`${slug}: "${comm['initialGreeting'] ?? '(none)'}" → ${list.map((g) => `"${g}"`).join(' | ')}`);
    backup.push({ versionId: v.id, slug, communicationData: comm });
    if (apply) {
      await p.characterVersion.update({ where: { id: v.id }, data: { communicationData: { ...comm, initialGreeting: list[0], initialGreetings: list } as never } });
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
