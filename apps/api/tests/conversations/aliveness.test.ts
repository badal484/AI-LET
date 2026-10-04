import { describe, expect, it } from 'vitest';
import { herDayLine, milestoneLine, type LifeState } from '../../src/modules/conversations/human/lifeState.js';
import { applyProjectPatch, sharedProjectLines } from '../../src/modules/conversations/human/project.js';
import { personaPackFor } from '../../src/modules/conversations/human/personaPacks/index.js';
import { applyPatch, emptyProfile, formatProfile, nearDuplicate, normalizeProfile } from '../../src/modules/memory/services/userProfile.service.js';

const life = (): LifeState => ({ firstMetAt: Date.now(), day: { date: '2026-10-04', told: [], userMoods: [], storyShared: false }, threads: [] });

describe('She remembers what she told you', () => {
  it('keeps her shared stories and tells herself not to retell them', () => {
    const p = applyPatch(emptyProfile(), { her_shared: ['her ex Siddharth and the long distance', 'Kartik broke her chai cup'] });
    expect(p.herShared).toEqual(['her ex Siddharth and the long distance', 'Kartik broke her chai cup']);
    expect(applyPatch(p, { her_shared: ['Kartik broke her chai cup'] }).herShared).toHaveLength(2);
    expect(formatProfile(p, '2026-10-04')).toMatch(/Stories you've already told them: her ex Siddharth.*don't retell.*never say "maine bataya tha"/);
    expect(normalizeProfile(JSON.parse(JSON.stringify(p))).herShared).toEqual(p.herShared);
  });
});

describe('Milestones', () => {
  it('a week in, she notices it once', () => {
    const s = life();
    expect(milestoneLine(s, 3)).toBeUndefined();
    expect(milestoneLine(s, 8)).toMatch(/about a week/);
    expect(milestoneLine(s, 8)).toBeUndefined();
    expect(milestoneLine(s, 31)).toMatch(/about a month/);
    // Long past a milestone (came back after months): no stale "a week ago" note.
    expect(milestoneLine(life(), 60)).toBeUndefined();
  });
});

describe('Her own days', () => {
  const nandini = personaPackFor('nandini-reddy')!;
  it('some days she has a mood of her own, the same all day, mentioned only if asked', () => {
    const days = Array.from({ length: 30 }, (_, i) => herDayLine(nandini.herDays, nandini.slug, `2026-11-${String(i + 1).padStart(2, '0')}`));
    const withMood = days.filter(Boolean);
    expect(withMood.length).toBeGreaterThan(5);
    expect(withMood.length).toBeLessThan(25);
    expect(herDayLine(nandini.herDays, nandini.slug, '2026-11-05')).toBe(herDayLine(nandini.herDays, nandini.slug, '2026-11-05'));
    expect(withMood[0]).toMatch(/only if they ask how you are/);
  });
});

describe('Your dream home, built together', () => {
  const sp = personaPackFor('nandini-reddy')!.sharedProject!;
  it('offered when there is none yet, then built choice by choice', () => {
    expect(sharedProjectLines(sp, undefined)[0]).toMatch(/only when the chat is light.*\[\[project: goal=our dream home/);
    let p = applyProjectPatch(emptyProfile(), { goal: 'our dream home', next: 'mountains or sea' }, '2026-10-04');
    p = applyProjectPatch(p, { done: 'a glass house in the mountains', next: 'the reading corner' }, '2026-10-05');
    const lines = sharedProjectLines(sp, p.project)[0]!;
    expect(lines).toMatch(/What you have so far: a glass house in the mountains/);
    expect(lines).toMatch(/Next to decide: the reading corner/);
  });

  it('choices noticed by the background memory go into the project — never a made-up project', () => {
    let p = applyProjectPatch(emptyProfile(), { goal: 'our dream home' }, '2026-10-04');
    p = applyPatch(p, { project_choices: ['glass house in the mountains'] });
    expect(p.project?.done).toEqual(['glass house in the mountains']);
    expect(applyPatch(emptyProfile(), { project_choices: ['glass house'] }).project).toBeUndefined();
  });
});

describe('The same entry in other words is saved once', () => {
  it('"missed me at 3pm" ≈ "said he missed her at 3 pm" — but different moments stay', () => {
    expect(nearDuplicate('said he missed her at 3 pm', 'missed me at 3pm')).toBe(true);
    expect(nearDuplicate('confessed to missing her at 3 pm', 'said he missed her at 3 pm')).toBe(true);
    expect(nearDuplicate('remembered her coffee order', 'worst pickup line about momos')).toBe(false);
    let p = applyProjectPatch(emptyProfile(), { goal: 'the case of us', done: 'said he missed her at 3 pm' }, '2026-10-04');
    p = applyProjectPatch(p, { done: 'missed me at 3pm' }, '2026-10-04');
    expect(p.project?.done).toHaveLength(1);
  });
});
