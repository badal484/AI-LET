/** Language check after prompt changes: an English speaker gets English, a Hinglish speaker Hinglish. Run: npx tsx scripts/eval/language.eval.ts (needs an API on :4001). */
import 'dotenv/config';
const { PrismaClient } = await import('@prisma/client');
const { signAccessToken } = await import('../../src/security/tokens.js');
const { send } = await import('./conversations.eval.js');
const p = new PrismaClient(); const API = process.env['EVAL_API_URL'] || 'http://localhost:4001/api/v1';
for (const [slug, lines] of [['kabir-sethi', ['hey', 'long day at work, my manager kept changing the deadline', 'what are you doing tonight?']], ['muskan-arora', ['hii', 'aaj bahut thak gaya yaar office mein', 'tum kya kar rahi ho?']]] as const) {
  const c = await p.character.findFirst({ where: { slug } }); const email = `eval_lang_${Date.now()}@test.local`;
  const u = await p.user.create({ data: { email, normalizedEmail: email, emailVerifiedAt: new Date(), profile: { create: { displayName: 'Ana', onboardingCompleted: true, timezone: 'Asia/Kolkata' } as never } } });
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccessToken({ userId: u.id, email, roles: ['user'] })}` };
  const conv = await (await fetch(`${API}/conversations`, { method: 'POST', headers, body: JSON.stringify({ characterId: c!.id }) })).json();
  console.log(`=== ${slug}`);
  for (const say of lines) { const r = await send(conv.data.id, headers, say); console.log(`You: ${say}\n${r.map((b: string) => `  ${c!.name.split(' ')[0]}: ${b}`).join('\n')}`); await new Promise((r) => setTimeout(r, 2500)); }
  await p.user.delete({ where: { id: u.id } }).catch(() => undefined);
}
process.exit(0);
