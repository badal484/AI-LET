import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../../infrastructure/database/prisma.js';
import { isRomancePack } from '../conversations/human/personaPacks/index.js';

/**
 * Age rules (owner's decision, 18 Oct 2026): Loveek is for ages 13 and up; romance characters (partners, crushes,
 * flirty friends — and the "love" category) are 18+ only: under-18s still see them, blurred with "18+ only"
 * (ageRestricted: true in every response), and can't chat with them (refused on the server). Onboarding asks the age; it's stored as an estimated date of
 * birth (age years before that day) so the age goes up by itself. Accounts from before (no age) count as adults —
 * they confirmed 18+ at sign-up. In chat, someone who says they're under 18 is also handled (no flirting).
 */

export const MIN_AGE = 13; // 13, not 12: under-13 users bring Google Play's Families policy (owner, 18 Oct 2026)
export const ADULT_AGE = 18;

export function dobFromAge(age: number, now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear() - age, now.getUTCMonth(), now.getUTCDate()));
}

export function ageFromDob(dob: Date, now = new Date()): number {
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  if (now.getUTCMonth() < dob.getUTCMonth() || (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

const cache = new Map<string, { teen: boolean; at: number }>();

/** True for a signed-in user under 18 (cached 60 s per process). */
export async function isTeen(userId: string | undefined | null): Promise<boolean> {
  if (!userId) return false;
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < 60_000) return hit.teen;
  const profile = await prisma.userProfile.findUnique({ where: { userId }, select: { dateOfBirth: true } }).catch(() => null);
  const teen = Boolean(profile?.dateOfBirth && ageFromDob(profile.dateOfBirth) < ADULT_AGE);
  cache.set(userId, { teen, at: Date.now() });
  return teen;
}

export function forgetAge(userId: string): void {
  cache.delete(userId);
}

/** A romance character: its persona is a partner/crush/flirty friend, or it sits in the "love" category. */
export function isRomanceCharacter(c: { slug?: unknown; category?: unknown; categorySlug?: unknown }): boolean {
  if (typeof c.slug === 'string' && isRomancePack(c.slug)) return true;
  const cat = typeof c.categorySlug === 'string' ? c.categorySlug : typeof c.category === 'string' ? c.category : typeof (c.category as { slug?: unknown })?.slug === 'string' ? (c.category as { slug: string }).slug : '';
  return cat.toLowerCase() === 'love';
}

const looksLikeCharacter = (v: unknown): v is Record<string, unknown> =>
  Boolean(v && typeof v === 'object' && typeof (v as { slug?: unknown }).slug === 'string' && ('name' in (v as object) || 'avatarUrl' in (v as object)));

/** Marks every romance character in a response (lists and single objects) with ageRestricted: true. */
export function markRomance<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => markRomance(v)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = markRomance(v);
    if (looksLikeCharacter(value) && isRomanceCharacter(value)) out['ageRestricted'] = true;
    return out as T;
  }
  return value;
}

/**
 * For every API response (app.ts): in an under-18's responses, romance characters carry ageRestricted: true (the
 * app blurs them with "18+ only"). Checked when the response is sent, after the route's own sign-in check has run.
 */
export function markRomanceForTeens(req: Request, res: Response, next: NextFunction): void {
  const json = res.json.bind(res);
  res.json = ((body: unknown) => {
    const userId = (req as { user?: { userId?: string } }).user?.userId;
    if (!userId) return json(body);
    void isTeen(userId)
      .then((teen) => json(teen ? markRomance(body) : body))
      .catch(() => json(body));
    return res;
  }) as Response['json'];
  next();
}
