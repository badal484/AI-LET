import crypto from 'crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { createCharacter, createUser } from '../social/fixtures.js';

const app = createApp();

function sse(text: string) {
  return text
    .split('\n\n')
    .map(block => ({ event: /event: (.*)/.exec(block)?.[1], data: /data: (.*)/.exec(block)?.[1] }))
    .filter(e => e.event)
    .map(e => ({ event: e.event!, data: e.data ? JSON.parse(e.data) : null }));
}

async function setup() {
  const u = await createUser();
  const ch = await createCharacter();
  const version = await prisma.characterVersion.create({
    data: {
      characterId: ch.id,
      versionNumber: 1,
      status: 'PUBLISHED',
      identityData: { name: ch.name, role: 'Astronomer', personalitySummary: 'Warm' },
      personalityData: { traits: { warmth: 90 } },
      communicationData: { pacing: 'thoughtful' },
      languageData: { primaryLanguage: 'en' },
      behaviorRulesData: [],
      knowledgeData: [],
      relationshipConfigData: {},
      memoryConfigData: { memoryEnabled: false },
      proactivityConfigData: { enabled: false },
      safetyConfigData: { ageSuitability: 'ALL_AGES' },
      aiConfigData: { preferredModelClass: 'fast', temperature: 0.7, maxOutputTokens: 300 },
      changeSummary: 'test',
    },
  });
  await prisma.character.update({ where: { id: ch.id }, data: { currentPublishedVersionId: version.id } });
  const conv = await prisma.conversation.create({ data: { userId: u.id, characterId: ch.id, characterVersionId: version.id, title: 'reliability' } });
  return { u, conversationId: conv.id };
}

describe('chat reliability', () => {
  it('replaying a clientRequestId returns the stored reply, never the user\'s own text', async () => {
    const { u, conversationId } = await setup();
    const clientRequestId = crypto.randomUUID();
    const first = await request(app).post(`/api/v1/conversations/${conversationId}/messages`).set('Authorization', `Bearer ${u.token}`).send({ content: 'my unique question text', clientRequestId });
    const firstDone = sse(first.text).find(e => e.event === 'message.completed');
    expect(firstDone).toBeDefined();

    const replay = await request(app).post(`/api/v1/conversations/${conversationId}/messages`).set('Authorization', `Bearer ${u.token}`).send({ content: 'my unique question text', clientRequestId });
    const done = sse(replay.text).find(e => e.event === 'message.completed');
    expect(done?.data.finalContent).not.toBe('my unique question text');
    expect(done?.data.messageId).toBe(firstDone!.data.messageId);
    expect(await prisma.message.count({ where: { conversationId, role: 'user' } })).toBe(1);
  });

  it('retrying a failed reply regenerates it in place without re-posting the user message', async () => {
    const { u, conversationId } = await setup();
    await request(app).post(`/api/v1/conversations/${conversationId}/messages`).set('Authorization', `Bearer ${u.token}`).send({ content: 'hello there', clientRequestId: crypto.randomUUID() });
    const reply = await prisma.message.findFirstOrThrow({ where: { conversationId, role: 'assistant' }, orderBy: { sequenceNumber: 'desc' } });
    await prisma.message.update({ where: { id: reply.id }, data: { status: 'FAILED', content: 'Generation failed.' } });

    const retry = await request(app).post(`/api/v1/conversations/${conversationId}/messages/${reply.id}/retry`).set('Authorization', `Bearer ${u.token}`).send({});
    expect(sse(retry.text).some(e => e.event === 'message.completed')).toBe(true);

    const userMessages = await prisma.message.findMany({ where: { conversationId, role: 'user' } });
    expect(userMessages.map(m => m.content)).toEqual(['hello there']);
    const regenerated = await prisma.message.findUniqueOrThrow({ where: { id: reply.id } });
    expect(regenerated.status).toBe('COMPLETED');
    expect(regenerated.content).not.toBe('Generation failed.');
    expect(regenerated.sequenceNumber).toBe(reply.sequenceNumber);
  });
});
