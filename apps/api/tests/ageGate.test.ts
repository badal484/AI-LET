import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { ageFromDob, dobFromAge, forgetAge, isTeen, markRomance, MIN_AGE } from '../src/modules/users/ageGate.js';
import { createCharacter, createConversation, createUser } from './fixtures.js';

/**
 * Age rules (owner's decision, 18 Oct 2026): 12+; romance characters are 18+ — under-18s see them marked
 * ageRestricted (blurred "18+ only" in the app) and can't chat with them.
 */
describe('age rules', () => {
  const app = createApp();

  async function userAged(age: number | null) {
    const u = await createUser();
    await prisma.userProfile.upsert({
      where: { userId: u.id },
      create: { userId: u.id, displayName: 'Age Test', dateOfBirth: age === null ? null : dobFromAge(age) },
      update: { dateOfBirth: age === null ? null : dobFromAge(age) },
    });
    forgetAge(u.id);
    return u;
  }
  async function loveCharacter() {
    const c = await createCharacter();
    // A published version, so a conversation can be started (the age check is what's tested).
    const json = {};
    const v = await prisma.characterVersion.create({
      data: {
        characterId: c.id, versionNumber: 1, status: 'PUBLISHED', changeSummary: 'test', identityData: json, personalityData: json,
        communicationData: json, languageData: json, behaviorRulesData: json, knowledgeData: json, relationshipConfigData: json,
        memoryConfigData: json, proactivityConfigData: json, safetyConfigData: json, aiConfigData: json,
      },
    });
    await prisma.character.update({ where: { id: c.id }, data: { category: 'love', status: 'PUBLISHED', currentPublishedVersionId: v.id } });
    return c;
  }

  it('an age becomes a birth date that keeps counting; 12 is the minimum', () => {
    const dob = dobFromAge(16, new Date('2026-10-18T10:00:00Z'));
    expect(ageFromDob(dob, new Date('2026-10-18T10:00:00Z'))).toBe(16);
    expect(ageFromDob(dob, new Date('2027-10-18T10:00:00Z'))).toBe(17);
    expect(ageFromDob(dob, new Date('2028-10-18T10:00:00Z'))).toBe(18);
    expect(MIN_AGE).toBe(12);
  });

  it('teen = under 18; adults and accounts without an age (older sign-ups) are not', async () => {
    expect(await isTeen((await userAged(16)).id)).toBe(true);
    expect(await isTeen((await userAged(18)).id)).toBe(false);
    expect(await isTeen((await userAged(null)).id)).toBe(false);
  });

  it('marks romance characters (lists and single objects), leaves everyone else alone', () => {
    const body = {
      sections: [{ id: 'love', items: [{ slug: 'muskan-arora', name: 'Muskan' }, { slug: 'dev-bhatia', name: 'Dev' }, { slug: 'x', name: 'X', category: 'love' }] }],
      character: { slug: 'ritika-sharma', name: 'Ritika' },
      category: { slug: 'love', name: 'Love & Romance' },
    };
    const out = markRomance(body);
    expect(out.sections[0]!.items.map((i) => Boolean((i as { ageRestricted?: boolean }).ageRestricted))).toEqual([true, false, true]);
    expect((out.character as { ageRestricted?: boolean }).ageRestricted).toBe(true);
    expect((out.category as { ageRestricted?: boolean }).ageRestricted).toBeUndefined(); // a category isn't a character
  });

  it('an under-18 cannot start a chat with a romance character; an adult can', async () => {
    const char = await loveCharacter();
    const teen = await userAged(15);
    const adult = await userAged(25);
    const asTeen = await request(app).post('/api/v1/conversations').set('Authorization', `Bearer ${teen.token}`).send({ characterId: char.id });
    expect(asTeen.status).toBe(403);
    expect(asTeen.body.error.code).toBe('AGE_RESTRICTED');
    const asAdult = await request(app).post('/api/v1/conversations').set('Authorization', `Bearer ${adult.token}`).send({ characterId: char.id });
    expect([200, 201]).toContain(asAdult.status);
  });

  it('an under-18 cannot send messages in a romance chat (even one that exists)', async () => {
    const char = await loveCharacter();
    const teen = await userAged(14);
    const { conversationId } = await createConversation(teen.id, char.id, []);
    const res = await request(app).post(`/api/v1/conversations/${conversationId}/messages`).set('Authorization', `Bearer ${teen.token}`).send({ content: 'hii', clientRequestId: `age-${Date.now()}` });
    expect(res.text).toContain('AGE_RESTRICTED');
    expect(await prisma.message.count({ where: { conversationId } })).toBe(0);
  });

  it('every API list marks romance characters for under-18s — not only discovery (here: the chats list)', async () => {
    const char = await loveCharacter();
    const teen = await userAged(16);
    const adult = await userAged(30);
    await createConversation(teen.id, char.id, []);
    await createConversation(adult.id, char.id, []);
    const flag = async (token: string) => {
      const res = await request(app).get('/api/v1/conversations').set('Authorization', `Bearer ${token}`);
      const item = (res.body.data as Array<{ character: { id: string; ageRestricted?: boolean } }>).find((c) => c.character.id === char.id);
      return item?.character.ageRestricted;
    };
    expect(await flag(teen.token)).toBe(true);
    expect(await flag(adult.token)).toBeUndefined();
  });
});
