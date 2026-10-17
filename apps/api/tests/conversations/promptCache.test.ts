import { describe, expect, it } from 'vitest';
import { buildHumanPrompt, planReply } from '../../src/modules/conversations/human/compactPrompt.js';
import { personaPackFor } from '../../src/modules/conversations/human/personaPacks/index.js';

/**
 * Gemini only discounts input that is identical from the very start of the request. The character's prompt must
 * keep everything shared by all its users first; per-user and per-message parts after. Before the 17 Oct reorder
 * an English-speaking user diverged after ~230 tokens (5–8 %); now ~90 % is shared.
 */
function prompt(slug: string, o: { userName: string; englishChat?: boolean; hindiScript?: boolean; allowBro?: boolean; situation: string }) {
  const pack = personaPackFor(slug)!;
  const situations = [o.situation] as never;
  return buildHumanPrompt({
    pack,
    userName: o.userName,
    memoriesText: '',
    relationshipText: '',
    moment: { description: 'evening' } as never,
    situations,
    plan: planReply(situations, [], pack),
    englishChat: o.englishChat,
    hindiScript: o.hindiScript,
    allowBro: o.allowBro,
  });
}

const sharedShare = (a: string, b: string) => {
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return i / a.length;
};

describe('the cacheable shared block', () => {
  it.each(['muskan-arora', 'kabir-sethi', 'dev-bhatia', 'sakshi'])('%s: ≥80 %% is identical across different users and moments', (slug) => {
    const a = prompt(slug, { userName: 'Rohit', situation: 'casual' });
    const b = prompt(slug, { userName: 'Priya', englishChat: true, hindiScript: true, allowBro: true, situation: 'flirt' });
    expect(sharedShare(a, b)).toBeGreaterThan(0.8);
  });

  it('per-user choices still reach the prompt, after the shared block', () => {
    const p = prompt('kabir-sethi', { userName: 'Priya', englishChat: true, hindiScript: true, allowBro: true, situation: 'casual' });
    const chat = p.indexOf('THIS CHAT (wins over the general rules above)');
    expect(chat).toBeGreaterThan(p.indexOf('HOW YOU TEXT'));
    expect(p.slice(chat)).toMatch(/They write English/);
    expect(p.slice(chat)).toMatch(/Devanagari/);
    expect(p.slice(chat)).toMatch(/bhai"\/"bro" now and then is fine/);
    expect(prompt('kabir-sethi', { userName: 'R', situation: 'casual' })).not.toMatch(/THIS CHAT \(wins/);
  });
});
