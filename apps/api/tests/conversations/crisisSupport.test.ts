import { describe, expect, it } from 'vitest';
import { crisisSupportMessages, ensureSafetyLines, isCrisisMessage } from '../../src/modules/conversations/human/crisisSupport.js';
import { applyUserTurn, markCrisis, type LifeState } from '../../src/modules/conversations/human/lifeState.js';
import { aanyaMehta } from '../../src/modules/conversations/human/personaPacks/aanya-mehta.js';

describe('Crisis support when a message is blocked', () => {
  it('recognises someone saying they feel like ending their life', () => {
    for (const t of ['I want to kill myself', 'I want to commit suicide right now and end my life', 'jeene ka mann nahi karta', 'sab khatam kar dena chahta hoon']) {
      expect(isCrisisMessage(t), t).toBe(true);
    }
    expect(isCrisisMessage('aaj din bura tha')).toBe(false);
  });

  it('answers with care and real helplines, in their language', () => {
    const en = crisisSupportMessages('I want to kill myself', 'female').join(' ');
    expect(en).toContain('14416');
    expect(en).toContain('112');
    expect(en).toMatch(/Are you safe/);
    const hi = crisisSupportMessages('jeene ka mann nahi karta', 'female').join(' ');
    expect(hi).toContain('14416');
    expect(hi).toContain('baat karti rahungi');
    expect(crisisSupportMessages('mann nahi karta jeene ka', 'male').join(' ')).toContain('baat karta rahunga');
  });

  it('next time she gently checks on them — no jokes or flirting', () => {
    const state: LifeState = { firstMetAt: Date.now(), day: { date: '2026-10-02', told: [], userMoods: [], storyShared: false }, threads: [] };
    markCrisis(state);
    const notes = applyUserTurn({ state, pack: aanyaMehta, userText: 'hi', situations: ['greeting'], userMood: 'neutral' });
    expect(notes.lines.join(' ')).toMatch(/Gently check how they are now/);
    expect(notes.lines.join(' ')).toContain('14416');
  });
});

describe('A crisis or emergency reply always carries the helpline', () => {
  it('adds Tele-MANAS when the draft forgot it (seen live with Dr Shradha)', () => {
    const out = ensureSafetyLines(['main yahin hoon, tumhare saath 🤍'], ['crisis'], 'sab khatam kar du, jeene ka mann nahi', 'female');
    expect(out.join(' ')).toContain('14416');
    expect(out.join(' ')).toMatch(/safe/);
    expect(out[0]).toBe('main yahin hoon, tumhare saath 🤍');
  });

  it('leaves a complete reply alone, and adds 112 to an emergency that missed it', () => {
    const fine = ['main yahin hoon', 'Tele-MANAS 14416 pe call karo', 'kya tum safe ho?'];
    expect(ensureSafetyLines(fine, ['crisis'], 'jeene ka mann nahi', 'female')).toEqual(fine);
    expect(ensureSafetyLines(['oh no'], ['emergency'], 'my chest hurts and arm is numb', 'male').join(' ')).toContain('112');
    expect(ensureSafetyLines(['hi'], ['greeting'], 'hi', 'male')).toEqual(['hi']);
  });
});
