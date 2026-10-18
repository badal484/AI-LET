import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { AccountDeletionService } from '../src/modules/privacy/services/AccountDeletionService.js';
import { createCharacter, createConversation, createUser } from './fixtures.js';

/**
 * Account deletion end to end (a promise to users — DPDP Act, Google Play — audit H-7): the request waits out its
 * grace period, then the scheduled job deletes the account's chats and locks it for good. Cancelling in the grace
 * period keeps everything.
 */
describe('account deletion pipeline', () => {
  const app = createApp();

  async function userWithChat() {
    const user = await createUser({ verified: true });
    const character = await createCharacter();
    const { conversationId } = await createConversation(user.id, character.id, [
      ['USER', 'hii'],
      ['CHARACTER', 'hello!'],
    ]);
    const { email } = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { email: true } });
    return { ...user, email, conversationId };
  }
  const due = (userId: string) => prisma.accountDeletionRequest.updateMany({ where: { userId }, data: { scheduledFor: new Date(Date.now() - 60_000) } });

  it('waits out the grace period, then deletes the chats and locks the account', async () => {
    const u = await userWithChat();
    const auth = { Authorization: `Bearer ${u.token}` };
    const req = await request(app).post('/api/v1/privacy/delete-account').set(auth).send({ confirmEmail: u.email, reason: 'test' });
    expect(req.status).toBe(202);

    await AccountDeletionService.processDue(50);
    expect(await prisma.conversation.count({ where: { userId: u.id } })).toBe(1); // still in the grace period

    await due(u.id);
    await AccountDeletionService.processDue(50);
    const r = await prisma.accountDeletionRequest.findFirstOrThrow({ where: { userId: u.id } });
    expect(r.status).toBe('COMPLETED');
    const user = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(user.status).toBe('DELETED');
    expect(user.passwordHash).toBeNull();
    expect(await prisma.conversation.count({ where: { userId: u.id } })).toBe(0);
    expect(await prisma.message.count({ where: { conversationId: u.conversationId } })).toBe(0);
    expect([401, 403]).toContain((await request(app).get('/api/v1/auth/me').set(auth)).status); // its sign-in no longer works
  });

  it('cancelling during the grace period keeps the account and its chats', async () => {
    const u = await userWithChat();
    const auth = { Authorization: `Bearer ${u.token}` };
    expect((await request(app).post('/api/v1/privacy/delete-account').set(auth).send({ confirmEmail: u.email })).status).toBe(202);
    expect((await request(app).delete('/api/v1/privacy/delete-account').set(auth)).status).toBe(200);
    await due(u.id);
    await AccountDeletionService.processDue(50);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).status).not.toBe('DELETED');
    expect(await prisma.conversation.count({ where: { userId: u.id } })).toBe(1);
  });
});
