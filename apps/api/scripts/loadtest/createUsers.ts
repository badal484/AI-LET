/**
 * Test users for the load test (infrastructure/load-tests/chat.k6.js). Run against STAGING, not production.
 *
 *   npx tsx scripts/loadtest/createUsers.ts 200 > /tmp/lt-users.json
 *
 * Creates loadtest_<n>@test.local (hidden from all admin numbers), each with a chat with one character,
 * and prints [{ token, conversationId }]. Tokens last 15 minutes — create them right before the run.
 * Remove them afterwards with:  npx tsx scripts/loadtest/createUsers.ts --delete
 */
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { signAccessToken } from '../../src/security/tokens.js';

const arg = process.argv[2] ?? '50';

if (arg === '--delete') {
  const r = await prisma.user.deleteMany({ where: { email: { startsWith: 'loadtest_', endsWith: '@test.local' } } });
  console.error(`Deleted ${r.count} load-test users.`);
} else {
  const n = Math.min(2000, Math.max(1, Number(arg)));
  const characters = await prisma.character.findMany({ where: { status: 'PUBLISHED', deletedAt: null }, select: { id: true }, take: 20 });
  if (!characters.length) throw new Error('No published characters.');
  const out: Array<{ token: string; conversationId: string }> = [];
  for (let i = 0; i < n; i++) {
    const email = `loadtest_${i}@test.local`;
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, normalizedEmail: email, status: 'ACTIVE', profile: { create: { displayName: `Load ${i}`, onboardingCompleted: true } } },
      select: { id: true },
    });
    const characterId = characters[i % characters.length]!.id;
    const conv = await prisma.conversation.upsert({
      where: { userId_characterId: { userId: user.id, characterId } },
      update: {},
      create: { userId: user.id, characterId, title: 'Load test' },
      select: { id: true },
    });
    out.push({ token: signAccessToken({ userId: user.id, email, roles: ['USER'] }), conversationId: conv.id });
  }
  console.log(JSON.stringify(out));
  console.error(`${n} load-test users ready (tokens valid 15 min).`);
}
await prisma.$disconnect();
process.exit(0);
