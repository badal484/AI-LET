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
 * Several openings each, picked at random, so two people never get the same scripted line. Each sounds
 * like that person (not a résumé intro), never pretends an earlier meeting, and names no time of day —
 * the same text can be shown at any hour.
 */
const GREETINGS: Record<string, string | string[]> = {
  riya: 'Hii! 🥰 Main Riya. Lovira pe pehli baar baat ho rahi hai na? Batao, kya chal raha hai aaj?',
  'ritika-sharma': [
    'Hi! Ek second, ye case file band karti hoon… haan, ab bolo 😏',
    'Hello! Ritika here. Objection pehle hi: aaj kuch boring mat sunana, 200 page padh ke aayi hoon 😩',
    'Hi 🙂 Seedha sawaal, jaise court mein: tumhara din kaisa ja raha hai?',
  ],
  'kabir-sethi': [
    'Hey 🎸 bas guitar tune kar raha tha. Kya scene hai tumhara?',
    'Heyy, Kabir here. Ek gaane ki line kab se atki hui hai… chhodo, tum batao, kaise ho?',
    'Hi! Sach batao, aajkal repeat pe kaunsa gaana chal raha hai? 🎧',
  ],
  'aarav-malhotra': [
    'hey 🙂 aarav here. kya chal raha hai?',
    'hi! abhi ek app screen teesri baar redesign ki, ab jaake sahi lag rahi hai 😅 tum batao?',
    'hey. kuch interesting batao, mera dimaag pixels mein atka hua hai 😄',
  ],
  'ishita-rao': [
    'Hii 🤍 Ishita here, Boston se. Tumhare yahan kya chal raha hai?',
    'Hey! Case study se 5 minute ka break liya hai, perfect timing 😄 Kaise ho?',
    'Hii! Hyderabad ki ladki, abhi Boston mein MBA ke chakkar mein 🙈 Tum apne baare mein batao?',
  ],
  'zoya-qureshi': [
    'Assalamu alaikum 🤍 Main Zoya. Aap kaise hain?',
    'Aadab! Abhi ek naam-plate pe calligraphy kar rahi thi, ungliyon pe syahi lagi hai 🙈 Aap sunaaiye?',
    'Hello 🤍 Kehte hain achhi baatein bhi shayari jaisi hoti hain… aap bataiye, kya haal hai?',
  ],
  'sandeep-chaudhary': [
    'Ram Ram ji! 🥛 Kya haal chaal?',
    'Ram Ram! Bhaisiyon ko chaara daal ke abhi fursat mili hai 😄 Tum sunao, kaisa chal raha?',
    'Haanji! Sandeep, apni dairy wala 🥛 Tension wala din hai ya chill wala?',
  ],
  'raj-bansal': [
    'Wassup! Raj here 📈 Channel shuru karna hai ya pehle se chal raha hai?',
    'Hey! Ek thumbnail ke 6 version bana ke baitha hoon, sab ek jaise lag rahe hain 😅 Tum batao, YouTube pe kya plan hai?',
    'Yo! Content ki baat karni hai ya bas hello bolne aaye ho? Dono chalega 😄',
  ],
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
