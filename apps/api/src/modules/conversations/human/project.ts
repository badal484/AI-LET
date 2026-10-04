import type { ProfileProject, UserProfile } from '../../memory/services/userProfile.service.js';

/**
 * Project memory: what a mentor and the user are building together (a debugging tool, a YouTube channel,
 * a home business). A real mentor opens with "kal log reader bana — aaj step 3", which is what brings
 * people back. The mentor keeps it current with a hidden last line:
 *   [[project: goal=AI error-debugging tool | stack=Python + OpenAI API | done=log reader | next=read a real error file]]
 */
export interface ProjectPatch {
  goal?: string;
  stack?: string;
  done?: string;
  next?: string;
}

const TAG = /\[\[\s*project\s*:\s*([^\]]{3,400})\]\]/gi;

export function extractProjectTag(text: string): { text: string; patch?: ProjectPatch } {
  let patch: ProjectPatch | undefined;
  const cleaned = text.replace(TAG, (_m, body: string) => {
    const p: ProjectPatch = {};
    for (const part of body.split('|')) {
      const m = /^\s*(goal|stack|done|next)\s*[=:]\s*(.+?)\s*$/i.exec(part);
      // "none", "-", "n/a" are not steps.
      if (m && !/^(none|nothing|na|n\/a|-+|null|tbd|\?)$/i.test(m[2]!.trim())) p[m[1]!.toLowerCase() as keyof ProjectPatch] = m[2]!.slice(0, 120);
    }
    if (Object.keys(p).length) patch = { ...patch, ...p };
    return '';
  });
  return { text: cleaned.trim(), patch };
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/** Merge a patch: a new goal starts a new project; "done" steps accumulate (no duplicates). */
export function applyProjectPatch(profile: UserProfile, patch: ProjectPatch, today: string): UserProfile {
  const current = profile.project;
  const newGoal = patch.goal && (!current || norm(current.goal) !== norm(patch.goal));
  const base: ProfileProject = newGoal || !current ? { goal: patch.goal ?? current?.goal ?? '', done: [], updated: today } : { ...current, done: [...current.done] };
  if (!base.goal) return profile;
  if (patch.stack) base.stack = patch.stack;
  if (patch.done && !base.done.some((d) => norm(d) === norm(patch.done!))) base.done = [...base.done, patch.done].slice(-8);
  if (patch.next) base.next = patch.next;
  base.updated = today;
  return { ...profile, project: base };
}

/** What the mentor should know about the project, and whether to open with a recap. */
export function projectLines(project: ProfileProject | undefined, opts: { newSession: boolean }): string[] {
  if (!project) return [];
  const lines = [
    `What you're building with them: ${project.goal}${project.stack ? ` (${project.stack})` : ''}.${project.done.length ? ` Done so far: ${project.done.join('; ')}.` : ''}${project.next ? ` Next step: ${project.next}.` : ''}`,
  ];
  if (opts.newSession) {
    lines.push('This is a new session: open with a one-line recap of where the project is (e.g. "Kal humne file padhne wala part banaya…") — if you are also asking about a task, put both in that same opening — then respond to what they said.');
  }
  return lines;
}

export const PROJECT_LINE =
  'Keep a record of what you are building together. When the goal, the tools, a finished step or the next step changes, add a hidden last line: [[project: goal=… | stack=… | done=… | next=…]] (only the parts that changed). They never see it.';

/**
 * A shared project for a non-mentor (Nandini and the user design a dream home together): offered when the
 * chat is light, built one choice at a time, every choice remembered. Same [[project: …]] tag as mentors.
 */
export function sharedProjectLines(sp: { goal: string; invite: string }, project: ProfileProject | undefined): string[] {
  if (!project || project.goal.toLowerCase() !== sp.goal.toLowerCase()) {
    return [
      `Something fun you can start with them — only when the chat is light or they're bored, never when they're upset, and not every chat: ${sp.invite}. If they're in, add a hidden last line [[project: goal=${sp.goal} | next=<the first thing to decide>]].`,
    ];
  }
  const done = project.done.length ? ` Their choices so far: ${project.done.join('; ')}.` : '';
  return [
    `You and they are slowly building "${project.goal}" together.${done}${project.next ? ` Next to decide: ${project.next}.` : ''} Bring it up now and then when the chat is light (not every chat), remember and use their choices ("tumne neeli diwaar chuni thi…"), and suggest the next small decision. When they choose something, add a hidden last line [[project: done=<their choice, a few words> | next=<the next thing to decide>]].`,
  ];
}
