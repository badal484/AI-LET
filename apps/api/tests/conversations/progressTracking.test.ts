import { describe, expect, it } from 'vitest';
import {
  addTask,
  applyPatch,
  emptyProfile,
  formatProgress,
  normalizeProfile,
  openTask,
  recordTaskResult,
} from '../../src/modules/memory/services/userProfile.service.js';
import { applyUserTurn, restoreTaskThread, type LifeState } from '../../src/modules/conversations/human/lifeState.js';
import { buildHumanPrompt, planReply } from '../../src/modules/conversations/human/compactPrompt.js';
import { personaPackFor } from '../../src/modules/conversations/human/personaPacks/index.js';

const life = (): LifeState => ({ firstMetAt: Date.now(), day: { date: '2026-10-01', told: [], userMoods: [], storyShared: true }, threads: [] });

describe('Progress tracking: mentors remember the tasks they gave and how they went', () => {
  it('records a new task as the open one, without duplicates', () => {
    const p = emptyProfile();
    addTask(p, 'send 5 proposals', '2026-10-01');
    addTask(p, 'Send 5 proposals', '2026-10-01');
    expect(p.tasks).toEqual([{ what: 'send 5 proposals', given: '2026-10-01' }]);
    expect(openTask(p)?.what).toBe('send 5 proposals');
  });

  it('a re-worded open task is not a second task', () => {
    const p = emptyProfile();
    addTask(p, 'resume ka project section numbers ke saath rewrite karna', '2026-10-01');
    addTask(p, 'resume ka project section rewrite karna', '2026-10-02');
    expect(p.tasks).toHaveLength(1);
    addTask(p, '5 jagah apply karna aur referral mangna', '2026-10-02');
    expect(p.tasks).toHaveLength(2);
  });

  it('applies a reported result to the open task (even when the model paraphrases it)', () => {
    const p = emptyProfile();
    addTask(p, 'send 5 proposals on Upwork', '2026-10-01');
    const next = applyPatch(p, { tasks: [{ what: 'sent proposals', result: 'partly', note: '3 sent, 1 reply' }] }, { today: '2026-10-02' });
    expect(next.tasks[0]).toMatchObject({ result: 'partly', note: '3 sent, 1 reply', reported: '2026-10-02' });
    expect(openTask(next)).toBeUndefined();
  });

  it('a task given in this very exchange cannot be judged yet', () => {
    const p = emptyProfile();
    addTask(p, 'resume ka project section rewrite karna', '2026-10-01');
    const next = applyPatch(p, { tasks: [{ what: 'resume', result: 'partly', note: 'started' }] }, { today: '2026-10-01', justGivenTask: 'Resume ka project section rewrite karna' });
    expect(openTask(next)?.what).toBe('resume ka project section rewrite karna');
    const later = applyPatch(next, { tasks: [{ what: 'resume', result: 'done' }] }, { today: '2026-10-02' });
    expect(later.tasks[0]?.result).toBe('done');
  });

  it('ignores invented results and tasks that are already closed', () => {
    const p = emptyProfile();
    expect(recordTaskResult(p, { what: 'anything', result: 'done' }, '2026-10-02')).toBe(false);
    addTask(p, 'first workout', '2026-10-01');
    expect(recordTaskResult(p, { what: 'first workout', result: 'crushed it' }, '2026-10-02')).toBe(false);
    expect(recordTaskResult(p, { what: 'first workout', result: 'done' }, '2026-10-02')).toBe(true);
    expect(recordTaskResult(p, { what: 'first workout', result: 'skipped' }, '2026-10-03')).toBe(false);
    expect(p.tasks[0]?.result).toBe('done');
  });

  it('survives a round trip through the database JSON, keeping only the last 8', () => {
    const p = emptyProfile();
    for (let i = 1; i <= 10; i++) addTask(p, `task ${i}`, '2026-10-01');
    const back = normalizeProfile(JSON.parse(JSON.stringify(p)));
    expect(back.tasks.map((t) => t.what)).toEqual(['task 3', 'task 4', 'task 5', 'task 6', 'task 7', 'task 8', 'task 9', 'task 10']);
    expect(normalizeProfile({ tasks: [{ what: 'x', given: 'yesterday' }, { what: 'y', given: '2026-10-01', result: 'maybe' }] }).tasks).toEqual([
      { what: 'y', given: '2026-10-01', result: undefined, note: undefined, reported: undefined, asked: undefined },
    ]);
  });

  it('shows the open task, the track record and a streak', () => {
    const p = emptyProfile();
    for (const [what, day] of [['workout 1', '2026-09-26'], ['workout 2', '2026-09-28'], ['workout 3', '2026-09-30']] as const) {
      addTask(p, what, day);
      recordTaskResult(p, { result: 'done' }, day);
    }
    addTask(p, 'workout 4', '2026-10-01');
    const text = formatProgress(p, '2026-10-02');
    expect(text).toContain('Open task: "workout 4" (given yesterday)');
    expect(text).toContain('"workout 3" — did it');
    expect(text).toContain('last 3 tasks in a row');
    expect(formatProgress(emptyProfile(), '2026-10-02')).toBe('');
  });

  it('after skipped tasks, suggests a smaller next step — never guilt', () => {
    const p = emptyProfile();
    for (const what of ['a', 'b']) {
      addTask(p, what, '2026-10-01');
      recordTaskResult(p, { result: 'skipped' }, '2026-10-01');
    }
    expect(formatProgress(p, '2026-10-02')).toMatch(/no guilt.*smaller/);
  });

  it('brings the follow-up back when the short-term state was lost', () => {
    const s = life();
    const now = Date.parse('2026-10-02T12:00:00+05:30');
    restoreTaskThread(s, { what: 'send 5 proposals', given: '2026-10-01' }, now);
    expect(s.threads).toHaveLength(1);
    const pack = personaPackFor('raj-bansal')!;
    const notes = applyUserTurn({ state: s, pack, userText: 'hi', situations: ['greeting'], userMood: 'neutral', now });
    expect(notes.followUp?.said).toBe('send 5 proposals');
  });

  it('does not restore a task already asked about, a stale task, or a second task thread', () => {
    const now = Date.parse('2026-10-02T12:00:00+05:30');
    const asked = life();
    restoreTaskThread(asked, { what: 'x', given: '2026-10-01', asked: '2026-10-02' }, now);
    expect(asked.threads).toHaveLength(0);
    const stale = life();
    restoreTaskThread(stale, { what: 'x', given: '2026-09-20' }, now);
    expect(stale.threads).toHaveLength(0);
    const busy = life();
    busy.threads.push({ kind: 'task', topic: 'task', said: 'newer task', mentionedAt: now, dueAt: now + 1 });
    restoreTaskThread(busy, { what: 'x', given: '2026-10-01' }, now);
    expect(busy.threads.map((t) => t.said)).toEqual(['newer task']);
  });

  it('mentors see their coaching history in the prompt; companions never do', () => {
    const progressText = '- Open task: "send 5 proposals" (given yesterday)';
    const build = (slug: string) => {
      const pack = personaPackFor(slug)!;
      return buildHumanPrompt({
        pack,
        userName: 'Rohit',
        memoriesText: '',
        relationshipText: '',
        moment: { mood: 'calm', description: 'calm' },
        situations: ['greeting'],
        plan: planReply(['greeting'], [], pack, { mentor: Boolean(pack.mentor) }),
        progressText,
      });
    };
    expect(build('raj-bansal')).toContain('Your coaching with them so far');
    expect(build('raj-bansal')).toContain('send 5 proposals');
    expect(build('kabir-sethi')).not.toContain('send 5 proposals');
  });
});
