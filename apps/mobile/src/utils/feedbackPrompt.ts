/**
 * When to ask "Helpful? 👍 👎": only after real help (code, a plan or list, a proper explanation),
 * never after small talk, and at most once a day per chat — asking every time is just noise.
 */
export const HELPFUL_ASK_EVERY_MS = 24 * 3_600_000;

export function looksLikeRealHelp(answer: string[]): boolean {
  const all = answer.join('\n');
  if (answer.some((m) => m.startsWith('```'))) return true;
  const listLines = all.split('\n').filter((l) => /^\s*([-*•]|\d+[.)])\s+\S/.test(l)).length;
  return listLines >= 3 || all.length >= 350;
}

export function mayAskHelpful(lastAskedAt: number | null, now = Date.now()): boolean {
  return !lastAskedAt || now - lastAskedAt >= HELPFUL_ASK_EVERY_MS;
}
