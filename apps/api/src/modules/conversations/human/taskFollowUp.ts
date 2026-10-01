/**
 * A mentor who was told to ask "did you do the task?" sometimes just says hi. The editor pass uses
 * this to notice that the reply never touched the task, so it can ask for a rewrite.
 */
const STOP = new Set([
  'karna', 'karni', 'karne', 'banana', 'banani', 'likhna', 'likhni', 'bhejna', 'lena', 'dena', 'apna', 'apni', 'apne', 'liye',
  'saath', 'wala', 'wali', 'wale', 'aur', 'mein', 'try', 'this', 'that', 'with', 'your', 'kuch', 'ek', 'har', 'roz', 'aaj',
]);

/** The words that identify a task ("office crush ke liye pehla message draft karna" → office, crush, pehla, message, draft). */
export function taskKeywords(task: string): string[] {
  return [...new Set(task.toLowerCase().split(/[^\p{L}\p{N}]+/u))].filter((w) => w.length >= 4 && !STOP.has(w));
}

/** Did the reply ask about (or refer to) the task? Two of its words, or the only one it has, or "task/kaam" + a question. */
export function mentionsTask(reply: string, task: string): boolean {
  const text = reply.toLowerCase();
  const words = taskKeywords(task);
  const hits = words.filter((w) => text.includes(w.length > 5 ? w.slice(0, -1) : w)).length;
  if (hits >= Math.min(2, words.length) && words.length > 0) return true;
  return /\b(task|kaam|homework|challenge)\b/.test(text) && /\?/.test(text);
}
