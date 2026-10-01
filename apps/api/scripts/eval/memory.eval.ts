/**
 * Memory evaluation: does a character remember the user like a close friend, across sessions?
 *
 * Day 1 the user shares their job, a family event with a date, a favourite thing, and a joke forms.
 * Then time passes (chat history AND the saved event dates move back), and the user just says "hi".
 * We print the "who they are" card she built, and the transcripts:
 *   - does she ask about the event once it has happened? remember the job? bring back the joke?
 *   - does she avoid false memories (her own stories never become the user's)?
 *
 * Usage (API must be running): npx tsx scripts/eval/memory.eval.ts v1 [character-slug]
 * Output: scripts/eval/results/memory.<label>.md
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { signAccessToken } from '../../src/security/tokens.js';
import { redis } from '../../src/infrastructure/redis/redis.js';
import { send, timeTravel } from './conversations.eval.js';
import { formatProfile, localToday, normalizeProfile } from '../../src/modules/memory/services/userProfile.service.js';

type Step = { say: string } | { later: number; note: string } | { card: true };
interface Journey {
  slug: string;
  id: string;
  title: string;
  steps: Step[];
}

const JOURNEYS: Journey[] = [
  {
    slug: 'kabir-sethi',
    id: 'kabir-wedding',
    title: "Sister's wedding, job and a joke — then 16 days later",
    steps: [
      { say: 'hey kabir, main Rohit' },
      { say: 'main Pune mein software engineer hoon, aaj office mein bahut kaam tha' },
      { say: 'aur suno, meri didi Pooja ki shaadi 15 tareekh ko hai, bahut kaam hai ghar pe' },
      { say: 'haha mera laptop itna purana hai ki shayad mujhse bhi bada hai' },
      { say: 'momos mera sabse favourite khana hai yaar' },
      { card: true },
      { later: 16 * 24, note: '16 days later (the wedding was 2 days ago)' },
      { say: 'hi' },
      { say: 'haan sab badhiya raha' },
      { say: 'aaj kya khaun samajh nahi aa raha' },
    ],
  },
  {
    slug: 'priya-mishra',
    id: 'priya-birthday',
    title: 'Birthday mentioned in passing — then on the day',
    steps: [
      { say: 'hi priya, main Sneha, Indore se hoon, B.Tech final year' },
      { say: 'mera birthday 5 October ko hai, koi plan nahi hai abhi tak' },
      { say: 'mujhe chai se zyada coffee pasand hai' },
      { card: true },
      { later: 4 * 24, note: '4 days later (it is her birthday today)' },
      { say: 'hii' },
    ],
  },
  {
    slug: 'neha',
    id: 'neha-false-memory',
    title: 'Her stories must not become the user\'s',
    steps: [
      { say: 'hi neha' },
      { say: 'aaj kya kiya aapne?' },
      { say: 'achha' },
      { say: 'matlab' },
      { card: true },
    ],
  },
];

const p = new PrismaClient();
const API = process.env['EVAL_API_URL'] || 'http://localhost:4000/api/v1';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Move saved event dates back, as if that much real time had passed. */
async function shiftEvents(userId: string, characterId: string, hours: number) {
  const row = await p.userCharacterProfile.findUnique({ where: { userId_characterId: { userId, characterId } } });
  if (!row) return;
  const profile = normalizeProfile(row.data);
  const days = Math.round(hours / 24);
  for (const e of profile.events) {
    const d = new Date(`${e.date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - days);
    e.date = d.toISOString().slice(0, 10);
  }
  await p.userCharacterProfile.update({ where: { id: row.id }, data: { data: profile as unknown as object } });
}

async function main() {
  const [label = 'run', only] = process.argv.slice(2);
  const out: string[] = [`# Memory conversations (${label})`, ''];
  for (const j of JOURNEYS) {
    if (only && only !== j.slug) continue;
    const character = await p.character.findFirst({ where: { slug: j.slug } });
    if (!character) throw new Error(`character not found: ${j.slug}`);
    const first = character.name.replace(/^Dr\.?\s*/i, '').split(' ')[0];
    const email = `eval_memory_${label}_${j.id}_${Date.now().toString(36)}@test.local`;
    const user = await p.user.create({
      data: { email, normalizedEmail: email, emailVerifiedAt: new Date(), profile: { create: { displayName: 'Friend', onboardingCompleted: true, timezone: 'Asia/Kolkata' } as never } },
    });
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccessToken({ userId: user.id, email, roles: ['user'] })}` };
    const conv = await (await fetch(`${API}/conversations`, { method: 'POST', headers, body: JSON.stringify({ characterId: character.id }) })).json();
    const lines: string[] = [];
    for (const step of j.steps) {
      if ('say' in step) {
        const reply = await send(conv.data.id, headers, step.say);
        lines.push(`- You: ${step.say}`, ...reply.map((b) => `- ${first}: ${b.replace(/\n/g, ' ⏎ ')}`));
        await sleep(3500);
      } else if ('card' in step) {
        await sleep(12000); // the card updates in the background after each reply
        const row = await p.userCharacterProfile.findUnique({ where: { userId_characterId: { userId: user.id, characterId: character.id } } });
        const card = row ? formatProfile(normalizeProfile(row.data), localToday('Asia/Kolkata').date) : '(empty)';
        lines.push('', '**Card she built:**', '```', card || '(empty)', '```', '');
      } else {
        await timeTravel(user.id, character.id, conv.data.id, step.later);
        await shiftEvents(user.id, character.id, step.later);
        lines.push(`- [[time passes: ${step.note}]]`);
      }
    }
    out.push(`## ${character.name} — ${j.title}`, '', ...lines, '');
    console.log(`\n## ${character.name} — ${j.title}\n${lines.join('\n')}`);
  }
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'results');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `memory.${label}.md`), out.join('\n'));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await p.$disconnect();
    redis.disconnect();
    process.exit(process.exitCode ?? 0);
  });
