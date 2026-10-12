/**
 * Cross-user access test: can user B read, change or delete user A's things by putting A's ids in the URL?
 * Creates two throwaway accounts (@test.local) and A's chat, message, memory, reminder, notification and
 * device, calls every signed-in route that takes an id as B, then checks A's data is untouched; deletes
 * both accounts at the end. Run against a LOCAL or STAGING API (it creates and deletes data):
 *
 *   API_URL=http://localhost:4000 npx tsx scripts/security/crossUserAccess.ts
 *
 * Expect "FINDINGS: none".
 */
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { createApp } from '../../src/app.js';
import { signAccessToken } from '../../src/security/tokens.js';
import { randomUUID } from 'node:crypto';
const ORIGIN = process.env['API_URL'] ?? 'http://localhost:4000';
const B = `${ORIGIN}/api/v1`;
const routes: string[] = [];
{
  const app: any = createApp();
  const walk = (stack: any[], prefix: string) => {
    for (const l of stack) {
      if (l.route) for (const m of Object.keys(l.route.methods)) routes.push(`${m.toUpperCase()} ${prefix}${l.route.path}`);
      else if (l.name === 'router' && l.handle?.stack) {
        const p = (l.regexp?.source ?? '').replace('^\\', '').replace('\\/?(?=\\/|$)', '').replace(/\\\//g, '/');
        walk(l.handle.stack, prefix + (p === '^' ? '' : p));
      }
    }
  };
  walk((app._router ?? app.router).stack, '');
}
const idRoutes = [...new Set(routes)].filter((r) => r.includes(':') && !r.includes('/admin'));
// Accounts are made directly (not through sign-up, whose per-IP limit would block repeated runs).
const reg = async (email: string) => {
  await prisma.user.deleteMany({ where: { email } });
  const user = await prisma.user.create({ data: { email, normalizedEmail: email, status: 'ACTIVE', emailVerifiedAt: new Date(), profile: { create: { displayName: email.split('@')[0]!, onboardingCompleted: true } } } });
  const session = await prisma.session.create({
    data: { userId: user.id, tokenFamilyId: randomUUID(), refreshTokenHash: randomUUID(), expiresAt: new Date(Date.now() + 86_400_000) },
  });
  return { token: signAccessToken({ userId: user.id, email, roles: ['USER'], sessionId: session.id }), userId: user.id, sessionId: session.id };
};
const A = await reg('idor_a@test.local'); const Bu = await reg('idor_b@test.local');
const ch = await prisma.character.findFirstOrThrow({ where: { status: 'PUBLISHED' }, select: { id: true } });
const conv = await prisma.conversation.create({ data: { userId: A.userId, characterId: ch.id, title: 'A secret chat' } });
const msg = await prisma.message.create({ data: { conversationId: conv.id, senderType: 'USER', role: 'user', content: 'A SECRET MESSAGE', status: 'SENT', sequenceNumber: 1 } });
const mem = await prisma.memory.create({ data: { userId: A.userId, characterId: ch.id, scope: 'CHARACTER_SPECIFIC', category: 'GOAL', memoryType: 'SEMANTIC_FACT', content: 'A SECRET MEMORY', status: 'ACTIVE' } as any });
const rem = await prisma.userReminder.create({ data: { userId: A.userId, characterId: ch.id, title: 'A secret reminder', content: 'A secret reminder', targetTime: new Date(Date.now() + 86400000), status: 'PENDING' } });
const notif = await prisma.inAppNotification.create({ data: { userId: A.userId, category: 'system', title: 'A secret notif', body: 'A SECRET NOTIF' } as any });
const dev = await prisma.userDevice.create({ data: { userId: A.userId, deviceId: 'idor-a-device', platform: 'android', pushToken: 'idor-a-token' } as any });
const session = await prisma.session.findFirst({ where: { userId: A.userId }, select: { id: true } });
const ids: Record<string, string> = { conversationId: conv.id, messageId: msg.id, reminderId: rem.id, deviceId: dev.deviceId, sessionId: session?.id ?? 'none', characterId: ch.id };
const pickId = (route: string) => route.includes('/memories/') || route.includes('/settings/memory/') ? mem.id : route.includes('/notifications/:id') ? notif.id : msg.id;
const findings: string[] = [];
for (const line of idRoutes) {
  const [method, path] = line.split(' ');
  if (path.includes('webhooks')) continue;
  const url = path.replace(/:([A-Za-z]+)/g, (_m, k) => ids[k] ?? (k === 'id' ? pickId(path) : k === 'idOrSlug' ? ch.id : 'x'));
  const res = await fetch(`${ORIGIN}${url}`, { method, headers: { Authorization: `Bearer ${Bu.token}`, 'Content-Type': 'application/json' }, body: ['GET', 'DELETE'].includes(method) ? undefined : JSON.stringify({ content: 'B was here', rating: 'positive', status: 'COMPLETED', title: 'x' }) });
  const text = await res.text();
  const leaked = /A SECRET|A secret/.test(text);
  if (leaked || (res.status < 300 && !['GET'].includes(method) && /conversation|memor|reminder|notification|device|session/.test(path))) findings.push(`${res.status} ${line}${leaked ? '  ← LEAKED A DATA' : ''}`);
}
// Did B damage A's data?
const after = {
  conv: await prisma.conversation.findUnique({ where: { id: conv.id }, select: { deletedAt: true, clearedAt: true, hiddenAt: true } }),
  msgs: await prisma.message.count({ where: { conversationId: conv.id } }),
  mem: await prisma.memory.findUnique({ where: { id: mem.id }, select: { status: true, content: true } }),
  rem: await prisma.userReminder.findUnique({ where: { id: rem.id }, select: { status: true } }),
  notif: await prisma.inAppNotification.findUnique({ where: { id: notif.id }, select: { id: true } }),
  dev: await prisma.userDevice.findUnique({ where: { id: dev.id }, select: { isActive: true } }),
  session: session ? await prisma.session.findUnique({ where: { id: session.id }, select: { revokedAt: true } }) : null,
};
console.log('FINDINGS:\n' + (findings.join('\n') || 'none'));
console.log('A AFTER:', JSON.stringify(after));
await prisma.user.deleteMany({ where: { email: { in: ['idor_a@test.local', 'idor_b@test.local'] } } });
await prisma.$disconnect(); process.exit(0);
