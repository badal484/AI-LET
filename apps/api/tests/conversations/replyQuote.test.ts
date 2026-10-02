import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { signAccessToken } from '../../src/security/tokens.js';

/** WhatsApp-style "reply to this message". */
describe('Reply to a specific message', () => {
  const app = createApp();
  const tag = `rq${Date.now().toString(36)}`;
  let token: string;
  let conversationId: string;
  let otherConversationId: string;
  let herTaskId: string;
  let foreignMessageId: string;

  async function seedMessage(convId: string, role: 'user' | 'assistant', content: string) {
    const last = await prisma.message.findFirst({ where: { conversationId: convId }, orderBy: { sequenceNumber: 'desc' } });
    return prisma.message.create({
      data: { conversationId: convId, role, content, senderType: role === 'user' ? 'USER' : 'CHARACTER', status: role === 'user' ? 'SENT' : 'COMPLETED', sequenceNumber: (last?.sequenceNumber ?? 0) + 1 },
    });
  }

  beforeAll(async () => {
    const email = `${tag}@example.com`;
    const user = await prisma.user.create({ data: { email, normalizedEmail: email, passwordHash: 'x', profile: { create: { displayName: 'Rohit' } } } });
    token = signAccessToken({ userId: user.id, email, roles: ['USER'] });
    const mk = async (slug: string) => {
      const c = await prisma.character.create({
        data: {
          slug: `${tag}-${slug}`, internalKey: `${tag}_${slug}`, name: slug, tagline: 't', shortDescription: 's', longDescription: 'l',
          avatarUrl: 'https://cdn.example.com/a.png', coverImageUrl: 'https://cdn.example.com/c.png', category: 'learn-earn', archetype: 'Mentor',
          backstory: 'b', age: 26, gender: 'male', occupation: 'Engineer', status: 'PUBLISHED', visibility: 'PUBLIC',
        },
      });
      const v = await prisma.characterVersion.create({
        data: {
          characterId: c.id, versionNumber: 1, status: 'PUBLISHED', identityData: { name: slug }, personalityData: {}, communicationData: {}, languageData: {},
          behaviorRulesData: [], knowledgeData: [], relationshipConfigData: {}, memoryConfigData: {}, proactivityConfigData: {}, safetyConfigData: {}, aiConfigData: {}, changeSummary: 'Initial',
        },
      });
      await prisma.character.update({ where: { id: c.id }, data: { currentPublishedVersionId: v.id } });
      const res = await request(app).post('/api/v1/conversations').set('Authorization', `Bearer ${token}`).send({ characterId: c.id });
      return res.body.data.id as string;
    };
    conversationId = await mk('dev');
    otherConversationId = await mk('other');
    herTaskId = (await seedMessage(conversationId, 'assistant', 'is hafte ka pehla task: apne laptop pe Node.js install karke check karo')).id;
    foreignMessageId = (await seedMessage(otherConversationId, 'assistant', 'a message from another chat')).id;
  });

  const history = async () =>
    (await request(app).get(`/api/v1/conversations/${conversationId}/messages`).set('Authorization', `Bearer ${token}`)).body.data as Array<{
      content: string;
      replyTo?: { id: string; role: string; snippet: string; available: boolean } | null;
    }>;

  it('saves which message they replied to and shows the quote in history', async () => {
    await request(app)
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .set('Accept', 'text/event-stream')
      .send({ content: 'Samjha nahi kaise karna h', clientRequestId: `${tag}-1`, replyToMessageId: herTaskId });
    const mine = (await history()).find((m) => m.content === 'Samjha nahi kaise karna h');
    expect(mine?.replyTo).toEqual({ id: herTaskId, role: 'assistant', snippet: 'is hafte ka pehla task: apne laptop pe Node.js install karke check karo', available: true });
  });

  it('ignores a quote of a message from another chat', async () => {
    await request(app)
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .set('Accept', 'text/event-stream')
      .send({ content: 'ye kya tha', clientRequestId: `${tag}-2`, replyToMessageId: foreignMessageId });
    const mine = (await history()).find((m) => m.content === 'ye kya tha');
    expect(mine?.replyTo ?? null).toBeNull();
  });

  it('a quoted message that was cleared shows as unavailable', async () => {
    await prisma.conversation.update({ where: { id: conversationId }, data: { clearedAt: new Date() } });
    await request(app)
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .set('Accept', 'text/event-stream')
      .send({ content: 'woh wala task', clientRequestId: `${tag}-3`, replyToMessageId: herTaskId });
    const mine = (await history()).find((m) => m.content === 'woh wala task');
    expect(mine?.replyTo).toMatchObject({ id: herTaskId, available: false, snippet: '' });
  });
});
