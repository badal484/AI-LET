import { describe, expect, it } from 'vitest';
import { applyPatch, emptyProfile, formatProfile, takeDueEvents } from '../../src/modules/memory/services/userProfile.service.js';
import { junkReason } from '../../src/modules/memory/services/memoryExtraction.service.js';
import { addDatedThreads, applyUserTurn, type LifeState } from '../../src/modules/conversations/human/lifeState.js';
import { buildHumanPrompt, planReply } from '../../src/modules/conversations/human/compactPrompt.js';
import { personaPackFor } from '../../src/modules/conversations/human/personaPacks/index.js';

const life = (): LifeState => ({ firstMetAt: Date.now(), day: { date: '2026-10-01', told: [], userMoods: [], storyShared: true }, threads: [] });

describe('Deeper memory: the "who they are" card', () => {
  it('builds up a card from patches, without duplicates', () => {
    let p = applyPatch(emptyProfile(), {
      set: { name: 'Rohit', city: 'Pune', work: 'software engineer at an IT company' },
      people: [{ relation: 'sister', name: 'Pooja', note: 'getting married' }],
      add: { likes: ['momos', 'old Kishore songs'], jokes: ['you two joke that his laptop is older than him'] },
    });
    p = applyPatch(p, { add: { likes: ['Momos'] }, people: [{ relation: 'sister', name: 'Pooja', note: 'wedding on 15 Oct' }] });
    expect(p.likes).toEqual(['momos', 'old Kishore songs']);
    expect(p.people).toEqual([{ relation: 'sister', name: 'Pooja', note: 'wedding on 15 Oct' }]);
    p = applyPatch(p, { remove: ['old Kishore songs'] });
    expect(p.likes).toEqual(['momos']);
  });

  it('accepts people and events nested inside "add" (how the model often answers)', () => {
    const p = applyPatch(emptyProfile(), {
      add: { people: [{ relation: 'sister', name: 'Pooja' }], events: [{ what: "sister Pooja's wedding", date: '2026-10-15', kind: 'once' }] },
    } as never);
    expect(p.people[0]?.name).toBe('Pooja');
    expect(p.events[0]?.date).toBe('2026-10-15');
  });

  it('keeps health notes only when sensitive memories are allowed', () => {
    expect(applyPatch(emptyProfile(), { add: { health: ['has PCOS'] } }).health).toEqual([]);
    expect(applyPatch(emptyProfile(), { add: { health: ['has PCOS'] } }, { allowHealth: true }).health).toEqual(['has PCOS']);
  });

  it('shows the card with upcoming dates', () => {
    const p = applyPatch(emptyProfile(), {
      set: { name: 'Rohit', work: 'software engineer' },
      people: [{ relation: 'sister', name: 'Pooja' }],
      add: { jokes: ['you two joke that Lakshmi the buffalo has standards'] },
      events: [
        { what: "sister Pooja's wedding", date: '2026-10-15', kind: 'once' },
        { what: "Rohit's birthday", date: '1999-10-03', kind: 'yearly' },
      ],
    });
    const card = formatProfile(p, '2026-10-01');
    expect(card).toContain('name Rohit');
    expect(card).toContain('sister (Pooja)');
    expect(card).toContain('Lakshmi the buffalo');
    expect(card).toContain("sister Pooja's wedding — on 15 Oct (in 14 days)");
    expect(card).toContain("Rohit's birthday — on 3 Oct (in 2 days)");
  });

  it('asks about an event the day after, and only once', () => {
    const p = applyPatch(emptyProfile(), { events: [{ what: "sister Pooja's wedding", date: '2026-10-15', kind: 'once' }] });
    expect(takeDueEvents(p, '2026-10-15').due).toHaveLength(0);
    const first = takeDueEvents(p, '2026-10-16');
    expect(first.due.map((d) => d.kind)).toEqual(['followup']);
    expect(takeDueEvents(p, '2026-10-17').due).toHaveLength(0);
  });

  it('wishes on the birthday every year', () => {
    const p = applyPatch(emptyProfile(), { events: [{ what: "Rohit's birthday", date: '1999-10-03', kind: 'yearly' }] });
    expect(takeDueEvents(p, '2026-10-02').due).toHaveLength(0);
    expect(takeDueEvents(p, '2026-10-03').due.map((d) => d.kind)).toEqual(['birthday']);
    expect(takeDueEvents(p, '2026-10-03').due).toHaveLength(0);
    expect(takeDueEvents(p, '2027-10-03').due).toHaveLength(1);
  });

  it('puts the birthday first and tells her to wish them', () => {
    const pack = personaPackFor('riya')!;
    const s = life();
    s.threads.push({ kind: 'event', topic: 'interview', said: 'kal interview hai', mentionedAt: Date.now() - 86_400_000, dueAt: Date.now() - 1000 });
    addDatedThreads(s, [{ event: { what: "Rohit's birthday", date: '1999-10-03' }, kind: 'birthday' }]);
    const notes = applyUserTurn({ state: s, pack, userText: 'hi', situations: ['greeting'], userMood: 'neutral' });
    expect(notes.followUp?.kind).toBe('birthday');
    const prompt = buildHumanPrompt({
      pack,
      userName: 'Rohit',
      memoriesText: '',
      relationshipText: '',
      moment: { mood: 'calm', description: 'calm' },
      situations: ['greeting'],
      plan: planReply(['greeting'], [], pack, { continuity: notes }),
      profileText: '- name Rohit',
    });
    expect(prompt).toContain('Wish them first');
    expect(prompt).toContain('Who they are');
  });
});

describe('Deeper memory: saving the right facts', () => {
  const neha = 'Matlab unka budget sirf 5,000 tha, toh purani cushions aur cushions ke covers badal kar aur thode plants lagakar poora makeover kar diya!';
  it("drops the character's own story and chat-meta, keeps real facts", () => {
    expect(junkReason('The user completed a home makeover with cushions, covers and plants on a ₹5,000 budget.', 'Matlab', neha)).toBeTruthy();
    expect(junkReason('The user prefers to communicate with this character via text messages.', 'haan', 'okay')).toBeTruthy();
    expect(junkReason('The user attempted to initiate physical intimacy.', 'kiss karo', 'nahi')).toBeTruthy();
    expect(junkReason('The user prefers to communicate in Hindi.', 'hindi mein baat karo', 'theek hai')).toBeNull();
    expect(junkReason('The user has a history of kidney stones.', 'creatine lena hai par mujhe kidney stone hua tha pichle saal', 'kidney stone ka history hai toh pehle doctor se pucho')).toBeNull();
    expect(junkReason('The user knows tailoring and has 3 free hours a day.', 'silai aati hai, din mein 3 ghante free hoon', 'silai aur 3 ghante, custom alteration business shuru karo')).toBeNull();
  });
});
