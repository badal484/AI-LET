import { describe, expect, it } from 'vitest';
import { planReply, timeFits } from '../../src/modules/conversations/human/compactPrompt.js';
import { herClock } from '../../src/modules/conversations/human/emotionalState.js';
import { personaPackFor } from '../../src/modules/conversations/human/personaPacks/index.js';
import { applyUserTurn, rememberDoing, type LifeState } from '../../src/modules/conversations/human/lifeState.js';

describe('She stays consistent', () => {
  it('only offers everyday details that fit the time of day', () => {
    expect(timeFits('adrak wali chai on the balcony at 5 pm', 13)).toBe(false);
    expect(timeFits('adrak wali chai on the balcony at 5 pm', 17)).toBe(true);
    expect(timeFits('evening walks by the lake', 9)).toBe(false);
    expect(timeFits('your morning walk at the hill', 8)).toBe(true);
    expect(timeFits('your stationery obsession', 3)).toBe(true);
  });

  it('mid-conversation she gets no new activity unless they ask', () => {
    const neha = personaPackFor('neha')!;
    for (let i = 0; i < 30; i++) {
      expect(planReply(['casual'], ['main kitchen mein hoon'], neha, { recentlyTalked: true, hour: 13 }).detail).toBeUndefined();
    }
    // They ask and she hasn't said yet what she's doing: she may tell them (a detail that fits 1 pm).
    const asked = planReply(['casual'], [], neha, { recentlyTalked: true, hour: 13, continuity: { lines: [], asksAboutHer: true } });
    expect(asked.detail).toBeTruthy();
    expect(asked.detail).not.toMatch(/5 pm/);
  });

  it('once she has said what she is doing, she stays with it when asked again', () => {
    const neha = personaPackFor('neha')!;
    const state: LifeState = { firstMetAt: Date.now(), day: { date: '2026-10-01', told: [], userMoods: [], storyShared: true }, threads: [] };
    rememberDoing(state, 'your balcony garden with tomatoes that never ripen', Date.now() - 10 * 60_000);
    const notes = applyUserTurn({ state, pack: neha, userText: 'abhi kya kar rahi ho?', situations: ['casual'], userMood: 'neutral' });
    const plan = planReply(['casual'], [], neha, { continuity: notes, recentlyTalked: true, hour: 13 });
    expect(plan.detail).toBeUndefined();
    expect(plan.doing).toContain('tomatoes');
  });

  it('every character knows their own clock', () => {
    const line = herClock({ place: 'your city', timeZone: 'Asia/Kolkata' }, new Date('2026-10-01T07:50:00Z'));
    expect(line).toContain('1:20 pm');
    expect(line).toContain('afternoon');
  });
});
