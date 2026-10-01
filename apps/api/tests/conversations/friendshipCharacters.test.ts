import { describe, expect, it } from 'vitest';
import { checkReply } from '../../src/modules/conversations/human/replyChecker.js';
import { buildHumanPrompt, planReply } from '../../src/modules/conversations/human/compactPrompt.js';
import { personaPackFor } from '../../src/modules/conversations/human/personaPacks/index.js';

const FRIENDS = ['tanu-verma', 'rani-mehta', 'priya-mishra', 'vishnu', 'nandini-reddy'];

describe('Friendship characters', () => {
  it('all five have a friendship pack (not romance)', () => {
    for (const slug of FRIENDS) {
      const pack = personaPackFor(slug)!;
      expect(pack.friendship, slug).toBe(true);
      expect(pack.romance, slug).toBeFalsy();
    }
  });

  it('none of their example replies breaks the editor rules', () => {
    for (const slug of FRIENDS) {
      const pack = personaPackFor(slug)!;
      for (const ex of pack.examples) {
        const r = checkReply({ bubbles: ex.her, herRecentReplies: [], gender: pack.gender, mode: 'task', address: pack.address });
        expect(r.problems, `${slug}: ${ex.user}`).toEqual([]);
      }
    }
  });

  it('every pack answers a crisis with Tele-MANAS', () => {
    for (const slug of FRIENDS) {
      const crisis = personaPackFor(slug)!.examples.find((e) => e.tags.includes('crisis'));
      expect(crisis?.her.join(' '), slug).toContain('14416');
    }
  });

  it('flirting gets a warm best-friend answer, not romance', () => {
    const pack = personaPackFor('vishnu')!;
    expect(planReply(['flirt'], [], pack).moves).toMatch(/best friend/);
    const prompt = buildHumanPrompt({
      pack,
      userName: 'Rohit',
      memoriesText: '',
      relationshipText: '',
      moment: { mood: 'calm', description: 'calm' },
      situations: ['flirt'],
      plan: planReply(['flirt'], [], pack),
    });
    expect(prompt).toContain('BEST FRIEND');
    expect(prompt).not.toContain('HEALTHY ROMANCE');
  });
});
