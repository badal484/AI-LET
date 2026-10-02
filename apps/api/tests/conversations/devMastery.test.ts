import { describe, expect, it } from 'vitest';
import { execSync } from 'child_process';
import { applyProjectPatch, extractProjectTag, projectLines } from '../../src/modules/conversations/human/project.js';
import { checkCodeSyntax, describeIssues } from '../../src/modules/conversations/human/codeCheck.js';
import { emptyProfile } from '../../src/modules/memory/services/userProfile.service.js';

const hasPython = (() => {
  try {
    execSync('python3 --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

describe('Project memory', () => {
  it('reads the hidden project line and keeps it out of the reply', () => {
    const r = extractProjectTag('badhiya!\n[[project: goal=AI error-debugging tool | stack=Python + OpenAI API | done=log reader | next=read a real error file]]');
    expect(r.text).toBe('badhiya!');
    expect(r.patch).toEqual({ goal: 'AI error-debugging tool', stack: 'Python + OpenAI API', done: 'log reader', next: 'read a real error file' });
  });

  it('builds the project step by step, and a new goal starts a new project', () => {
    let p = applyProjectPatch(emptyProfile(), { goal: 'AI error-debugging tool', stack: 'Python', done: 'log reader', next: 'file input' }, '2026-10-02');
    p = applyProjectPatch(p, { done: 'file input', next: 'save answers to a file' }, '2026-10-03');
    p = applyProjectPatch(p, { done: 'file input' }, '2026-10-03');
    expect(p.project).toEqual({ goal: 'AI error-debugging tool', stack: 'Python', done: ['log reader', 'file input'], next: 'save answers to a file', updated: '2026-10-03' });
    p = applyProjectPatch(p, { goal: 'Portfolio website' }, '2026-10-04');
    expect(p.project?.done).toEqual([]);
  });

  it('opens a new session with a recap', () => {
    const project = { goal: 'AI error-debugging tool', stack: 'Python', done: ['log reader'], next: 'read a real file', updated: '2026-10-02' };
    expect(projectLines(project, { newSession: true }).join(' ')).toMatch(/recap/);
    expect(projectLines(project, { newSession: false }).join(' ')).not.toMatch(/recap/);
    expect(projectLines(undefined, { newSession: true })).toEqual([]);
  });
});

describe('Code is checked before it is sent (parsed, never run)', () => {
  it('finds JavaScript and JSON syntax errors with the line', async () => {
    const issues = await checkCodeSyntax([
      { lang: 'javascript', code: 'const a = {;\nconsole.log(a)' },
      { lang: 'typescript', code: 'const a: number = 1;\nexport default a;' },
      { lang: 'json', code: '{"a": 1,}' },
    ]);
    expect(issues.map((i) => i.lang)).toEqual(['javascript', 'json']);
    expect(describeIssues(issues)[0]).toMatch(/javascript code has a syntax error at line 1/);
  });

  it.runIf(hasPython)('finds a Python indentation error with the line', async () => {
    const issues = await checkCodeSyntax([
      { lang: 'python', code: 'with open("a") as f:\nprint(f.read())' },
      { lang: 'python', code: 'import os\nprint(os.getcwd())' },
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ lang: 'python', line: 2 });
  });
});
