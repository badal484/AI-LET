/**
 * A quick live chat with one character, as a new user. Messages come from the command line; "+22" means
 * "22 hours later". Prints what she remembered at the end (her shared stories, the shared project, their style).
 * Small on purpose — it spends the same Gemini quota the app uses.
 *
 *   npx tsx scripts/eval/chat.eval.ts ritika-sharma "hi" "tumhara type kya hai?" +22 "kaisi ho aaj?"
 *   EVAL_STAGE=CONFIDANT … starts them already close.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { signAccessToken } from '../../src/security/tokens.js';
import { send, timeTravel } from './conversations.eval.js';

const p = new PrismaClient();
const API = process.env['EVAL_API_URL'] || 'http://localhost:4000/api/v1';
const [slug, ...steps] = process.argv.slice(2);
if (!slug || !steps.length) throw new Error('usage: chat.eval.ts <slug> "message" [+hours] …');

const character = await p.character.findFirst({ where: { slug } });
if (!character) throw new Error(`no character ${slug}`);
const first = character.name.split(' ')[0];
const email = `eval_chat_${Date.now()}_${slug}@test.local`;
const user = await p.user.create({
  data: { email, normalizedEmail: email, emailVerifiedAt: new Date(), profile: {
      create: {
        displayName: process.env['EVAL_NAME'] || 'Rohit',
        onboardingCompleted: true,
        timezone: 'Asia/Kolkata',
        // EVAL_GENDER=male|female|unspecified and EVAL_LANG=en|hinglish|hi act like the onboarding choices.
        ...(process.env['EVAL_GENDER'] && { userGender: process.env['EVAL_GENDER'] }),
        ...(process.env['EVAL_LANG'] && { preferredLanguage: process.env['EVAL_LANG'], onboardingCompletedSteps: ['WELCOME', 'LANGUAGE'] }),
      } as never,
    },
  },
});
const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${signAccessToken({ userId: user.id, email, roles: ['user'] })}` });
const conv = await (await fetch(`${API}/conversations`, { method: 'POST', headers: headers(), body: JSON.stringify({ characterId: character.id }) })).json();
// EVAL_STAGE=CONFIDANT starts them already close (to test what changes when they are).
if (process.env['EVAL_STAGE']) {
  const close = { stage: process.env['EVAL_STAGE'] as never, familiarity: 80, trust: 85, comfort: 85, affection: 85, engagement: 85, totalInteractions: 300, consecutiveDaysActive: 30 };
  await p.relationship.upsert({ where: { userId_characterId: { userId: user.id, characterId: character.id } }, create: { userId: user.id, characterId: character.id, ...close }, update: close });
}

for (const step of steps) {
  const later = /^\+(\d+)$/.exec(step);
  if (later) {
    await new Promise((r) => setTimeout(r, 9000)); // let the background memory update finish first
    await timeTravel(user.id, character.id, conv.data.id, Number(later[1]));
    console.log(`— ${later[1]} hours later —`);
    continue;
  }
  const reply = await send(conv.data.id, headers(), step);
  console.log(`You: ${step}\n${reply.map((b) => `  ${first}: ${b.replace(/\n/g, ' ⏎ ')}`).join('\n')}`);
  await new Promise((r) => setTimeout(r, 4000));
}
await new Promise((r) => setTimeout(r, 8000));
const data = (await p.userCharacterProfile.findFirst({ where: { userId: user.id } }))?.data as Record<string, unknown> | undefined;
console.log(`\nShe remembers → her stories: ${JSON.stringify(data?.['herShared'] ?? [])} | project: ${JSON.stringify(data?.['project'] ?? null)} | their style: ${JSON.stringify(data?.['style'] ?? null)}`);
await p.$disconnect();
process.exit(0);
