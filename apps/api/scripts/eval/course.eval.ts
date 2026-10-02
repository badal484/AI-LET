/**
 * A learner takes a full course with a mentor: "X sikhao", their level, lessons, "done", a doubt,
 * "samajh nahi aaya", the lesson check, and coming back the next day. Prints the course progress after
 * every turn so you can see nothing was skipped. Reviewed by hand.
 *
 *   npx tsx scripts/eval/course.eval.ts [slug] ["javascript sikhao"]
 * Output: scripts/eval/results/course-<slug>.md
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { signAccessToken } from '../../src/security/tokens.js';
import { normalizeProfile } from '../../src/modules/memory/services/userProfile.service.js';
import { send, timeTravel } from './conversations.eval.js';

const p = new PrismaClient();
const API = process.env['EVAL_API_URL'] || 'http://localhost:4000/api/v1';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const slug = process.argv[2] || 'dev-bhatia';
const ask = process.argv[3] || 'mujhe javascript sikhao';

const steps: Array<{ say: string } | { later: number }> = [
  { say: ask },
  { say: 'bilkul zero hai, roz 1 ghanta de sakta hoon' },
  { say: '5 aaya' },
  { say: 'haan samajh gaya, aage' },
  { say: 'ek minute, Node.js aur browser mein farak kya hai exactly?' },
  { say: 'achha ok' },
  { say: 'install ho gaya, version bhi aa gaya' },
  { say: 'done, output bhi aa gaya' },
  { say: 'samajh nahi aaya ye wala' },
  { say: 'haan ab samajh aaya' },
  { say: 'syllabus dikhao, kahan tak pahunche?' },
  { later: 20 },
  { say: 'hi' },
  { say: 'chalo shuru karte hain' },
];

async function progress(userId: string, characterId: string): Promise<string> {
  const row = await p.userCharacterProfile.findUnique({ where: { userId_characterId: { userId, characterId } }, select: { data: true } });
  const c = normalizeProfile(row?.data).courses?.slice(-1)[0];
  return c ? `[progress: ${c.id} lesson ${c.lesson} · ${c.stage} · covered ${c.covered.join(',') || '-'} · done ${c.done.join(',') || '-'}${c.about ? ` · "${c.about}"` : ''}]` : '[progress: none]';
}

const character = await p.character.findFirst({ where: { slug } });
if (!character) throw new Error(`no character ${slug}`);
const email = `eval_course_${Date.now()}_${slug}@test.local`;
const user = await p.user.create({
  data: { email, normalizedEmail: email, emailVerifiedAt: new Date(), profile: { create: { displayName: 'Rohit', onboardingCompleted: true, timezone: 'Asia/Kolkata' } as never } },
});
const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccessToken({ userId: user.id, email, roles: ['user'] })}` };
const conv = await (await fetch(`${API}/conversations`, { method: 'POST', headers, body: JSON.stringify({ characterId: character.id }) })).json();
const first = character.name.split(' ')[0];
const lines: string[] = [];
for (const step of steps) {
  if ('later' in step) {
    await sleep(6000);
    await timeTravel(user.id, character.id, conv.data.id, step.later);
    lines.push('[[next day]]');
    continue;
  }
  const reply = await send(conv.data.id, headers, step.say);
  lines.push(`You: ${step.say}`, ...reply.map((b) => `${first}: ${b}`));
  await sleep(4000);
  lines.push(await progress(user.id, character.id), '');
  console.log(lines.slice(-reply.length - 3).join('\n'));
}
const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'results');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, `course-${slug}.md`), `# ${character.name} — course\n\n${lines.join('\n')}\n`);
await p.$disconnect();
process.exit(0);
