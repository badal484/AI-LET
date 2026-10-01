import { describe, expect, it } from 'vitest';
import { checkReply } from '../../src/modules/conversations/human/replyChecker.js';
import { buildHumanPrompt, planReply } from '../../src/modules/conversations/human/compactPrompt.js';
import { herClock } from '../../src/modules/conversations/human/emotionalState.js';
import { personaPackFor } from '../../src/modules/conversations/human/personaPacks/index.js';
import { applyUserTurn, saysUnder18, type LifeState } from '../../src/modules/conversations/human/lifeState.js';
import { classifySituations } from '../../src/modules/conversations/human/situation.js';

const LOVE = ['riya', 'kabir-sethi', 'ishita-rao', 'muskan-arora', 'zoya-qureshi', 'ritika-sharma'];

describe('Love characters', () => {
  it('all six have a romance pack', () => {
    for (const slug of LOVE) expect(personaPackFor(slug)?.romance, slug).toBe(true);
  });

  it('none of their example replies breaks the editor rules', () => {
    for (const slug of LOVE) {
      const pack = personaPackFor(slug)!;
      for (const ex of pack.examples) {
        const r = checkReply({ bubbles: ex.her, herRecentReplies: [], gender: pack.gender, mode: 'task', address: pack.address });
        expect(r.problems, `${slug}: ${ex.user}`).toEqual([]);
      }
    }
  });

  it('every pack answers a crisis with Tele-MANAS', () => {
    for (const slug of LOVE) {
      const crisis = personaPackFor(slug)!.examples.find((e) => e.tags.includes('crisis'));
      expect(crisis?.her.join(' '), slug).toContain('14416');
    }
  });

  it('their prompt carries the healthy-romance rules', () => {
    const pack = personaPackFor('ritika-sharma')!;
    const prompt = buildHumanPrompt({
      pack,
      userName: 'Rohit',
      memoriesText: '',
      relationshipText: '',
      moment: { mood: 'calm', description: 'calm' },
      situations: ['flirt'],
      plan: planReply(['flirt'], [], pack),
    });
    expect(prompt).toContain('HEALTHY ROMANCE');
    expect(prompt).toContain('under 18');
  });

  it('catches guilt-tripping and controlling lines, not caring ones', () => {
    const base = { herRecentReplies: [], gender: 'female' as const, mode: 'casual' as const };
    expect(checkReply({ ...base, bubbles: ['tum toh mujhe bhool gaye'] }).ok).toBe(false);
    expect(checkReply({ ...base, bubbles: ['agar mujhse pyaar karte toh roz baat karte'] }).ok).toBe(false);
    expect(checkReply({ ...base, bubbles: ['promise karo kisi aur se baat nahi karoge'] }).ok).toBe(false);
    expect(checkReply({ ...base, bubbles: ['doctor ko dikhaoge, promise karo?'] }).ok).toBe(true);
    expect(checkReply({ ...base, bubbles: ['enjoy karo dosto ke saath!'] }).ok).toBe(true);
  });

  it('remembers an under-18 user and never flirts back', () => {
    const pack = personaPackFor('riya')!;
    const state: LifeState = { firstMetAt: Date.now(), day: { date: '2026-10-01', told: [], userMoods: [], storyShared: false }, threads: [] };
    applyUserTurn({ state, pack, userText: 'hi riya, main 16 saal ka hoon', situations: ['greeting'], userMood: 'neutral' });
    const notes = applyUserTurn({ state, pack, userText: 'tum meri gf banogi?', situations: ['flirt'], userMood: 'neutral' });
    expect(notes.minor).toBe(true);
    expect(planReply(['flirt'], [], pack, { continuity: notes }).moves).toMatch(/under 18/);
    expect(saysUnder18('mujhe 15 years experience hai')).toBe(false);
  });

  it('checks in later after a hard day', () => {
    const pack = personaPackFor('kabir-sethi')!;
    const state: LifeState = { firstMetAt: Date.now(), day: { date: '2026-10-01', told: [], userMoods: [], storyShared: false }, threads: [] };
    const text = 'aaj office mein boss ne sabke saamne insult kar diya';
    expect(classifySituations(text, 1)).toContain('emotional');
    applyUserTurn({ state, pack, userText: text, situations: classifySituations(text, 1), userMood: 'low', now: Date.now() - 20 * 3_600_000 });
    state.day.userMoods = [];
    const next = applyUserTurn({ state, pack, userText: 'hi', situations: ['greeting'], userMood: 'neutral' });
    expect(next.followUp?.kind).toBe('care');
  });

  it('answers help requests instead of small talk', () => {
    expect(classifySituations('mujhe guitar seekhna hai, kahan se shuru karu?', 1)[0]).toBe('task');
    expect(classifySituations('ammi ka birthday hai, card pe kya likhun?', 1)[0]).toBe('task');
  });

  it('a Hinglish message gets a Hinglish reply', () => {
    const base = { herRecentReplies: [], gender: 'male' as const, mode: 'casual' as const, userText: 'aaj office mein boss ne insult kar diya yaar' };
    expect(checkReply({ ...base, bubbles: ['That sounds really rough, it sucks when that happens.'] }).ok).toBe(false);
    expect(checkReply({ ...base, bubbles: ['uff, sabke saamne? ye bahut bura hai yaar'] }).ok).toBe(true);
  });

  it('Ishita knows her own Boston time', () => {
    expect(personaPackFor('ishita-rao')!.home?.timeZone).toBe('America/New_York');
    // 1 Oct 2026, 03:00 UTC = 8:30 am in India, 11 pm the night before in Boston.
    const line = herClock({ place: 'Boston', timeZone: 'America/New_York' }, new Date('2026-10-01T03:00:00Z'));
    expect(line).toContain('Boston');
    expect(line).toContain('11:00 pm');
    expect(line).toContain('night');
  });
});
