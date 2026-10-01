import { describe, expect, it } from 'vitest';
import { checkReply } from '../../src/modules/conversations/human/replyChecker.js';
import { buildHumanPrompt, planReply } from '../../src/modules/conversations/human/compactPrompt.js';
import { isTeachingMoment } from '../../src/modules/conversations/human/mentor.js';
import { classifySituations } from '../../src/modules/conversations/human/situation.js';
import { personaPackFor } from '../../src/modules/conversations/human/personaPacks/index.js';

const OTHERS = ['sakshi', 'neha', 'simran-kaur', 'sandeep-chaudhary'];
const prompt = (slug: string, situations: Parameters<typeof planReply>[0] = ['task']) => {
  const pack = personaPackFor(slug)!;
  return buildHumanPrompt({
    pack,
    userName: 'Rohit',
    memoriesText: '',
    relationshipText: '',
    moment: { mood: 'calm', description: 'calm' },
    situations,
    plan: planReply(situations, [], pack, { mentor: Boolean(pack.mentor) }),
  });
};

describe('Astrology, neighbours, coaching and professionals', () => {
  it('all four have packs whose examples pass the editor rules and handle a crisis', () => {
    for (const slug of OTHERS) {
      const pack = personaPackFor(slug)!;
      expect(pack, slug).toBeTruthy();
      for (const ex of pack.examples) {
        const r = checkReply({ bubbles: ex.her, herRecentReplies: [], gender: pack.gender, mode: 'task', address: pack.address });
        expect(r.problems, `${slug}: ${ex.user}`).toEqual([]);
      }
      expect(pack.examples.find((e) => e.tags.includes('crisis'))?.her.join(' '), slug).toContain('14416');
    }
  });

  it('Sakshi never sells remedies or predicts fear', () => {
    const p = prompt('sakshi');
    expect(p).toContain("SAKSHI'S RULES");
    expect(p).toMatch(/No fear predictions/);
    expect(p).toMatch(/No selling/);
  });

  it('Simran coaches with a task and respects consent', () => {
    const p = prompt('simran-kaur');
    expect(p).toContain('YOU ARE A COACH');
    expect(p).toContain('[[task:');
    expect(p).toMatch(/consent/i);
    expect(p).not.toContain('SEBI');
  });

  it('a question in any character\'s field gets a real answer', () => {
    const q = 'ghee asli hai ya nakli kaise pata kare?';
    expect(isTeachingMoment(personaPackFor('sandeep-chaudhary')!, q, classifySituations(q, 1))).toBe(true);
    expect(classifySituations('presentation hai, bahut nervous hoon, kya karu?', 1)).toContain('task');
    expect(classifySituations('boards ka bahut darr lag raha hai', 1)).toContain('emotional');
  });
});
