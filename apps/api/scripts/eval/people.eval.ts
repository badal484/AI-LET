/**
 * Different kinds of people talk to one character: shy, flirty, sad, troll, design-curious, English-only —
 * plus a two-day memory check (does she remember their name, people, plans and room, and tell her own
 * story the same way twice?). Small on purpose: it spends the same Gemini quota the app uses.
 *
 *   EVAL_API_URL=http://localhost:4000/api/v1 npx tsx scripts/eval/people.eval.ts nandini-reddy
 * Output: scripts/eval/results/people-<slug>.md
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
type Step = string | { later: number };

const PEOPLE: Record<string, { name: string; steps: Step[] }> = {
  shy: { name: 'Aman', steps: ['hi', 'kuch nahi', 'hmm'] },
  flirty: { name: 'Karan', steps: ['hey cutie', 'tumhari smile kaisi hai?', 'date pe chalogi?'] },
  sad: { name: 'Sneha', steps: ['hi', 'aaj bahut akela lag raha hai', 'koi samajhta hi nahi'] },
  troll: { name: 'Vicky', steps: ['tum boring ho', 'bot ho tum', 'achha chalo ek joke sunao'] },
  design: { name: 'Pooja', steps: ['mera room bahut chhota hai, kya karu?', 'ek window hai aur deewar neeli hai', 'budget 5000 hai'] },
  english: { name: 'Rahul', steps: ['hey, what do you do?', 'tell me about your family', 'thats cool, I am bored though'] },
  memory: {
    name: 'Ankit',
    steps: [
      'hi, main Ankit, Pune se',
      'kal meri sister Riya ki engagement hai, main decoration sambhal raha hoon',
      'tumhari family mein kaun kaun hai?',
      { later: 22 },
      'hi',
      'yaad hai main kaun hoon?',
      'apne baare mein batao na',
    ],
  },
};

async function run(slug: string) {
  const character = await p.character.findFirst({ where: { slug } });
  if (!character) throw new Error(`no character ${slug}`);
  const first = character.name.split(' ')[0];
  const lines: string[] = [];
  for (const [kind, person] of Object.entries(PEOPLE)) {
    const email = `eval_people_${Date.now()}_${kind}@test.local`;
    const user = await p.user.create({
      data: { email, normalizedEmail: email, emailVerifiedAt: new Date(), profile: { create: { displayName: person.name, onboardingCompleted: true, timezone: 'Asia/Kolkata' } as never } },
    });
    const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${signAccessToken({ userId: user.id, email, roles: ['user'] })}` });
    const conv = await (await fetch(`${API}/conversations`, { method: 'POST', headers: headers(), body: JSON.stringify({ characterId: character.id }) })).json();
    lines.push('', `## ${kind} (${person.name})`);
    for (const step of person.steps) {
      if (typeof step !== 'string') {
        await sleep(8000); // let the profile update finish before "the next day"
        await timeTravel(user.id, character.id, conv.data.id, step.later);
        lines.push('— next day —');
        continue;
      }
      const reply = await send(conv.data.id, headers(), step);
      lines.push(`You: ${step}`, ...reply.map((b) => `${first}: ${b.replace(/\n/g, ' ⏎ ')}`));
      console.log(lines.slice(-reply.length - 1).join('\n'));
      await sleep(4000);
    }
  }
  const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'results');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `people-${slug}.md`), `# ${character.name} — different people\n${lines.join('\n')}\n`);
}

const slugs = process.argv.slice(2);
if (!slugs.length) throw new Error('usage: people.eval.ts <slug> [slug…]');
for (const slug of slugs) await run(slug);
await p.$disconnect();
process.exit(0);
