import { Prisma } from '@prisma/client';
import { ErrorCode, SOCIAL_CONSTANTS } from '@ai-companion/config';
import type { UsernameAvailability } from '@ai-companion/types';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { AuditService } from '../../audit/audit.service.js';
import { AppError, ConflictError } from '../../../shared/errors/AppError.js';
import { SocialPolicyService } from '../policy/SocialPolicyService.js';

type Tx = Prisma.TransactionClient;

/**
 * Small deterministic lists matched against the canonical skeleton so leetspeak variants are caught.
 * Slurs match anywhere; other terms only at a boundary to avoid "grapefruit"/"torpedo" false positives.
 */
const SLURS = ['nigger', 'nigga', 'faggot'];
const PROFANITY = ['fuck', 'shit', 'bitch', 'cunt', 'retard', 'whore', 'slut', 'rape', 'nazi', 'hitler', 'pedo', 'porn'];

/** Visual confusables folded to a single skeleton character (applied after NFKC + lowercase). */
const CONFUSABLE_SEQUENCES: Array<[RegExp, string]> = [
  [/rn/g, 'm'],
  [/vv/g, 'w'],
  [/cl/g, 'd'],
];
const CONFUSABLE_CHARS: Record<string, string> = {
  '0': 'o', '1': 'l', i: 'l', '!': 'l', '|': 'l', '3': 'e', '4': 'a', '@': 'a', '5': 's', $: 's', '7': 't', '8': 'b', '9': 'g', '2': 'z', '6': 'b',
};

export class UsernameService {
  /** NFKC folds fullwidth/compatibility forms to ASCII; anything still non-ASCII is rejected by `validate`. */
  public static normalize(raw: string): string {
    return raw.normalize('NFKC').trim().replace(/^@+/, '').toLowerCase();
  }

  /** Skeleton used for uniqueness and impersonation checks: `Adm1n`, `a_d_m_i_n`, `adrnin` → `adrnln`→`admln`. */
  public static canonical(normalized: string): string {
    let s = normalized.replace(/[_.]/g, '');
    s = [...s].map((ch) => CONFUSABLE_CHARS[ch] ?? ch).join('');
    for (const [re, rep] of CONFUSABLE_SEQUENCES) s = s.replace(re, rep);
    return s;
  }

  /** Pure format + policy validation (no DB). */
  public static validate(raw: string): { ok: true; normalized: string; canonical: string } | { ok: false; reason: UsernameAvailability['reason']; message: string } {
    const normalized = this.normalize(raw);
    const { MIN_LENGTH, MAX_LENGTH, REGEX, RESERVED, RESERVED_SUBSTRINGS } = SOCIAL_CONSTANTS.USERNAME;

    if (normalized.length < MIN_LENGTH || normalized.length > MAX_LENGTH) {
      return { ok: false, reason: 'INVALID', message: `Usernames must be ${MIN_LENGTH}-${MAX_LENGTH} characters.` };
    }
    if (/[^\x00-\x7F]/.test(normalized)) {
      return { ok: false, reason: 'CONFUSABLE', message: 'Usernames can only use English letters, numbers, dots and underscores.' };
    }
    if (!REGEX.test(normalized) || /[_.]{2,}/.test(normalized)) {
      return { ok: false, reason: 'INVALID', message: 'Use letters, numbers, and single dots or underscores (not at the start or end).' };
    }

    const canonical = this.canonical(normalized);
    const reservedCanon = RESERVED.map((r) => this.canonical(r));
    // Authority terms are blocked at the start/end or as a separated segment ("admin_maya", "mayaofficial"),
    // but not inside unrelated words ("badminton").
    const segments = normalized.split(/[_.]/).map((seg) => this.canonical(seg));
    const impliesAuthority = RESERVED_SUBSTRINGS.some((sub) => {
      const c = this.canonical(sub);
      return canonical.startsWith(c) || canonical.endsWith(c) || segments.includes(c);
    });
    if (reservedCanon.includes(canonical) || impliesAuthority) {
      return { ok: false, reason: 'RESERVED', message: 'That username is reserved.' };
    }
    const atBoundary = (term: string) => {
      const c = this.canonical(term);
      return canonical.startsWith(c) || canonical.endsWith(c) || segments.includes(c);
    };
    if (SLURS.some((p) => canonical.includes(this.canonical(p))) || PROFANITY.some(atBoundary)) {
      return { ok: false, reason: 'PROFANITY', message: "That username isn't allowed." };
    }
    return { ok: true, normalized, canonical };
  }

  /** Full availability check including collisions, confusables, held names and brand reservations. */
  public static async checkAvailability(raw: string, forUserId?: string, db: Tx | typeof prisma = prisma): Promise<UsernameAvailability> {
    const v = this.validate(raw);
    if (!v.ok) return { username: raw, available: false, reason: v.reason, message: v.message };

    const [reserved, collision, held, creatorCollision] = await Promise.all([
      db.socialReservedUsername.findUnique({ where: { canonical: v.canonical } }),
      db.socialProfile.findFirst({
        where: { OR: [{ username: v.normalized }, { usernameCanonical: v.canonical }] },
        select: { userId: true, username: true },
      }),
      db.socialUsernameHistory.findFirst({
        where: { heldCanonical: v.canonical, holdUntil: { gt: new Date() }, ...(forUserId ? { NOT: { userId: forUserId } } : {}) },
        select: { id: true },
      }),
      db.creatorProfile.findFirst({
        where: { username: { equals: v.normalized, mode: 'insensitive' }, ...(forUserId ? { NOT: { userId: forUserId } } : {}) },
        select: { id: true },
      }),
    ]);

    if (reserved && !(forUserId && reserved.reason === `VERIFIED_CREATOR:${forUserId}`)) {
      return { username: v.normalized, available: false, reason: 'RESERVED', message: 'That username is reserved.' };
    }
    if (collision && collision.userId !== forUserId) {
      const exact = collision.username === v.normalized;
      return {
        username: v.normalized,
        available: false,
        reason: exact ? 'TAKEN' : 'CONFUSABLE',
        message: exact ? 'That username is taken.' : 'That username is too similar to an existing one.',
      };
    }
    if (creatorCollision) return { username: v.normalized, available: false, reason: 'TAKEN', message: 'That username is taken.' };
    if (held) return { username: v.normalized, available: false, reason: 'HELD', message: 'That username was recently released and is temporarily unavailable.' };
    return { username: v.normalized, available: true };
  }

  /**
   * Claims (first time) or changes a username inside the caller's transaction.
   * Enforces cooldown, records history and holds the previous name against impersonation.
   */
  public static async claimInTx(tx: Tx, userId: string, raw: string, opts: { isInitial: boolean }): Promise<{ username: string; canonical: string }> {
    const config = await SocialPolicyService.getConfig();
    const profile = await tx.socialProfile.findUnique({ where: { userId }, select: { username: true, usernameCanonical: true, usernameChangedAt: true } });

    if (!opts.isInitial && profile?.usernameChangedAt) {
      const nextAllowed = profile.usernameChangedAt.getTime() + config.username.changeCooldownDays * 86_400_000;
      if (Date.now() < nextAllowed) {
        throw new AppError(
          `You can change your username again on ${new Date(nextAllowed).toDateString()}.`,
          429,
          ErrorCode.SOCIAL_USERNAME_COOLDOWN,
        );
      }
    }

    const availability = await this.checkAvailability(raw, userId, tx);
    if (!availability.available) {
      const code = availability.reason === 'TAKEN' ? ErrorCode.SOCIAL_USERNAME_TAKEN : availability.reason === 'RESERVED' ? ErrorCode.SOCIAL_USERNAME_RESERVED : ErrorCode.SOCIAL_USERNAME_INVALID;
      throw new AppError(availability.message ?? 'Username unavailable', availability.reason === 'TAKEN' ? 409 : 400, code);
    }
    const v = this.validate(raw);
    if (!v.ok) throw new AppError(v.message, 400, ErrorCode.SOCIAL_USERNAME_INVALID);
    if (profile?.username === v.normalized) return { username: v.normalized, canonical: v.canonical };

    await tx.socialUsernameHistory.create({
      data: {
        userId,
        action: opts.isInitial ? 'CLAIM' : 'CHANGE',
        oldUsername: profile?.username ?? null,
        newUsername: v.normalized,
        heldCanonical: profile?.usernameCanonical ?? null,
        holdUntil: profile?.usernameCanonical ? new Date(Date.now() + config.username.releaseHoldDays * 86_400_000) : null,
      },
    });
    return { username: v.normalized, canonical: v.canonical };
  }

  public static async changeUsername(userId: string, raw: string): Promise<string> {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const claimed = await this.claimInTx(tx, userId, raw, { isInitial: false });
        await tx.socialProfile.update({
          where: { userId },
          data: { username: claimed.username, usernameCanonical: claimed.canonical, usernameChangedAt: new Date() },
        });
        return claimed.username;
      });
      await AuditService.log({ actorType: 'USER', actorId: userId, action: 'SOCIAL_USERNAME_CHANGED', resourceType: 'social_profile', resourceId: userId, metadata: { username: result } });
      return result;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError('That username is taken.', ErrorCode.SOCIAL_USERNAME_TAKEN);
      }
      throw err;
    }
  }

  /** Account deletion: username becomes unavailable for the hold period, then free. */
  public static async releaseInTx(tx: Tx, userId: string, actorAdminId?: string): Promise<void> {
    const config = await SocialPolicyService.getConfig();
    const profile = await tx.socialProfile.findUnique({ where: { userId }, select: { username: true, usernameCanonical: true } });
    if (!profile?.username) return;
    await tx.socialUsernameHistory.create({
      data: {
        userId,
        action: actorAdminId ? 'ADMIN_RESET' : 'RELEASE',
        oldUsername: profile.username,
        heldCanonical: profile.usernameCanonical,
        holdUntil: new Date(Date.now() + config.username.releaseHoldDays * 86_400_000),
        actorAdminId: actorAdminId ?? null,
      },
    });
    await tx.socialProfile.update({ where: { userId }, data: { username: null, usernameCanonical: null } });
  }

  /** Verified creators' names are reserved so lookalikes can't be registered by others. */
  public static async protectVerifiedCreator(userId: string, creatorUsername: string): Promise<void> {
    const v = this.validate(creatorUsername);
    if (!v.ok) return;
    await prisma.socialReservedUsername.upsert({
      where: { canonical: v.canonical },
      create: { canonical: v.canonical, reason: `VERIFIED_CREATOR:${userId}` },
      update: {},
    });
  }
}
