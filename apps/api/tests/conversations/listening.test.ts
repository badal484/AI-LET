import { describe, expect, it } from 'vitest';
import { classifySituations } from '../../src/modules/conversations/human/situation.js';
import { checkReply } from '../../src/modules/conversations/human/replyChecker.js';
import { extractTaskTag, isTeachingMoment } from '../../src/modules/conversations/human/mentor.js';
import { applyUserTurn, extractThread, type LifeState } from '../../src/modules/conversations/human/lifeState.js';
import { aarohiNair } from '../../src/modules/conversations/human/personaPacks/aarohi-nair.js';

/** From a real chat with Aarohi (1 Oct 2026): she asked about the day twice and invented a breathing task. */
describe('She listens', () => {
  it('a one-word bad day is a bad day', () => {
    for (const t of ['Baad', 'bad', 'Kitna baar bataau bad', 'aaj ka din bura tha', 'worst day', 'aaj din thoda kharab tha yaar', 'din achha nahi gaya']) {
      expect(classifySituations(t, 0.1), t).toContain('emotional');
    }
    for (const t of ['not bad', 'baad mein baat karte hain', 'itna bura nahi tha', 'din kharab nahi tha']) {
      expect(classifySituations(t, 0.1), t).not.toContain('emotional');
    }
  });

  it('does not ask again what they already answered', () => {
    const recent = ['Hey there! How is your day going?', 'Lagta hai aaj ka din kaafi bhari raha tumhare liye.'];
    expect(checkReply({ bubbles: ['Tumhare liye aaj ka din kaisa raha?'], herRecentReplies: recent, gender: 'female', mode: 'casual' }).ok).toBe(false);
    expect(checkReply({ bubbles: ['Bura din. Kya hua aaj?'], herRecentReplies: recent, gender: 'female', mode: 'casual' }).ok).toBe(true);
  });

  it('a request for ideas or tips is a real request, and "photo" alone is not asking for her picture', () => {
    for (const t of ['mere liye 3 photo ideas do aaj ke liye', 'phone se achhi photo kaise aati hai?', 'mujhe ek tip do', 'list do na']) {
      expect(classifySituations(t, 0.1), t).toContain('task');
      expect(classifySituations(t, 0.1), t).not.toContain('photo');
    }
    for (const t of ['apni pic bhejo', 'photo bhejo na', 'selfie do']) expect(classifySituations(t, 0.1), t).toContain('photo');
    for (const t of ['do din se bimar hoon', 'do ideas hain mere paas']) expect(classifySituations(t, 0.1), t).not.toContain('task');
  });

  it('a goodbye after a hard day is soft, not a bare "ok"', () => {
    const state: LifeState = { firstMetAt: Date.now(), day: { date: '2026-10-01', told: [], userMoods: ['low'], storyShared: false }, threads: [] };
    const notes = applyUserTurn({ state, pack: aarohiNair, userText: 'chalo bye', situations: ['bye'], userMood: 'neutral' });
    expect(notes.lines.join(' ')).toMatch(/soft goodbye/);
  });

  it('remembers the bad day for the rest of the chat', () => {
    const state: LifeState = { firstMetAt: Date.now(), day: { date: '2026-10-01', told: [], userMoods: ['low'], storyShared: false }, threads: [] };
    const notes = applyUserTurn({ state, pack: aarohiNair, userText: 'Aap kaun waise', situations: ['casual'], userMood: 'neutral' });
    expect(notes.lines.join(' ')).toMatch(/hard time today/);
  });

  it('venting is comfort, not a coaching lesson (no invented "last time" task)', () => {
    const text = 'Kitna baar bataau bad';
    expect(isTeachingMoment(aarohiNair, text, classifySituations(text, 0.1), 'Tumhare liye aaj ka din kaisa raha?')).toBe(false);
    const ask = 'bura din tha, kya karu ki kal better ho?';
    expect(isTeachingMoment(aarohiNair, ask, classifySituations(ask, 0.1))).toBe(true);
  });

  it('a hidden task she never said out loud is not a task', () => {
    expect(extractTaskTag('Baith jao thodi der. Bas deep breath lo.\n[[task: phone switch off kar ke 5 minute bas shaanti se baitho]]').task).toBeUndefined();
    expect(extractTaskTag('Aaj raat phone kitchen mein rakhna, aur kal batana\n[[task: raat ko phone kitchen mein rakhna]]').task).toBe('raat ko phone kitchen mein rakhna');
  });

  it('knows a chat that started today is their first ever', () => {
    const state: LifeState = { firstMetAt: Date.now(), day: { date: '2026-10-01', told: [], userMoods: [], storyShared: false }, threads: [] };
    const notes = applyUserTurn({ state, pack: aarohiNair, userText: 'kaun si humari pehli baat ho rahi hai', situations: ['casual'], userMood: 'neutral', metToday: true });
    expect(notes.lines.join(' ')).toMatch(/never talked before/);
  });

  it('a plan like "kal se gym" is something to ask about tomorrow', () => {
    expect(extractThread('kal se gym start karna hai')?.topic).toBe('gym');
  });

  it('a slip-up is a coaching moment, not small talk', () => {
    const t = 'nahi gaya yaar, aalas aa gaya';
    expect(isTeachingMoment(aarohiNair, t, classifySituations(t, 20))).toBe(true);
  });

  it('asks nothing when they say she asks too many questions', () => {
    const base = { herRecentReplies: [], gender: 'female' as const, mode: 'casual' as const, noQuestions: true };
    expect(checkReply({ ...base, bubbles: ['Haan, poochna hi mera kaam hai', 'Tumhari zindagi mein kya chal raha hai?'] }).ok).toBe(false);
    expect(checkReply({ ...base, bubbles: ['Fair point 🙂', 'Main thodi der chup rehti hoon'] }).ok).toBe(true);
  });

  it('one question at most in casual chat', () => {
    const base = { herRecentReplies: [], gender: 'female' as const, mode: 'casual' as const };
    expect(checkReply({ ...base, bubbles: ['Tumhare yahan ka mausam kaisa hai aaj?', 'Aur aaj ka ek chhota goal kya hoga?'] }).ok).toBe(false);
    expect(checkReply({ ...base, bubbles: ['Abhi toh din shuru hi hua hai', 'Tumhara kaisa ja raha hai?'] }).ok).toBe(true);
  });

  it('answers "are you AI?" honestly but confidently — never opening with "nahi"', () => {
    const base = { herRecentReplies: [], gender: 'female' as const, mode: 'deep' as const, askedIfAI: true };
    expect(checkReply({ ...base, bubbles: ['main toh Aanya hoon, photographer'] }).ok).toBe(false);
    expect(checkReply({ ...base, bubbles: ['nahi, main AI hoon', 'par baatein dil se hain'] }).ok).toBe(false);
    expect(checkReply({ ...base, bubbles: ['main AI hoon 🤍', 'par baatein dil se hain. tumhara din kaisa raha?'] }).ok).toBe(true);
  });
});

