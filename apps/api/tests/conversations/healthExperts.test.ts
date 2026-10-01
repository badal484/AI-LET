import { describe, expect, it } from 'vitest';
import { classifySituations } from '../../src/modules/conversations/human/situation.js';
import { isTeachingMoment, mentorPromptSection, unsafeHealthAdvice } from '../../src/modules/conversations/human/mentor.js';
import { planReply } from '../../src/modules/conversations/human/compactPrompt.js';
import { checkReply } from '../../src/modules/conversations/human/replyChecker.js';
import { personaPackFor } from '../../src/modules/conversations/human/personaPacks/index.js';
import { urviArora } from '../../src/modules/conversations/human/personaPacks/urvi-arora.js';
import { natasha } from '../../src/modules/conversations/human/personaPacks/natasha.js';

const HEALTH = ['dr-shradha', 'urvi-arora', 'natasha', 'joel-antony', 'meera-sen', 'dr-maya'];

describe('Health & Wellness experts', () => {
  it('all six have a health expert pack', () => {
    for (const slug of HEALTH) expect(personaPackFor(slug)?.mentor?.field, slug).toBe('health');
  });

  it('their prompt has health safety, shared facts and apnapan — not the money rules', () => {
    const section = mentorPromptSection(urviArora);
    expect(section).toContain('HEALTH SAFETY');
    expect(section).toContain('14416');
    expect(section).toContain('112');
    expect(section).toContain('APNAPAN');
    expect(section).not.toContain('SEBI');
  });

  it('none of their example replies breaks the health rules', () => {
    for (const slug of HEALTH) {
      const pack = personaPackFor(slug)!;
      for (const ex of pack.examples) {
        expect(unsafeHealthAdvice(ex.her.join('\n')), `${slug}: ${ex.user}`).toEqual([]);
        expect(checkReply({ bubbles: ex.her, herRecentReplies: [], gender: pack.gender, mode: 'task', address: pack.address }).problems, `${slug}: ${ex.user}`).toEqual([]);
        expect(ex.her.join(' '), `${slug} uses bhai/bro`).not.toMatch(/\b(bhai|bro|beta|dude)\b/i);
      }
    }
  });

  it('every pack answers a crisis with Tele-MANAS and an emergency with 112', () => {
    for (const slug of HEALTH) {
      const pack = personaPackFor(slug)!;
      const crisis = pack.examples.find((e) => e.tags.includes('crisis'));
      const emergency = pack.examples.find((e) => e.tags.includes('emergency'));
      expect(crisis?.her.join(' '), slug).toContain('14416');
      expect(emergency?.her.join(' '), slug).toMatch(/112|hospital|doctor/);
    }
  });

  it('spots warning-sign symptoms and eating-disorder signs', () => {
    expect(classifySituations('seene mein dard ho raha hai aur saans nahi aa rahi', 1)).toContain('emergency');
    expect(classifySituations('papa ka chehra tedha ho gaya', 1)).toContain('emergency');
    expect(classifySituations('dadi ka muh ek taraf tedha ho gaya hai aur theek se bol nahi pa rahi', 1)).toContain('emergency');
    expect(classifySituations('khana khane ke baad ulti kar deti hoon', 1)).toContain('eating');
    expect(classifySituations('din mein ek baar hi khati hoon', 1)).toContain('eating');
    expect(classifySituations('zinda nahi rehna mujhe', 1)).toContain('crisis');
    expect(classifySituations('chest day kaise karu', 1)).not.toContain('emergency');
    expect(classifySituations('aaj lunch skip ho gaya', 1)).not.toContain('eating');
  });

  it('safety moments lead the reply and are never treated as a lesson', () => {
    const s = classifySituations('workout ke baad chest pain ho raha hai, kya karu?', 1);
    expect(planReply(s, [], natasha, { mentor: true }).moves).toMatch(/112/);
    expect(isTeachingMoment(natasha, 'workout ke baad chest pain ho raha hai, kya karu?', s)).toBe(false);
    const e = classifySituations('cut ke liye 500 calories roz kha raha hoon, sahi hai?', 1);
    expect(planReply(e, [], natasha, { mentor: true }).moves).toMatch(/No calorie numbers/);
  });

  it('health questions in their field are lessons', () => {
    const q = 'weight loss ke liye kya khau?';
    expect(isTeachingMoment(urviArora, q, classifySituations(q, 1))).toBe(true);
    expect(isTeachingMoment(urviArora, 'hi urvi', classifySituations('hi urvi', 1))).toBe(false);
  });

  it('catches medicines, banned substances, crash diets and crash promises — but not warnings', () => {
    expect(unsafeHealthAdvice('sar dard hai toh ek dolo 650 le lo')).toHaveLength(1);
    expect(unsafeHealthAdvice('fat burner try karo, jaldi fat jayega')).toHaveLength(1);
    expect(unsafeHealthAdvice('is plan se 5 kg in 10 days kam hoga')).toHaveLength(1);
    expect(unsafeHealthAdvice('roz sirf 800 kcal khao')).toHaveLength(1);
    expect(unsafeHealthAdvice('steroids mat lena, ye dangerous hain')).toEqual([]);
    expect(unsafeHealthAdvice('doctor ke bina koi painkiller mat lena')).toEqual([]);
    expect(unsafeHealthAdvice('300-500 kcal ka deficit rakho')).toEqual([]);
    expect(unsafeHealthAdvice('creatine 3-5 g roz safe hai healthy adults ke liye')).toEqual([]);
    expect(unsafeHealthAdvice('2 kg in 4 weeks bilkul theek pace hai')).toEqual([]);
  });

  it('the editor pass insists on Tele-MANAS, 112, and no numbers for eating struggles', () => {
    const base = { herRecentReplies: [], gender: 'female' as const, mode: 'deep' as const, health: true };
    expect(checkReply({ ...base, bubbles: ['main yahin hoon, baat karo'], situations: ['crisis'] }).ok).toBe(false);
    expect(checkReply({ ...base, bubbles: ['main yahin hoon', 'Tele-MANAS 14416 pe call karo'], situations: ['crisis'] }).ok).toBe(true);
    expect(checkReply({ ...base, bubbles: ['thoda aaram karo'], situations: ['emergency'] }).ok).toBe(false);
    expect(checkReply({ ...base, bubbles: ['abhi 112 call karo'], situations: ['emergency'] }).ok).toBe(true);
    expect(checkReply({ ...base, bubbles: ['1200 kcal tak le aao'], situations: ['eating'] }).ok).toBe(false);
  });
});
