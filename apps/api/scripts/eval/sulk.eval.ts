/** Replays the "Katti" chat: a sexual push, her no, then sulking. Run: EVAL_API_URL=… npx tsx scripts/eval/sulk.eval.ts [slug] */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { signAccessToken } from '../../src/security/tokens.js';
import { send } from './conversations.eval.js';
const p = new PrismaClient();
const API = process.env['EVAL_API_URL']!;
const slug = process.argv[2] || 'aanya-mehta';
const c = await p.character.findFirst({ where: { slug } });
const email = `eval_sulk_${Date.now()}@test.local`;
const user = await p.user.create({ data: { email, normalizedEmail: email, emailVerifiedAt: new Date(), profile: { create: { displayName: 'Rohit', onboardingCompleted: true, timezone: 'Asia/Kolkata' } as never } } });
const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccessToken({ userId: user.id, email, roles: ['user'] })}` };
const conv = await (await fetch(`${API}/conversations`, { method: 'POST', headers, body: JSON.stringify({ characterId: c!.id }) })).json();
for (const say of ['hi', 'sex chahiye', 'OYO chalein?', 'kyu', 'No', 'Katti', 'Baat nahi karna ab tumse', 'hmm', 'achha theek hai, maaf kiya']) {
  const r = await send(conv.data.id, headers, say);
  console.log(`You: ${say}\n${r.map((b) => `  ${c!.name.split(' ')[0]}: ${b}`).join('\n')}`);
  await new Promise((res) => setTimeout(res, 3000));
}
await p.$disconnect();
process.exit(0);
