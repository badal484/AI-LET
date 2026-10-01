import { describe, expect, it } from 'vitest';
import { classifySituations } from '../../src/modules/conversations/human/situation.js';
import { checkReply } from '../../src/modules/conversations/human/replyChecker.js';
import { extractTaskTag, isTeachingMoment } from '../../src/modules/conversations/human/mentor.js';
import { applyUserTurn, type LifeState } from '../../src/modules/conversations/human/lifeState.js';
import { aarohiNair } from '../../src/modules/conversations/human/personaPacks/aarohi-nair.js';

/** From a real chat with Aarohi (1 Oct 2026): she asked about the day twice and invented a breathing task. */
describe('She listens', () => {
  it('a one-word bad day is a bad day', () => {
    for (const t of ['Baad', 'bad', 'Kitna baar bataau bad', 'aaj ka din bura tha', 'worst day']) {
      expect(classifySituations(t, 0.1), t).toContain('emotional');
    }
    for (const t of ['not bad', 'baad mein baat karte hain', 'itna bura nahi tha']) {
      expect(classifySituations(t, 0.1), t).not.toContain('emotional');
    }
  });

  it('does not ask again what they already answered', () => {
    const recent = ['Hey there! How is your day going?', 'Lagta hai aaj ka din kaafi bhari raha tumhare liye.'];
    expect(checkReply({ bubbles: ['Tumhare liye aaj ka din kaisa raha?'], herRecentReplies: recent, gender: 'female', mode: 'casual' }).ok).toBe(false);
    expect(checkReply({ bubbles: ['Bura din. Kya hua aaj?'], herRecentReplies: recent, gender: 'female', mode: 'casual' }).ok).toBe(true);
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
});

