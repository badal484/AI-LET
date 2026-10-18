import { prisma } from '../../infrastructure/database/prisma.js';
import { redis } from '../../infrastructure/redis/redis.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCode } from '@ai-companion/config';
import { AuditService } from '../audit/audit.service.js';
import { generateTotpSecret, otpauthUri, verifyTotp } from '../../security/totp.js';
import { openSecret, sealSecret } from '../../security/secretBox.js';

/**
 * Two-step sign-in for the admin console (audit H-2): a 6-digit code from an authenticator app.
 * Required in production by default (ADMIN_REQUIRE_MFA=false turns it off). An admin who hasn't set it up yet
 * can sign in with the password, but can only reach the setup screen until they finish it.
 * Lost phone: an owner runs scripts/maintenance/resetAdminMfa.ts.
 */

export const adminMfaRequired = (): boolean =>
  process.env['ADMIN_REQUIRE_MFA'] ? process.env['ADMIN_REQUIRE_MFA'] === 'true' : process.env['NODE_ENV'] === 'production';

const pendingKey = (adminId: string) => `admin:mfa:pending:${adminId}`;
const usedKey = (adminId: string, step: number) => `admin:mfa:used:${adminId}:${step}`;

/** Each code works once: a code seen again (within its 90-second life) is refused. Fails closed. */
async function claimStep(adminId: string, step: number): Promise<boolean> {
  const ok = await redis.set(usedKey(adminId, step), '1', 'EX', 120, 'NX').catch(() => null);
  return ok === 'OK';
}

export const AdminMfaService = {
  /** Starts setup: a new secret, kept for 10 minutes until a first code confirms it. */
  async setup(adminId: string, email: string): Promise<{ otpauthUri: string; secret: string }> {
    const secret = generateTotpSecret();
    await redis.set(pendingKey(adminId), sealSecret(secret), 'EX', 600);
    return { otpauthUri: otpauthUri(email, secret), secret };
  },

  /** Confirms setup with a code from the app; from now on every sign-in needs a code. */
  async enable(adminId: string, code: string, meta: { ip?: string; userAgent?: string } = {}): Promise<void> {
    const sealed = await redis.get(pendingKey(adminId));
    if (!sealed) throw new AppError('Setup expired — start again', 400, ErrorCode.BAD_REQUEST);
    const secret = openSecret(sealed);
    const step = verifyTotp(secret, code);
    if (step === null || !(await claimStep(adminId, step))) {
      throw new AppError('That code is not right — check the time on your phone and try the newest code', 400, ErrorCode.AUTH_MFA_INVALID);
    }
    await prisma.adminUser.update({ where: { id: adminId }, data: { isMfaEnabled: true, mfaSecret: sealSecret(secret) } });
    await redis.del(pendingKey(adminId));
    await AuditService.logEvent({ actorType: 'ADMIN', actorId: adminId, action: 'ADMIN_MFA_ENABLED', resourceType: 'AdminUser', resourceId: adminId, ipAddress: meta.ip, userAgent: meta.userAgent });
  },

  /** Checks a sign-in code (once per code). */
  async verifyLogin(admin: { id: string; mfaSecret: string | null }, code: string | undefined): Promise<boolean> {
    if (!admin.mfaSecret || !code) return false;
    let secret: string;
    try {
      secret = openSecret(admin.mfaSecret);
    } catch {
      return false; // an old or unreadable secret: refuse rather than let anything through
    }
    const step = verifyTotp(secret, code);
    return step !== null && (await claimStep(admin.id, step));
  },
};
