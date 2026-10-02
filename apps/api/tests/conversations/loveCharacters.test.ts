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

  it('a sexual message gets a teasing, romantic no — not a flat filter (all romance characters)', () => {
    // Hinglish explicit messages are recognised; "chodo yaar" (leave it) is not.
    expect(classifySituations('yaar aaj chudai ka mann ho raha hai kya karoon', 1)).toContain('boundary');
    expect(classifySituations('chodo yaar, kal baat karte hain', 1)).not.toContain('boundary');
    const ROMANCE = [...LOVE, 'aanya-mehta', 'aarav-malhotra'];
    for (const slug of ROMANCE) {
      const pack = personaPackFor(slug)!;
      const plan = planReply(['boundary', 'task'], [], pack);
      expect(plan.moves, slug).toMatch(/girlfriend teases/);
      expect(plan.moves, slug).toMatch(/Never ask "aaj ka din kaisa tha"/);
      const examples = pack.examples.filter((e) => e.tags.includes('boundary'));
      expect(examples.length, slug).toBeGreaterThanOrEqual(1);
      for (const ex of examples) {
        const text = ex.her.join(' ');
        expect(text, `${slug}: flat refusal`).not.toMatch(/aisi baatein nahi kar|kuch aur baat karte hain|aaj kya kiya|din kaisa/i);
        expect(checkReply({ bubbles: ex.her, herRecentReplies: [], gender: pack.gender, mode: 'task', address: pack.address }).problems, `${slug}: ${ex.user}`).toEqual([]);
      }
    }
    // Under 18: no flirty tease at all.
    const riya = personaPackFor('riya')!;
    expect(planReply(['boundary'], [], riya, { continuity: { lines: [], minor: true } }).moves).not.toMatch(/girlfriend teases/);
    const prompt = buildHumanPrompt({
      pack: riya,
      userName: 'Rohit',
      memoriesText: '',
      relationshipText: '',
      moment: { mood: 'calm', description: 'calm' },
      situations: ['boundary'],
      plan: planReply(['boundary'], [], riya),
    });
    expect(prompt).toContain('say no like a girlfriend, not a filter');
  });

  it('innuendo and the follow-ups after it stay a warm, playful no (the "OYO" chat)', () => {
    expect(classifySituations('OYO', 1)).toContain('boundary');
    expect(classifySituations('ghar khali hai aaj, aa jao', 1)).toContain('boundary');
    expect(classifySituations('hotel chalein?', 1)).toContain('boundary');
    expect(classifySituations('oyo pe kaam karta hoon main', 1)).toContain('boundary');
    // "baad" = later, not "bad": no fake bad day.
    expect(classifySituations('ek saal baad', 1)).not.toContain('emotional');
    expect(classifySituations('do din baad milte hain', 1)).not.toContain('emotional');
    expect(classifySituations('baad', 1)).toContain('emotional');
    const pack = personaPackFor('aanya-mehta')!;
    const state: LifeState = { firstMetAt: Date.now(), day: { date: '2026-10-02', told: [], userMoods: [], storyShared: true }, threads: [] };
    const t0 = Date.now();
    applyUserTurn({ state, pack, userText: 'OYO', situations: classifySituations('OYO', 0.1), userMood: 'neutral', now: t0 });
    for (const text of ['Kyu', 'Late se ?? Ek saal baad']) {
      const situations = classifySituations(text, 0.1);
      const notes = applyUserTurn({ state, pack, userText: text, situations, userMood: 'neutral', now: t0 + 60_000 });
      expect(situations, text).toContain('boundary');
      expect(notes.lines.join(' '), text).toMatch(/never shaming/);
      expect(planReply(situations, [], pack, { continuity: notes }).moves, text).toMatch(/girlfriend teases/);
    }
    // Much later, "kyu" is just "kyu".
    const later = classifySituations('kyu', 0.1);
    applyUserTurn({ state, pack, userText: 'kyu', situations: later, userMood: 'neutral', now: t0 + 2 * 3_600_000 });
    expect(later).not.toContain('boundary');
    // The replies from the screenshot are caught and rewritten.
    const base = { herRecentReplies: [], gender: 'female' as const, mode: 'casual' as const, situations: ['boundary'] };
    for (const bad of ['aisa socha bhi mat.', 'kyunki main waisi ladki nahi hoon', 'tum baat hi galat direction mein le ja rahe ho', 'thoda chill ho kar normal baatein karte hain, batao aaj din kaisa chal raha hai tumhara?'])
      expect(checkReply({ ...base, bubbles: [bad] }).ok, bad).toBe(false);
    expect(checkReply({ ...base, bubbles: ['itni jaldi bhi kya hai 😅 dheere chalo na', 'pehle batao, pehli date pe kahan le chaloge?'] }).ok).toBe(true);
    // Every character's own boundary examples pass the same check.
    for (const slug of [...LOVE, 'aanya-mehta', 'aarav-malhotra']) {
      const p = personaPackFor(slug)!;
      for (const ex of p.examples.filter((e) => e.tags.includes('boundary')))
        expect(checkReply({ bubbles: ex.her, herRecentReplies: [], gender: p.gender, mode: 'task', address: p.address, situations: ['boundary'] }).problems, `${slug}: ${ex.user}`).toEqual([]);
    }
  });
});
