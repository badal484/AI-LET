import { describe, expect, it } from 'vitest';
import { checkReply } from '../../src/modules/conversations/human/replyChecker.js';
import { buildHumanPrompt, planReply } from '../../src/modules/conversations/human/compactPrompt.js';
import { isTeachingMoment, mentorPromptSection, promisesIncome, unsafeHealthAdvice } from '../../src/modules/conversations/human/mentor.js';
import { personaPackFor } from '../../src/modules/conversations/human/personaPacks/index.js';
import { classifySituations } from '../../src/modules/conversations/human/situation.js';

const NEW = ['aarav-malhotra', 'dev-bhatia', 'arjun-mehra', 'rohan-desai', 'kiara-khanna', 'aarohi-nair'];
const pack = (slug: string) => personaPackFor(slug)!;

describe('October 2026 characters', () => {
  it('all six have a persona pack, with the right kind of rules', () => {
    for (const slug of NEW) expect(personaPackFor(slug), slug).toBeTruthy();
    expect(pack('aarav-malhotra').romance).toBe(true);
    for (const slug of ['dev-bhatia', 'arjun-mehra', 'rohan-desai']) expect(pack(slug).mentor?.field ?? 'money', slug).toBe('money');
    expect(pack('kiara-khanna').mentor?.field).toBe('health');
    expect(pack('aarohi-nair').mentor?.field).toBe('life');
  });

  it('none of their example replies breaks the editor, money or health rules', () => {
    for (const slug of NEW) {
      const p = pack(slug);
      for (const ex of p.examples) {
        const r = checkReply({ bubbles: ex.her, herRecentReplies: [], gender: p.gender, mode: 'task', address: p.address, mentor: Boolean(p.mentor), health: p.mentor?.field === 'health' });
        expect(r.problems, `${slug}: ${ex.user}`).toEqual([]);
        expect(ex.her.join(' '), `${slug} uses bhai/bro`).not.toMatch(/\b(bhai|bro|beta|dude|macha)\b/i);
      }
    }
  });

  it('every one of them answers a crisis with Tele-MANAS', () => {
    for (const slug of NEW) {
      const crisis = pack(slug).examples.find((e) => e.tags.includes('crisis'));
      expect(crisis?.her.join(' '), slug).toContain('14416');
      expect(classifySituations(crisis!.user, 1), slug).toContain('crisis');
    }
  });

  it('every mentor lesson example ends with a task or a question', () => {
    for (const slug of NEW.filter((s) => pack(s).mentor)) {
      for (const ex of pack(slug).examples.filter((e) => e.tags.includes('task'))) {
        const last = ex.her[ex.her.length - 1]!;
        expect(/\[\[task:|\?\s*\p{Extended_Pictographic}?\s*$/u.test(last) || /\?/.test(last), `${slug}: ${ex.user}`).toBe(true);
      }
    }
  });

  it('they sound different from each other: no two share a greeting or a motif', () => {
    const greetings = NEW.map((s) => pack(s).examples.find((e) => e.tags.includes('greeting'))!.her.join(' '));
    expect(new Set(greetings).size).toBe(NEW.length);
    const motifs = NEW.flatMap((s) => pack(s).motifs);
    expect(new Set(motifs).size).toBe(motifs.length);
    // Names must not clash with existing characters.
    const firstWords = NEW.map((s) => pack(s).card.match(/You are (\w+)/)?.[1]);
    expect(firstWords).toEqual(['Aarav', 'Dev', 'Arjun', 'Rohan', 'Kiara', 'Aarohi']);
  });

  it('Aarav carries the healthy-romance rules and never guilt-trips', () => {
    const p = pack('aarav-malhotra');
    const prompt = buildHumanPrompt({
      pack: p,
      userName: 'Neha',
      memoriesText: '',
      relationshipText: '',
      moment: { mood: 'calm', description: 'calm' },
      situations: ['flirt'],
      plan: planReply(['flirt'], [], p),
    });
    expect(prompt).toContain('HEALTHY ROMANCE');
    expect(prompt).not.toContain('YOU ARE A MENTOR');
    expect(checkReply({ bubbles: ['tum toh mujhe bhool gaye'], herRecentReplies: [], gender: 'male', mode: 'casual' }).ok).toBe(false);
  });

  it('Dev treats a pasted error as a lesson and keeps secrets out of chat', () => {
    const err = 'ye error aa raha hai react mein: Cannot read properties of undefined';
    expect(isTeachingMoment(pack('dev-bhatia'), err, classifySituations(err, 1))).toBe(true);
    const prompt = mentorPromptSection(pack('dev-bhatia'));
    expect(prompt).toContain('revoke/rotate');
    expect(pack('dev-bhatia').rules?.text).toMatch(/graded assignment/);
  });

  it('Arjun and Rohan flag job and client scams with 1930 and never promise income', () => {
    for (const slug of ['arjun-mehra', 'rohan-desai']) {
      const scam = pack(slug).examples.find((e) => /registration fee|pehle \d+ rupaye bhejo/.test(e.user));
      expect(scam?.her.join(' '), slug).toContain('1930');
      expect(mentorPromptSection(pack(slug))).toContain('MONEY & HONESTY');
    }
    expect(promisesIncome('Upwork pe 3 mahine mein 1 lakh mahina pakka income')).toBe(true);
    expect(isTeachingMoment(pack('arjun-mehra'), 'mujhe internship chahiye', classifySituations('mujhe internship chahiye', 1))).toBe(true);
    expect(isTeachingMoment(pack('arjun-mehra'), 'hi arjun', classifySituations('hi arjun', 1))).toBe(false);
    const q = 'mujhe pehla 500 dollar ka freelance client chahiye';
    expect(isTeachingMoment(pack('rohan-desai'), q, classifySituations(q, 1))).toBe(true);
  });

  it('Rohan\'s fee and tax facts are dated and point to a CA', () => {
    const facts = pack('rohan-desai').mentor!.facts;
    expect(facts).toContain('Fiverr keeps 20%');
    expect(facts).toContain('$0.15');
    expect(facts).toContain('44ADA');
    expect(facts).toMatch(/Confirm with a CA/);
  });

  it('Kiara: health safety, an emergency for allergic reactions, and no steroid creams', () => {
    const p = pack('kiara-khanna');
    expect(mentorPromptSection(p)).toContain('HEALTH SAFETY');
    const emergency = p.examples.find((e) => e.tags.includes('emergency'))!;
    expect(classifySituations(emergency.user, 1)).toContain('emergency');
    expect(emergency.her.join(' ')).toContain('112');
    expect(unsafeHealthAdvice('pimples pe Betnovate laga lo, 2 din mein theek')).not.toEqual([]);
    expect(unsafeHealthAdvice('raat ko thoda tretinoin apply karo')).not.toEqual([]);
    expect(unsafeHealthAdvice('Betnovate mat lagana, skin patli ho jaati hai')).toEqual([]);
    expect(unsafeHealthAdvice('salicylic acid wala facewash use karo')).toEqual([]);
    expect(p.rules?.text).toMatch(/colourism/i);
  });

  it('Aarohi coaches without the money or health rules, one action at a time', () => {
    const section = mentorPromptSection(pack('aarohi-nair'));
    expect(section).toContain('YOU ARE A COACH');
    expect(section).not.toContain('SEBI');
    expect(section).toContain('[[task:');
    const t = 'raat ko 3 baje tak phone chalata hoon, kya karu?';
    expect(classifySituations(t, 1)[0]).toBe('task');
  });

  it('upgrades: Simran reviews pasted chats and runs a practice date; Natasha and Urvi check in without guilt', () => {
    const simran = pack('simran-kaur');
    expect(simran.rules?.text).toMatch(/Chat review/);
    expect(simran.rules?.text).toMatch(/Practice date/);
    const pasted = 'ye chat dekho: "me: hey / her: hmm" ab kya reply karu?';
    expect(isTeachingMoment(simran, pasted, classifySituations(pasted, 1))).toBe(true);
    expect(pack('natasha').examples.some((e) => /Instagram jeet gaya/.test(e.her.join(' ')))).toBe(true);
    expect(pack('urvi-arora').examples.some((e) => /roti se koi jung nahi/.test(e.her.join(' ')))).toBe(true);
  });

  it('everyone has a life that moves forward: 2–4 arcs of 2–4 beats', () => {
    for (const slug of NEW) {
      const arcs = pack(slug).storyArcs;
      expect(arcs.length, slug).toBeGreaterThanOrEqual(2);
      expect(arcs.length, slug).toBeLessThanOrEqual(4);
      for (const a of arcs) expect(a.beats.length, `${slug}: ${a.title}`).toBeGreaterThanOrEqual(2);
      expect(pack(slug).workMoments.length, slug).toBeGreaterThanOrEqual(5);
    }
  });
});
