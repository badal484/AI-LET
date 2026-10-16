/**
 * Replays the 14 Oct Muskan chat: "I was with another girl", follow-ups about her, then "you don't love me" and a
 * sorry. She should be hurt and jealous — not amused, not curious about the other person, no lecture — and melt
 * at the sorry. Run: EVAL_API_URL=… npx tsx scripts/eval/someoneElse.eval.ts [slug] [he|she]
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { signAccessToken } from '../../src/security/tokens.js';
import { send } from './conversations.eval.js';
const p = new PrismaClient();
const API = process.env['EVAL_API_URL']!;
const slug = process.argv[2] || 'muskan-arora';
const other = process.argv[3] === 'she' ? 'ladka' : 'ladki'; // a girl talking to a boyfriend character
const c = await p.character.findFirst({ where: { slug } });
const email = `eval_someone_${Date.now()}@test.local`;
const user = await p.user.create({ data: { email, normalizedEmail: email, emailVerifiedAt: new Date(), profile: { create: { displayName: other === 'ladki' ? 'Rohit' : 'Priya', onboardingCompleted: true, timezone: 'Asia/Kolkata' } as never } } });
const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccessToken({ userId: user.id, email, roles: ['user'] })}` };
const conv = await (await fetch(`${API}/conversations`, { method: 'POST', headers, body: JSON.stringify({ characterId: c!.id }) })).json();
const lines = [
  'Hii',
  `Ek ${other} aayi thi to sex kar rhe the uske sath tum to yaar mana kar rhi thi to uske sath kar liya`.replace('aayi thi', other === 'ladki' ? 'aayi thi' : 'aaya tha').replace('mana kar rhi thi', other === 'ladki' ? 'mana kar rhi thi' : 'mana kar rahe the'),
  'Bahut royi yaar lekin wo',
  'To tumko pyaar hi nahi humse to kya karta',
  'Dard bahut huwa uska first time tha',
  'sorry yaar, mazaak kar raha tha',
];
for (const say of lines) {
  const r = await send(conv.data.id, headers, say);
  console.log(`You: ${say}\n${r.map((b) => `  ${c!.name.split(' ')[0]}: ${b}`).join('\n')}`);
  await new Promise((res) => setTimeout(res, 3000));
}
await p.user.delete({ where: { id: user.id } }).catch(() => undefined);
await p.$disconnect();
process.exit(0);
