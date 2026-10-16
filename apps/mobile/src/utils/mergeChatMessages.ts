/** Anything with a time — the chat's message items. */
interface Timed {
  createdAt: string;
}

/** A local message older than this is no longer "being sent"; it only lives on this phone (e.g. crisis-support words). */
const IN_FLIGHT_MS = 2 * 60_000;

/**
 * The chat list, newest first (the list is inverted). Messages still being sent stay at the very bottom;
 * other phone-only messages are placed by time among the server's messages, never pinned under newer ones.
 * `local` must already exclude messages the server has saved (the chat drops those as soon as they're saved).
 */
export function mergeChatMessages<T extends Timed>(local: T[], server: T[], now = Date.now()): T[] {
  const inFlight = (m: T) => now - new Date(m.createdAt).getTime() < IN_FLIGHT_MS;
  const byTimeDesc = (a: T, b: T) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  return [...local.filter(inFlight), ...[...local.filter((m) => !inFlight(m)), ...server].sort(byTimeDesc)];
}
