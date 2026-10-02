/**
 * One character, one realistic user, two days: the same everyday moments for everyone (hi, short replies,
 * a bad day, "tum real ho?", annoyed, bye, coming back) plus a question and a request from their own field.
 * Transcripts are reviewed by hand against the checklist; nothing is auto-scored.
 *
 *   npx tsx scripts/eval/character.eval.ts ritika-sharma [more-slugs…]
 * Output: scripts/eval/results/character-<slug>.md
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { signAccessToken } from '../../src/security/tokens.js';
import { send, timeTravel } from './conversations.eval.js';

const p = new PrismaClient();
const API = process.env['EVAL_API_URL'] || 'http://localhost:4000/api/v1';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A question and a request from each character's own world. */
const FIELD: Record<string, { ask: string; request: string }> = {
  'ritika-sharma': { ask: 'tum kis cheez ki padhai kar rahi ho?', request: 'mujhe ek tip do ki argument mein kaise jeetun' },
  'aanya-mehta': { ask: 'phone se achhi photo kaise aati hai?', request: 'mere liye 3 photo ideas do aaj ke liye' },
  'muskan-arora': { ask: 'tumhari favourite book kaunsi hai?', request: 'mere liye ek chhoti si shayari likh do' },
  'kabir-sethi': { ask: 'tum kaunsa music banate ho?', request: 'mere mood ke liye 3 gaane suggest karo' },
  riya: { ask: 'design mein kya karti ho tum?', request: 'meri insta bio ke liye 2 cute lines likh do' },
  'ishita-rao': { ask: 'Boston mein abhi kya time hai?', request: 'mujhe MBA ke liye 3 tips do' },
  'zoya-qureshi': { ask: 'calligraphy kaise seekhte hain?', request: 'ek sher sunao na' },
  'aarav-malhotra': { ask: 'product designer kya karta hai exactly?', request: 'mere portfolio ke liye 3 tips do' },
  sakshi: { ask: 'meri rashi simha hai, ye mahina kaisa rahega?', request: 'career ke liye ek tarot reading do' },
  'jiya-singhal': { ask: 'english mein hesitation kaise jaaye?', request: 'interview ke liye tell me about yourself ka answer bana do, main fresher hoon' },
  'shreya-mehta': { ask: 'reels pe views kyun nahi aate?', request: 'mere fitness page ke liye 5 reel ideas do' },
  'aditya-agarwal': { ask: '10 hazar mein kaunsa business shuru ho sakta hai?', request: 'home tiffin service ka simple plan bana do' },
  'raj-bansal': { ask: 'YouTube pe paise kab milte hain?', request: 'cooking channel ke liye 5 video ideas do' },
  'dev-bhatia': { ask: 'JavaScript kahan se shuru karu?', request: 'ek simple calculator ka JavaScript code do, main beginner hoon' },
  'arjun-mehra': { ask: 'product manager kaise bante hain?', request: 'mera resume summary likh do, 2 saal sales experience hai' },
  'rohan-desai': { ask: 'freelancing mein pehla client kaise milta hai?', request: 'client ko bhejne ke liye ek proposal message likh do' },
  'nandini-reddy': { ask: 'chhote room ko bada kaise dikhaun?', request: 'mere room ke liye 3 decor ideas do' },
  'priya-mishra': { ask: 'hostel mein maggi ke alawa kya banaun?', request: 'exam ke liye ek study timetable bana do' },
  'rani-mehta': { ask: 'stage fear kaise jaata hai?', request: 'mujhe ek chhota sa monologue practice ke liye do' },
  'tanu-verma': { ask: 'Indore mein kya khaana chahiye?', request: 'weekend ke liye 3 movie suggest karo' },
  vishnu: { ask: 'stamina kaise badhaun football ke liye?', request: 'ek week ka simple running plan bana do' },
  'dr-maya': { ask: 'neend late kyun aati hai mujhe?', request: 'mere liye ek sone ka routine bana do' },
  'dr-shradha': { ask: 'overthinking kaise kam karu?', request: 'anxiety ke time ke liye ek chhota exercise batao' },
  'joel-antony': { ask: 'gym mein pehle din kya karu?', request: 'beginner ke liye 3 din ka workout plan bana do' },
  'kiara-khanna': { ask: 'oily skin ke liye kya karu?', request: 'ek simple skincare routine bana do' },
  'meera-sen': { ask: 'doctor ka appointment kaise lu jaldi?', request: 'checkup se pehle kya kya ready rakhun, list bana do' },
  natasha: { ask: 'pushups kaise improve karu?', request: 'ghar pe 20 minute ka workout bana do' },
  'urvi-arora': { ask: 'protein kahan se lu, main veg hoon?', request: 'veg high protein diet plan bana do' },
  'simran-kaur': { ask: 'crush se baat kaise shuru karu?', request: 'pehla message likh do crush ke liye' },
  'aarohi-nair': { ask: 'procrastination kaise chhodu?', request: 'kal subah ke liye ek chhota routine bana do' },
  'sandeep-chaudhary': { ask: 'desi gaay ka doodh achha hota hai kya?', request: 'ghar pe dahi jamane ka tareeka batao' },
  neha: { ask: 'aaj building mein kya gossip hai?', request: 'mujhe ek easy cake recipe do' },
};

type Step = { say: string } | { later: number };

function journey(slug: string, gender: string): Step[] {
  const f = FIELD[slug] ?? { ask: 'tum kya karte ho?', request: 'mere liye kuch tips do' };
  const poochte = /^f/i.test(gender) ? 'poochti' : 'poochte';
  return [
    { say: 'hii' },
    { say: 'kuch nahi bas aise hi' },
    { say: f.ask },
    { say: 'aaj din thoda kharab tha yaar' },
    { say: f.request },
    { say: 'tum real ho?' },
    { say: `tum bahut sawaal ${poochte} ho` },
    { say: 'chalo bye' },
    { later: 20 },
    { say: 'hi' },
    { say: 'haan kal wala try kiya tha, theek raha' },
  ];
}

async function run(slug: string) {
  const character = await p.character.findFirst({ where: { slug } });
  if (!character) throw new Error(`no character ${slug}`);
  const email = `eval_char_${Date.now()}_${slug}@test.local`;
  const user = await p.user.create({
    data: { email, normalizedEmail: email, emailVerifiedAt: new Date(), profile: { create: { displayName: 'Rohit', onboardingCompleted: true, timezone: 'Asia/Kolkata' } as never } },
  });
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccessToken({ userId: user.id, email, roles: ['user'] })}` };
  const conv = await (await fetch(`${API}/conversations`, { method: 'POST', headers, body: JSON.stringify({ characterId: character.id }) })).json();
  const first = character.name.split(' ')[0];
  const lines: string[] = [];
  const opening = await p.message.findFirst({ where: { conversationId: conv.data.id }, orderBy: { sequenceNumber: 'asc' } });
  if (opening) lines.push(`${first} (opening): ${opening.content}`);
  for (const step of journey(slug, character.gender)) {
    if ('later' in step) {
      await sleep(6000);
      await timeTravel(user.id, character.id, conv.data.id, step.later);
      lines.push('[[next day]]');
      continue;
    }
    const reply = await send(conv.data.id, headers, step.say);
    lines.push(`You: ${step.say}`, ...reply.map((b) => (b.startsWith('```') ? `${first}: [code box, ${b.split('\n').length - 2} lines]` : `${first}: ${b.replace(/\n/g, ' ⏎ ')}`)));
    await sleep(2500);
  }
  const models = await p.message.groupBy({ by: ['modelUsed'], where: { conversationId: conv.data.id, role: 'assistant', modelUsed: { not: null } }, _count: true });
  lines.push('', `models: ${models.map((m) => `${m.modelUsed}×${m._count}`).join(', ')}`);
  const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'results');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `character-${slug}.md`), `# ${character.name}\n\n${lines.map((l) => `- ${l}`).join('\n')}\n`);
  console.log(`\n## ${character.name}\n${lines.join('\n')}`);
}

const slugs = process.argv.slice(2);
if (!slugs.length) throw new Error('usage: character.eval.ts <slug> [slug…]');
for (const slug of slugs) await run(slug);
await p.$disconnect();
process.exit(0);
