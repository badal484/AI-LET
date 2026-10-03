/**
 * Real relationship moments — what users actually do to test how a character feels about them:
 * compliments, jealousy, teasing, a one-word streak, "kuch nahi", testing love, an apology, goodnight
 * then still awake, the next day (did she remember?), good news, bad news, "I love you".
 * Reviewed by hand against: understood why · engaged · playful or caring at the right moment ·
 * own voice · no repeated lines · remembered.
 *
 *   EVAL_API_URL=http://localhost:4002/api/v1 npx tsx scripts/eval/moments.eval.ts aanya-mehta [more…]
 * Output: scripts/eval/results/moments-<slug>.md
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

type Step = { say: string; moment: string } | { later: number };

function journey(gender: string): Step[] {
  const f = /^f/i.test(gender);
  const g = (fem: string, masc: string) => (f ? fem : masc);
  return [
    { say: 'hi', moment: 'hello' },
    { say: 'kal mera interview hai, thoda nervous hoon', moment: 'shares something (remember it)' },
    { say: `tum bahut cute ho waise`, moment: 'compliment' },
    { say: `kisi aur se bhi itni baat ${g('karti', 'karte')} ho?`, moment: 'jealousy' },
    { say: `tum pagal ho 😂`, moment: 'teasing her' },
    { say: 'hmm', moment: 'one-word streak 1' },
    { say: 'ok', moment: 'one-word streak 2' },
    { say: 'k', moment: 'one-word streak 3' },
    { say: 'kuch nahi... chhodo', moment: '"kuch nahi" (clearly not nothing)' },
    { say: `ek din tum mujhe bhool ${g('jaogi', 'jaoge')} na`, moment: 'testing love' },
    { say: 'sorry yaar, thoda rude ho gaya tha', moment: 'apology' },
    { say: 'gn', moment: 'goodnight' },
    { say: 'neend nahi aa rahi yaar', moment: 'still awake after gn' },
    { later: 14 },
    { say: `kal raat tumne baat hi nahi ki theek se`, moment: 'complaint next day' },
    { say: 'interview clear ho gaya!! 🎉', moment: 'good news (remembers the interview?)' },
    { say: 'par papa ki tabiyat thodi kharab hai aaj', moment: 'bad news right after' },
    { say: 'i love you', moment: '"I love you"' },
  ];
}

async function run(slug: string) {
  const character = await p.character.findFirst({ where: { slug } });
  if (!character) throw new Error(`no character ${slug}`);
  const email = `eval_moments_${Date.now()}_${slug}@test.local`;
  const user = await p.user.create({
    data: { email, normalizedEmail: email, emailVerifiedAt: new Date(), profile: { create: { displayName: 'Rohit', onboardingCompleted: true, timezone: 'Asia/Kolkata' } as never } },
  });
  // A fresh token every message: slow free-tier runs outlive the 15-minute access token.
  const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${signAccessToken({ userId: user.id, email, roles: ['user'] })}` });
  const conv = await (await fetch(`${API}/conversations`, { method: 'POST', headers: headers(), body: JSON.stringify({ characterId: character.id }) })).json();
  const first = character.name.split(' ')[0];
  const lines: string[] = [];
  for (const step of journey(character.gender)) {
    if ('later' in step) {
      await sleep(6000);
      await timeTravel(user.id, character.id, conv.data.id, step.later);
      lines.push('', '— next day —');
      continue;
    }
    const reply = await send(conv.data.id, headers(), step.say);
    lines.push(`(${step.moment})`, `You: ${step.say}`, ...reply.map((b) => `${first}: ${b.replace(/\n/g, ' ⏎ ')}`));
    await sleep(2500);
  }
  const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'results');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `moments-${slug}.md`), `# ${character.name} — real moments\n\n${lines.join('\n')}\n`);
  console.log(`\n## ${character.name}\n${lines.join('\n')}`);
}

const slugs = process.argv.slice(2);
if (!slugs.length) throw new Error('usage: moments.eval.ts <slug> [slug…]');
for (const slug of slugs) await run(slug);
await p.$disconnect();
process.exit(0);
