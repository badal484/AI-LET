import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { signAccessToken } from '../../src/security/tokens.js';

/**
 * "Clear chat" / "Delete chat": gone from your screen, she still remembers (like real life).
 * "Start fresh": she truly forgets you.
 */
describe('Clear chat and Start fresh', () => {
  const app = createApp();
  const tag = `cf${Date.now().toString(36)}`;
  let characterId: string;

  async function newUser(name: string) {
    const email = `${tag}-${name}@example.com`;
    const user = await prisma.user.create({ data: { email, normalizedEmail: email, passwordHash: 'x', profile: { create: { displayName: name } } } });
    return { id: user.id, token: signAccessToken({ userId: user.id, email, roles: ['USER'] }) };
  }

  async function chatWithMemories(user: { id: string; token: string }) {
    const res = await request(app).post('/api/v1/conversations').set('Authorization', `Bearer ${user.token}`).send({ characterId });
    const conversationId: string = res.body.data.id;
    const last = await prisma.message.findFirst({ where: { conversationId }, orderBy: { sequenceNumber: 'desc' } });
    let seq = (last?.sequenceNumber ?? 0) + 1;
    for (const [role, content] of [['user', 'kal mera interview hai'], ['assistant', 'all the best! 🤍']] as const) {
      await prisma.message.create({
        data: { conversationId, role, content, senderType: role === 'user' ? 'USER' : 'CHARACTER', status: role === 'user' ? 'SENT' : 'COMPLETED', sequenceNumber: seq++ },
      });
    }
    await prisma.memory.create({
      data: { userId: user.id, characterId, conversationId, scope: 'CHARACTER_SPECIFIC', category: 'IMPORTANT_EVENT', content: 'The user has an interview tomorrow.', status: 'ACTIVE', importanceScore: 0.9, confidenceScore: 0.9 },
    });
    await prisma.userCharacterProfile.create({ data: { userId: user.id, characterId, data: { facts: ['interview tomorrow'] } } });
    await prisma.relationship.create({ data: { userId: user.id, characterId, stage: 'FRIEND' } });
    return conversationId;
  }

  const messagesOf = async (token: string, conversationId: string) =>
    (await request(app).get(`/api/v1/conversations/${conversationId}/messages`).set('Authorization', `Bearer ${token}`)).body.data as Array<{ content: string }>;
  const listOf = async (token: string) => ((await request(app).get('/api/v1/conversations').set('Authorization', `Bearer ${token}`)).body.data as Array<{ id: string }>).map((c) => c.id);

  beforeAll(async () => {
    const character = await prisma.character.create({
      data: {
        slug: `${tag}-luna`, internalKey: `${tag}_luna`, name: 'Luna', tagline: 't', shortDescription: 's', longDescription: 'l',
        avatarUrl: 'https://cdn.example.com/a.png', coverImageUrl: 'https://cdn.example.com/c.png', category: 'love', archetype: 'Friend',
        backstory: 'b', age: 24, gender: 'female', occupation: 'Artist', status: 'PUBLISHED', visibility: 'PUBLIC',
      },
    });
    characterId = character.id;
    const version = await prisma.characterVersion.create({
      data: {
        characterId, versionNumber: 1, status: 'PUBLISHED', identityData: { name: 'Luna' }, personalityData: {}, communicationData: { initialGreeting: 'Hi! Main Luna 🙂' },
        languageData: {}, behaviorRulesData: [], knowledgeData: [], relationshipConfigData: {}, memoryConfigData: {}, proactivityConfigData: {}, safetyConfigData: {}, aiConfigData: {}, changeSummary: 'Initial release',
      },
    });
    await prisma.character.update({ where: { id: characterId }, data: { currentPublishedVersionId: version.id } });
  });

  it('Clear chat: gone from their screen, but she still remembers', async () => {
    const user = await newUser('clear');
    const conversationId = await chatWithMemories(user);
    expect((await messagesOf(user.token, conversationId)).length).toBeGreaterThan(0);

    const res = await request(app).post(`/api/v1/conversations/${conversationId}/clear`).set('Authorization', `Bearer ${user.token}`).send({});
    expect(res.status).toBe(200);
    expect(await messagesOf(user.token, conversationId)).toHaveLength(0);
    // Her memory is untouched: messages, memories, profile, bond.
    expect(await prisma.message.count({ where: { conversationId } })).toBeGreaterThan(0);
    expect(await prisma.memory.count({ where: { userId: user.id, characterId } })).toBe(1);
    expect(await prisma.userCharacterProfile.count({ where: { userId: user.id, characterId } })).toBe(1);
    expect((await prisma.relationship.findFirst({ where: { userId: user.id, characterId } }))?.stage).toBe('FRIEND');
    // Still in the Chats list.
    expect(await listOf(user.token)).toContain(conversationId);
  });

  it('Delete chat from the Chats tab: off the list too, until a new message brings it back', async () => {
    const user = await newUser('hide');
    const conversationId = await chatWithMemories(user);
    await request(app).post(`/api/v1/conversations/${conversationId}/clear`).set('Authorization', `Bearer ${user.token}`).send({ removeFromList: true });
    expect(await listOf(user.token)).not.toContain(conversationId);
    expect(await prisma.memory.count({ where: { userId: user.id, characterId } })).toBe(1);

    // She texts first (or they message her): the chat is back, showing only the new message.
    await prisma.conversation.update({ where: { id: conversationId }, data: { hiddenAt: null, lastMessageAt: new Date() } });
    const last = await prisma.message.findFirst({ where: { conversationId }, orderBy: { sequenceNumber: 'desc' } });
    await prisma.message.create({ data: { conversationId, role: 'assistant', content: 'interview kaisa gaya?', senderType: 'CHARACTER', status: 'COMPLETED', sequenceNumber: last!.sequenceNumber + 1 } });
    expect(await listOf(user.token)).toContain(conversationId);
    expect((await messagesOf(user.token, conversationId)).map((m) => m.content)).toEqual(['interview kaisa gaya?']);
  });

  it('Start fresh: she forgets everything about them — and nobody else', async () => {
    const user = await newUser('fresh');
    const other = await newUser('other');
    const conversationId = await chatWithMemories(user);
    await chatWithMemories(other);

    const forbidden = await request(app).post(`/api/v1/conversations/${conversationId}/start-fresh`).set('Authorization', `Bearer ${other.token}`).send({});
    expect(forbidden.status).toBe(403);

    const res = await request(app).post(`/api/v1/conversations/${conversationId}/start-fresh`).set('Authorization', `Bearer ${user.token}`).send({});
    expect(res.status).toBe(200);
    expect(await prisma.conversation.count({ where: { id: conversationId } })).toBe(0);
    expect(await prisma.message.count({ where: { conversationId } })).toBe(0);
    expect(await prisma.memory.count({ where: { userId: user.id, characterId } })).toBe(0);
    expect(await prisma.userCharacterProfile.count({ where: { userId: user.id, characterId } })).toBe(0);
    expect(await prisma.relationship.count({ where: { userId: user.id, characterId } })).toBe(0);
    // The other user's chat with her is untouched.
    expect(await prisma.memory.count({ where: { userId: other.id, characterId } })).toBe(1);
    expect(await prisma.relationship.count({ where: { userId: other.id, characterId } })).toBe(1);

    // Opening her again is a first meeting.
    const again = await request(app).post('/api/v1/conversations').set('Authorization', `Bearer ${user.token}`).send({ characterId });
    expect(again.body.data.id).not.toBe(conversationId);
    expect((await messagesOf(user.token, again.body.data.id)).map((m) => m.content)).toEqual(['Hi! Main Luna 🙂']);
  });
});
