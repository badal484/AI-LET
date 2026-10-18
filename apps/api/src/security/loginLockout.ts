import { redis } from '../infrastructure/redis/redis.js';
import { logger } from '../config/logger.js';

/**
 * Per-account sign-in lockout (on top of the per-IP rate limits): after too many wrong passwords or codes for
 * one account within 15 minutes, that account can't sign in for 15 minutes — even from many IP addresses.
 * Admin accounts fail closed if Redis can't be reached (no lockout check = no admin sign-in); users fail open
 * (the per-IP limit still applies) so a Redis outage doesn't lock everyone out.
 */

const WINDOW_SECONDS = 15 * 60;
const MAX_FAILURES = { admin: 5, user: 10 } as const;
type Kind = keyof typeof MAX_FAILURES;

const failKey = (kind: Kind, email: string) => `login:fail:${kind}:${email.trim().toLowerCase()}`;
const lockKey = (kind: Kind, email: string) => `login:lock:${kind}:${email.trim().toLowerCase()}`;

export class LockoutUnavailableError extends Error {}

export async function isLockedOut(kind: Kind, email: string): Promise<boolean> {
  try {
    return (await redis.exists(lockKey(kind, email))) === 1;
  } catch (err) {
    logger.warn(`Lockout check failed (${kind}): ${err instanceof Error ? err.message : 'unknown'}`);
    if (kind === 'admin') throw new LockoutUnavailableError('Sign-in is unavailable right now');
    return false;
  }
}

/** Counts one failed attempt; returns true when this attempt locked the account. */
export async function recordLoginFailure(kind: Kind, email: string): Promise<boolean> {
  try {
    const n = await redis.incr(failKey(kind, email));
    if (n === 1) await redis.expire(failKey(kind, email), WINDOW_SECONDS);
    if (n >= MAX_FAILURES[kind]) {
      await redis.set(lockKey(kind, email), '1', 'EX', WINDOW_SECONDS);
      await redis.del(failKey(kind, email));
      return true;
    }
  } catch (err) {
    logger.warn(`Could not count a failed sign-in (${kind}): ${err instanceof Error ? err.message : 'unknown'}`);
  }
  return false;
}

export async function clearLoginFailures(kind: Kind, email: string): Promise<void> {
  await redis.del(failKey(kind, email)).catch(() => undefined);
}
