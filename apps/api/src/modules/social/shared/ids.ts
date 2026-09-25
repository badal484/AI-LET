import crypto from 'crypto';
import { SOCIAL_CONSTANTS } from '@ai-companion/config';
import { BadRequestError } from '../../../shared/errors/AppError.js';

/**
 * Opaque, non-sequential public identifier (128 bits of entropy, base64url).
 * Used for profiles and share tokens. Never derived from database ids.
 */
export function generatePublicId(): string {
  return crypto.randomBytes(SOCIAL_CONSTANTS.PUBLIC_ID_BYTES).toString('base64url');
}

export function pairKey(userA: string, userB: string): string {
  return userA < userB ? `${userA}:${userB}` : `${userB}:${userA}`;
}

export interface SocialCursor {
  /** ISO timestamp of the last item on the previous page. */
  t: string;
  /** Tie-breaker id of the last item. */
  id: string;
}

export function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ t: createdAt.toISOString(), id } satisfies SocialCursor)).toString('base64url');
}

export function decodeCursor(cursor?: string | null): SocialCursor | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as SocialCursor;
    if (typeof parsed.t !== 'string' || typeof parsed.id !== 'string' || Number.isNaN(Date.parse(parsed.t))) {
      throw new Error('bad cursor');
    }
    return parsed;
  } catch {
    throw new BadRequestError('Invalid pagination cursor');
  }
}

/**
 * Prisma `where` fragment for keyset pagination over (createdAtField DESC, id DESC).
 * Wrapped in `AND` so spreading it never overwrites a sibling `OR` filter in the same object.
 */
export function keysetAfter(cursor: SocialCursor | null, field = 'createdAt'): Record<string, unknown> {
  if (!cursor) return {};
  const t = new Date(cursor.t);
  return {
    AND: [{ OR: [{ [field]: { lt: t } }, { [field]: t, id: { lt: cursor.id } }] }],
  };
}

/** Takes limit+1 rows and splits into page + next cursor. */
export function toPage<T>(
  rows: T[],
  limit: number,
  cursorOf: (row: T) => { at: Date; id: string },
): { items: T[]; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  if (!hasMore || !last) return { items, nextCursor: null };
  const c = cursorOf(last);
  return { items, nextCursor: encodeCursor(c.at, c.id) };
}

export function stableHash(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/** Deterministic 0-99 bucket for percentage rollouts. */
export function rolloutBucket(subjectId: string, salt: string): number {
  const h = crypto.createHash('sha256').update(`${salt}:${subjectId}`).digest();
  return h.readUInt32BE(0) % 100;
}
