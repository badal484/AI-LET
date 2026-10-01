import crypto from 'crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { createCharacter, createUser } from '../fixtures.js';
import { redis } from '../../src/infrastructure/redis/redis.js';
import { StreamingChatService } from '../../src/modules/conversations/services/streamingChat.service.js';

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

describe('chat reliability (human-style turns)', () => {
  const send = (token: string, conversationId: string, content: string, clientRequestId = crypto.randomUUID()) =>
    request(app).post(`/api/v1/conversations/${conversationId}/messages`).set('Authorization', `Bearer ${token}`).send({ content, clientRequestId });

  it('a resent request (same clientRequestId) never duplicates the message or the reply', async () => {
    const { u, conversationId } = await setup();
    const clientRequestId = crypto.randomUUID();
    const first = await send(u.token, conversationId, 'my unique question text', clientRequestId);
    const firstSaved = sse(first.text).find(e => e.event === 'message.saved');
    expect(sse(first.text).some(e => e.event === 'message.bubble')).toBe(true);

    const replay = await send(u.token, conversationId, 'my unique question text', clientRequestId);
    expect(sse(replay.text).find(e => e.event === 'message.saved')?.data.messageId).toBe(firstSaved!.data.messageId);
    expect(await prisma.message.count({ where: { conversationId, role: 'user' } })).toBe(1);
    const replies = await prisma.message.count({ where: { conversationId, role: 'assistant' } });
    expect(replies).toBeGreaterThanOrEqual(1);
    expect(sse(replay.text).some(e => e.event === 'message.bubble')).toBe(false);
  });

  it('retry answers the unanswered message without re-posting it; the old failure stays hidden', async () => {
    const { u, conversationId } = await setup();
    const userMsg = await prisma.message.create({ data: { conversationId, senderType: 'USER', role: 'user', content: 'hello there', status: 'SENT', sequenceNumber: 1 } });
    const failed = await prisma.message.create({ data: { conversationId, senderType: 'CHARACTER', role: 'assistant', content: 'Generation failed.', status: 'FAILED', sequenceNumber: 2 } });

    const retry = await request(app).post(`/api/v1/conversations/${conversationId}/messages/${failed.id}/retry`).set('Authorization', `Bearer ${u.token}`).send({});
    expect(sse(retry.text).some(e => e.event === 'message.bubble')).toBe(true);

    const userMessages = await prisma.message.findMany({ where: { conversationId, role: 'user' } });
    expect(userMessages.map(m => m.id)).toEqual([userMsg.id]);
    const reply = await prisma.message.findFirst({ where: { conversationId, role: 'assistant', status: 'COMPLETED' } });
    expect(reply!.sequenceNumber).toBeGreaterThan(failed.sequenceNumber);

    const history = await request(app).get(`/api/v1/conversations/${conversationId}/messages`).set('Authorization', `Bearer ${u.token}`);
    expect(JSON.stringify(history.body)).not.toContain('Generation failed.');
  });

  it('messages sent while she is replying are stored and answered together in the next turn', async () => {
    const { u, conversationId } = await setup();
    // A turn is running: two quick messages are stored and queued, not refused.
    await redis.set(`conv:lock:${conversationId}`, 'someone-else', 'EX', 60);
    const q1 = await send(u.token, conversationId, 'first thing');
    const q2 = await send(u.token, conversationId, 'second thing');
    expect(sse(q1.text).some(e => e.event === 'message.queued')).toBe(true);
    expect(sse(q2.text).some(e => e.event === 'message.queued')).toBe(true);
    await redis.del(`conv:lock:${conversationId}`);

    // The next turn answers everything unanswered at once (one reply, after all three).
    const res = await send(u.token, conversationId, 'third thing');
    const bubbles = sse(res.text).filter(e => e.event === 'message.bubble');
    expect(bubbles.length).toBeGreaterThanOrEqual(1);
    const users = await prisma.message.findMany({ where: { conversationId, role: 'user' }, orderBy: { sequenceNumber: 'asc' } });
    expect(users.map(m => m.content)).toEqual(['first thing', 'second thing', 'third thing']);
    const replies = await prisma.message.findMany({ where: { conversationId, role: 'assistant' }, orderBy: { sequenceNumber: 'asc' } });
    expect(replies.length).toBe(bubbles.length);
    expect(replies[0]!.sequenceNumber).toBeGreaterThan(users[2]!.sequenceNumber);
  });

  it('splits a reply into natural bubbles but keeps a structured answer (a plan) in one message', () => {
    const split = (StreamingChatService as unknown as { splitBubbles: (t: string) => string[] }).splitBubbles.bind(StreamingChatService);
    expect(split('Arey waah!\n[[next]]\nSach mein? 😄\n[[next]]\nBatao kaise hua')).toEqual(['Arey waah!', 'Sach mein? 😄', 'Batao kaise hua']);
    expect(split('Haan bilkul 😄')).toEqual(['Haan bilkul 😄']);
    const plan = 'Okay plan ready 💪\n[[next]]\nBreakfast: poha\nLunch: dal chawal\nDinner: roti sabzi\n[[next]]\nVeg ho ya non-veg?';
    expect(split(plan)).toEqual(['Okay plan ready 💪', 'Breakfast: poha\nLunch: dal chawal\nDinner: roti sabzi', 'Veg ho ya non-veg?']);
    // A list sent without markers is never chopped into pieces.
    expect(split('Here you go:\n\n1. Warm up\n2. Squats\n\nDone?').length).toBe(1);
    expect(split('a\n[[next]]\nb\n[[next]]\nc\n[[next]]\nd\n[[next]]\ne\n[[next]]\nf\n[[next]]\ng\n[[next]]\nh\n[[next]]\ni\n[[next]]\nj').length).toBe(8);
  });

  it('sizes replies like a person: tiny for casual texts, full only for real requests', () => {
    const svc = StreamingChatService as unknown as {
      replyStyleFor: (t: string) => { mode: string; maxTokens: number; maxBubbles: number; maxBubbleChars: number };
      polishBubbles: (b: string[], s: { mode: string; maxBubbles: number; maxBubbleChars: number }) => string[];
    };
    expect(svc.replyStyleFor('Hii').mode).toBe('casual');
    expect(svc.replyStyleFor('Dhaba').mode).toBe('casual');
    expect(svc.replyStyleFor('aaj mera mood off hai').mode).toBe('deep');
    expect(svc.replyStyleFor('Mere liye ek din ka veg diet plan bana do').mode).toBe('task');

    const casual = svc.replyStyleFor('Dhaba');
    const polished = svc.polishBubbles(
      [
        'Haan dhaba hi chalenge! 😊🍞☕ Main toh abhi hi ek dhaba ki soch rahi thi jahan kaali chai aur butter toast milta ho. Tumne kya socha, kya khana chahiye?',
        'Waise main toh butter toast pehi lagti ho',
        '(Abhi se hi hum chalo? Ya phir kal subah? 😏)',
      ],
      casual,
    );
    expect(polished.length).toBeLessThanOrEqual(2);
    expect(polished.every(b => b.length <= 110)).toBe(true);
    expect(polished.join(' ')).not.toMatch(/^\(|\)$/m);
    expect((polished[0]!.match(/\p{Extended_Pictographic}/gu) ?? []).length).toBeLessThanOrEqual(1);

    // A requested plan is never trimmed.
    const plan = 'Breakfast: poha\nLunch: dal chawal\nDinner: roti sabzi'.repeat(5);
    expect(svc.polishBubbles(['Okay 💪', plan], svc.replyStyleFor('diet plan bana do'))[1]).toBe(plan);
  });
});
