import { prisma } from '../../infrastructure/database/prisma.js';
import { hashPassword, verifyPassword, validatePasswordStrength } from '../../security/password.js';
import {
  generateRandomToken,
  hashToken,
  signAccessToken,
} from '../../security/tokens.js';
import { AuditService } from '../audit/audit.service.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCode, SYSTEM_CONSTANTS } from '@ai-companion/config';
import {
  RegisterRequestInput,
  LoginRequestInput,
  GoogleSignInRequestInput,
  ResetPasswordRequestInput,
} from '@ai-companion/validation';
import { Prisma, UserStatus } from '@prisma/client';
import { verifyGoogleJwt } from '../../security/googleIdToken.js';
import crypto from 'crypto';
import { Realtime } from '../../infrastructure/realtime/realtime.js';
import { AccountDeletionService } from '../privacy/services/AccountDeletionService.js';
import { publicOrigin, sendEmail } from '../../infrastructure/email/email.js';
import { clearLoginFailures, isLockedOut, recordLoginFailure } from '../../security/loginLockout.js';

export class AuthService {
  /**
   * Registers a new user with email and password.
   */
  static async register(
    input: RegisterRequestInput,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const normalizedEmail = input.email.trim().toLowerCase();

    // 1. Password strength validation
    const passwordValidation = validatePasswordStrength(input.password);
    if (!passwordValidation.isValid) {
      throw new AppError(
        passwordValidation.message || 'Password does not meet complexity requirements',
        400,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // 2. Check for duplicate account
    const existingUser = await prisma.user.findFirst({
      where: { normalizedEmail },
    });

    if (existingUser) {
      throw new AppError(
        'An account with this email address already exists',
        409,
        ErrorCode.AUTH_EMAIL_ALREADY_EXISTS,
      );
    }

    // 3. Hash password using Argon2id
    const passwordHash = await hashPassword(input.password);

    // 4. Create User, UserProfile, AuthIdentity, Device & Session within a single transaction
    const tokenFamilyId = crypto.randomUUID();
    const rawRefreshToken = generateRandomToken(48);
    const refreshTokenHash = hashToken(rawRefreshToken);
    const refreshExpiresAt = new Date(
      Date.now() + SYSTEM_CONSTANTS.AUTH.REFRESH_TOKEN_LIFETIME_SECONDS * 1000,
    );

    const result = await prisma.$transaction(async tx => {
      const user = await tx.user.create({
        data: {
          email: input.email.trim(),
          normalizedEmail,
          passwordHash,
          status: UserStatus.ACTIVE,
          lastLoginAt: new Date(),
          lastActiveAt: new Date(),
        },
      });

      const profile = await tx.userProfile.create({
        data: {
          userId: user.id,
          displayName: input.displayName.trim(),
          username: input.username?.trim() || null,
          locale: input.locale || 'en-US',
          timezone: input.timezone || 'UTC',
          preferredLanguage: 'en',
        },
      });

      await tx.authIdentity.create({
        data: {
          userId: user.id,
          provider: 'email',
          providerSubject: normalizedEmail,
          providerEmail: normalizedEmail,
        },
      });

      let deviceId: string | undefined;
      if (input.device) {
        const device = await tx.device.create({
          data: {
            userId: user.id,
            platform: input.device.platform || 'unknown',
            appVersion: input.device.appVersion,
            osVersion: input.device.osVersion,
            deviceName: input.device.deviceName,
            pushToken: input.device.pushToken,
          },
        });
        deviceId = device.id;
      }

      const session = await tx.session.create({
        data: {
          userId: user.id,
          deviceId,
          tokenFamilyId,
          refreshTokenHash,
          expiresAt: refreshExpiresAt,
          ipAddress,
          userAgent,
        },
      });

      // Generate email verification token
      const rawVerificationToken = generateRandomToken(32);
      const verificationTokenHash = hashToken(rawVerificationToken);
      const verificationExpiresAt = new Date(
        Date.now() + SYSTEM_CONSTANTS.AUTH.EMAIL_VERIFICATION_TOKEN_LIFETIME_SECONDS * 1000,
      );

      await tx.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash: verificationTokenHash,
          expiresAt: verificationExpiresAt,
        },
      });

      return { user, profile, session, rawVerificationToken };
    });
    // Open admin tabs: a new sign-up.
    Realtime.admin({ kind: 'signup' });

    // 5. Generate short-lived access token
    const accessToken = signAccessToken({
      userId: result.user.id,
      email: result.user.email,
      roles: ['USER'],
      sessionId: result.session.id,
      deviceId: result.session.deviceId || undefined,
      emailVerified: false,
    });

    // Verification link by email (when email is set up). Never blocks or fails the sign-up.
    void AuthService.sendVerificationEmail(result.user.email, result.rawVerificationToken).catch(() => undefined);

    // 6. Security Audit Event
    await AuditService.logEvent({
      actorType: 'USER',
      actorId: result.user.id,
      action: 'USER_REGISTERED',
      resourceType: 'User',
      resourceId: result.user.id,
      metadata: { email: normalizedEmail, ageConfirmed18Plus: true },
      ipAddress,
      userAgent,
    });

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        status: result.user.status,
        emailVerified: false,
        profile: {
          id: result.profile.id,
          displayName: result.profile.displayName,
          username: result.profile.username,
          locale: result.profile.locale,
          timezone: result.profile.timezone,
        },
      },
      tokens: {
        accessToken,
        refreshToken: rawRefreshToken,
        expiresIn: SYSTEM_CONSTANTS.AUTH.ACCESS_TOKEN_LIFETIME_SECONDS,
        tokenType: 'Bearer',
      },
      // In development / test environment, return verification token for seamless automated testing
      verificationToken:
        process.env['NODE_ENV'] !== 'production' ? result.rawVerificationToken : undefined,
    };
  }

  /**
   * Authenticates an existing user and issues a fresh session with a new token family.
   */
  static async login(
    input: LoginRequestInput,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const normalizedEmail = input.email.trim().toLowerCase();

    // Too many wrong passwords for this account (from any IP): 15 minutes off (audit H-2).
    if (await isLockedOut('user', normalizedEmail)) {
      throw new AppError('Too many wrong tries — please wait 15 minutes, or reset your password', 429, ErrorCode.RATE_LIMIT_EXCEEDED);
    }

    const user = await prisma.user.findFirst({
      where: { normalizedEmail },
      include: { profile: true },
    });

    // Constant-time / generic credential verification to avoid user enumeration
    if (!user || !user.passwordHash) {
      await AuditService.logEvent({
        actorType: 'USER',
        action: 'USER_LOGIN_FAILED',
        resourceType: 'User',
        metadata: { email: normalizedEmail, reason: 'user_not_found_or_no_password' },
        ipAddress,
        userAgent,
      });
      await recordLoginFailure('user', normalizedEmail);
      throw new AppError(
        'Invalid email or password',
        401,
        ErrorCode.AUTH_INVALID_CREDENTIALS,
      );
    }

    const isPasswordValid = await verifyPassword(input.password, user.passwordHash);
    if (!isPasswordValid) {
      await AuditService.logEvent({
        actorType: 'USER',
        actorId: user.id,
        action: 'USER_LOGIN_FAILED',
        resourceType: 'User',
        resourceId: user.id,
        metadata: { email: normalizedEmail, reason: 'invalid_password' },
        ipAddress,
        userAgent,
      });
      await recordLoginFailure('user', normalizedEmail);
      throw new AppError(
        'Invalid email or password',
        401,
        ErrorCode.AUTH_INVALID_CREDENTIALS,
      );
    }

    await clearLoginFailures('user', normalizedEmail);
    return AuthService.startSession(user, input.device, ipAddress, userAgent, 'USER_LOGIN_SUCCESS');
  }

  /**
   * "Continue with Google". The ID token from Google's account picker is checked against Google's keys (our Web
   * client id as audience, a Google-verified email). Then:
   *  - a Google account seen before → its user;
   *  - an existing account with that email → linked to Google (Google has verified the address) and signed in;
   *  - otherwise a new account (the "I am 18 or older" confirmation is required), email already verified.
   */
  static async googleSignIn(input: GoogleSignInRequestInput, ipAddress?: string, userAgent?: string) {
    const audience = (process.env['GOOGLE_WEB_CLIENT_ID'] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!audience.length) throw new AppError('Google sign-in is not set up yet', 503, ErrorCode.SERVICE_UNAVAILABLE);

    let claims: { sub?: string; email?: string; email_verified?: boolean; name?: string; picture?: string };
    try {
      claims = await verifyGoogleJwt(input.idToken, audience);
    } catch {
      throw new AppError('Google sign-in failed — please try again', 401, ErrorCode.AUTH_INVALID_CREDENTIALS);
    }
    if (!claims.sub || !claims.email || claims.email_verified !== true) {
      throw new AppError('Your Google account email is not verified', 401, ErrorCode.AUTH_INVALID_CREDENTIALS);
    }
    const sub = claims.sub;
    const email = claims.email.trim().toLowerCase();

    const identity = await prisma.authIdentity.findUnique({ where: { provider_providerSubject: { provider: 'google', providerSubject: sub } }, select: { userId: true } });
    let user = identity
      ? await prisma.user.findUnique({ where: { id: identity.userId }, include: { profile: true } })
      : await prisma.user.findFirst({ where: { normalizedEmail: email }, include: { profile: true } });

    let action = 'USER_LOGIN_SUCCESS';
    if (user && !identity) {
      // Same email, first time with Google: link it (Google confirms they own this address).
      await prisma.$transaction([
        prisma.authIdentity.create({ data: { userId: user.id, provider: 'google', providerSubject: sub, providerEmail: email } }),
        ...(user.emailVerifiedAt ? [] : [prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } })]),
      ]);
      user = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, include: { profile: true } });
      action = 'USER_LOGIN_GOOGLE_LINKED';
    }

    if (!user) {
      if (input.ageConfirmed !== true) {
        throw new AppError('Please confirm you are 18 or older to create your account', 400, ErrorCode.AGE_CONFIRMATION_REQUIRED);
      }
      const displayName = (claims.name ?? email.split('@')[0] ?? 'Friend').slice(0, 50);
      user = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: { email, normalizedEmail: email, emailVerifiedAt: new Date(), status: UserStatus.ACTIVE },
        });
        await tx.userProfile.create({
          data: { userId: created.id, displayName, avatarUrl: claims.picture ?? null, locale: 'en-US', timezone: 'UTC', preferredLanguage: 'en' },
        });
        await tx.authIdentity.create({ data: { userId: created.id, provider: 'google', providerSubject: sub, providerEmail: email } });
        return tx.user.findUniqueOrThrow({ where: { id: created.id }, include: { profile: true } });
      });
      Realtime.admin({ kind: 'signup' });
      action = 'USER_REGISTERED_GOOGLE';
    }

    return AuthService.startSession(user, input.device, ipAddress, userAgent, action, { via: 'google', ...(action === 'USER_REGISTERED_GOOGLE' ? { ageConfirmed18Plus: true } : {}) });
  }

  /**
   * After the identity is confirmed (password or Google): account status checks, a new session and token family,
   * the tokens. Shared by every way of signing in, so they all behave the same.
   */
  private static async startSession(
    user: Prisma.UserGetPayload<{ include: { profile: true } }>,
    device: LoginRequestInput['device'],
    ipAddress: string | undefined,
    userAgent: string | undefined,
    action: string,
    metadata: Record<string, unknown> = {},
  ) {
    const input = { device };
    // Check account status
    if (user.deletedAt || user.status === UserStatus.DELETED) {
      throw new AppError(
        'This account has been permanently closed',
        403,
        ErrorCode.AUTH_ACCOUNT_DELETED,
      );
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new AppError(
        'This account has been suspended for violating platform policies',
        403,
        ErrorCode.AUTH_ACCOUNT_SUSPENDED,
      );
    }

    // Signing in during the 14-day grace period cancels their own "Delete account" (not one the team made).
    const { cancelled: deletionCancelled } = await AccountDeletionService.cancel(user.id, { onlyUserRequested: true }).catch(() => ({ cancelled: false }));

    // Issue new session and token family
    const tokenFamilyId = crypto.randomUUID();
    const rawRefreshToken = generateRandomToken(48);
    const refreshTokenHash = hashToken(rawRefreshToken);
    const refreshExpiresAt = new Date(
      Date.now() + SYSTEM_CONSTANTS.AUTH.REFRESH_TOKEN_LIFETIME_SECONDS * 1000,
    );

    const session = await prisma.$transaction(async tx => {
      let deviceId: string | undefined;
      if (input.device) {
        const device = await tx.device.create({
          data: {
            userId: user.id,
            platform: input.device.platform || 'unknown',
            appVersion: input.device.appVersion,
            osVersion: input.device.osVersion,
            deviceName: input.device.deviceName,
            pushToken: input.device.pushToken,
          },
        });
        deviceId = device.id;
      }

      const createdSession = await tx.session.create({
        data: {
          userId: user.id,
          deviceId,
          tokenFamilyId,
          refreshTokenHash,
          expiresAt: refreshExpiresAt,
          ipAddress,
          userAgent,
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
          lastActiveAt: new Date(),
        },
      });

      return createdSession;
    });

    const accessToken = signAccessToken({
      userId: user.id,
      email: user.email,
      roles: ['USER'],
      sessionId: session.id,
      deviceId: session.deviceId || undefined,
      emailVerified: Boolean(user.emailVerifiedAt),
    });

    await AuditService.logEvent({
      actorType: 'USER',
      actorId: user.id,
      action,
      resourceType: 'User',
      resourceId: user.id,
      metadata: { sessionId: session.id, ...metadata },
      ipAddress,
      userAgent,
    });

    return {
      // The app tells them "Your account won't be deleted".
      deletionCancelled,
      user: {
        id: user.id,
        email: user.email,
        status: user.status,
        emailVerified: Boolean(user.emailVerifiedAt),
        profile: user.profile
          ? {
              id: user.profile.id,
              displayName: user.profile.displayName,
              username: user.profile.username,
              avatarUrl: user.profile.avatarUrl,
              locale: user.profile.locale,
              timezone: user.profile.timezone,
              onboardingCompleted: user.profile.onboardingCompleted,
            }
          : null,
      },
      tokens: {
        accessToken,
        refreshToken: rawRefreshToken,
        expiresIn: SYSTEM_CONSTANTS.AUTH.ACCESS_TOKEN_LIFETIME_SECONDS,
        tokenType: 'Bearer',
      },
    };
  }

  /**
   * Refreshes access and refresh tokens with Token Family Rotation and Reuse Detection.
   */
  static async refresh(
    rawRefreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (!rawRefreshToken) {
      throw new AppError('Refresh token is required', 400, ErrorCode.VALIDATION_ERROR);
    }

    const tokenHash = hashToken(rawRefreshToken);

    // Find the session by the hashed refresh token
    const session = await prisma.session.findFirst({
      where: { refreshTokenHash: tokenHash },
      include: { user: true },
    });

    // 1. REUSE DETECTION: If session not found or already revoked, check if token hash belonged to a compromised family
    if (!session || session.revokedAt) {
      if (session?.tokenFamilyId) {
        // Invalidate the entire token family immediately
        await prisma.session.updateMany({
          where: {
            tokenFamilyId: session.tokenFamilyId,
            revokedAt: null,
          },
          data: {
            revokedAt: new Date(),
            revokeReason: 'TOKEN_REUSE_DETECTED',
          },
        });

        await AuditService.logEvent({
          actorType: 'USER',
          actorId: session.userId,
          action: 'AUTH_TOKEN_REUSED_FAMILY_INVALIDATED',
          resourceType: 'Session',
          resourceId: session.id,
          metadata: { tokenFamilyId: session.tokenFamilyId },
          ipAddress,
          userAgent,
        });
      }

      throw new AppError(
        'Invalid or compromised refresh token. Session has been terminated.',
        401,
        ErrorCode.AUTH_TOKEN_REUSED,
      );
    }

    // 2. Check expiration
    if (session.expiresAt < new Date()) {
      await prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date(), revokeReason: 'SESSION_EXPIRED' },
      });
      throw new AppError('Refresh token has expired', 401, ErrorCode.AUTH_TOKEN_EXPIRED);
    }

    // 3. Check user state
    if (session.user.deletedAt || session.user.status === UserStatus.DELETED) {
      throw new AppError('Account deleted', 403, ErrorCode.AUTH_ACCOUNT_DELETED);
    }
    if (session.user.status === UserStatus.SUSPENDED) {
      throw new AppError('Account suspended', 403, ErrorCode.AUTH_ACCOUNT_SUSPENDED);
    }

    // 4. Token Rotation: generate new refresh token, mark old session as ROTATED, and create new session
    const newRawRefreshToken = generateRandomToken(48);
    const newRefreshTokenHash = hashToken(newRawRefreshToken);
    const newExpiresAt = new Date(
      Date.now() + SYSTEM_CONSTANTS.AUTH.REFRESH_TOKEN_LIFETIME_SECONDS * 1000,
    );

    const [_, newSession] = await prisma.$transaction([
      prisma.session.update({
        where: { id: session.id },
        data: {
          revokedAt: new Date(),
          revokeReason: 'ROTATED',
          lastUsedAt: new Date(),
        },
      }),
      prisma.session.create({
        data: {
          userId: session.userId,
          deviceId: session.deviceId,
          tokenFamilyId: session.tokenFamilyId,
          refreshTokenHash: newRefreshTokenHash,
          expiresAt: newExpiresAt,
          ipAddress: ipAddress || session.ipAddress,
          userAgent: userAgent || session.userAgent,
        },
      }),
    ]);

    const newAccessToken = signAccessToken({
      userId: session.user.id,
      email: session.user.email,
      roles: ['USER'],
      sessionId: newSession.id,
      deviceId: newSession.deviceId || undefined,
      emailVerified: Boolean(session.user.emailVerifiedAt),
    });

    await AuditService.logEvent({
      actorType: 'USER',
      actorId: session.userId,
      action: 'SESSION_REFRESHED',
      resourceType: 'Session',
      resourceId: newSession.id,
      ipAddress,
      userAgent,
    });

    return {
      tokens: {
        accessToken: newAccessToken,
        refreshToken: newRawRefreshToken,
        expiresIn: SYSTEM_CONSTANTS.AUTH.ACCESS_TOKEN_LIFETIME_SECONDS,
        tokenType: 'Bearer',
      },
    };
  }

  /**
   * Logs out user from current session or all devices.
   */
  static async logout(
    userId: string,
    sessionId?: string,
    allDevices = false,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (allDevices) {
      await prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: {
          revokedAt: new Date(),
          revokeReason: 'USER_LOGOUT_ALL',
        },
      });

      await AuditService.logEvent({
        actorType: 'USER',
        actorId: userId,
        action: 'LOGOUT_ALL',
        resourceType: 'User',
        resourceId: userId,
        ipAddress,
        userAgent,
      });
    } else if (sessionId) {
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          revokedAt: new Date(),
          revokeReason: 'USER_LOGOUT',
        },
      });

      await AuditService.logEvent({
        actorType: 'USER',
        actorId: userId,
        action: 'SESSION_REVOKED',
        resourceType: 'Session',
        resourceId: sessionId,
        ipAddress,
        userAgent,
      });
    }

    return { message: 'Successfully logged out' };
  }

  /**
   * Enumeration-safe password reset initiation.
   */
  static async forgotPassword(
    email: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await prisma.user.findFirst({
      where: { normalizedEmail, deletedAt: null, status: UserStatus.ACTIVE },
    });

    let rawToken: string | undefined;

    if (user) {
      rawToken = generateRandomToken(32);
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(
        Date.now() + SYSTEM_CONSTANTS.AUTH.PASSWORD_RESET_TOKEN_LIFETIME_SECONDS * 1000,
      );

      // Invalidate previous active reset tokens for this user
      await prisma.passwordResetToken.deleteMany({
        where: { userId: user.id, usedAt: null },
      });

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });

      // The link opens a small page on this server (account/accountPages.routes.ts), so it works on any phone.
      const link = `${publicOrigin()}/account/reset-password?token=${rawToken}`;
      const minutes = Math.round(SYSTEM_CONSTANTS.AUTH.PASSWORD_RESET_TOKEN_LIFETIME_SECONDS / 60);
      await sendEmail({
        to: user.email,
        subject: 'Reset your Loveek password',
        text: `Someone (hopefully you) asked to reset the password of your Loveek account.\n\nSet a new password here (the link works once, for ${minutes} minutes):\n${link}\n\nDidn't ask? Ignore this email — your password stays the same.`,
        html: `<p>Someone (hopefully you) asked to reset the password of your Loveek account.</p><p><a href="${link}" style="display:inline-block;padding:10px 18px;border-radius:10px;background:#ec4899;color:#fff;font-weight:700;text-decoration:none">Set a new password</a></p><p style="color:#6b6577;font-size:14px">The link works once, for ${minutes} minutes. Didn't ask? Ignore this email — your password stays the same.</p>`,
      });

      await AuditService.logEvent({
        actorType: 'USER',
        actorId: user.id,
        action: 'PASSWORD_RESET_REQUESTED',
        resourceType: 'User',
        resourceId: user.id,
        ipAddress,
        userAgent,
      });
    }

    return {
      message: 'If an account exists with this email address, password reset instructions have been sent.',
      // In dev / test environment, return reset token for testing
      resetToken: process.env['NODE_ENV'] !== 'production' ? rawToken : undefined,
    };
  }

  /**
   * Resets password using a verified token and revokes all active sessions.
   */
  static async resetPassword(
    input: ResetPasswordRequestInput,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const tokenHash = hashToken(input.token);

    const resetRecord = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !resetRecord ||
      resetRecord.usedAt !== null ||
      resetRecord.expiresAt < new Date() ||
      resetRecord.user.deletedAt ||
      resetRecord.user.status === UserStatus.DELETED
    ) {
      throw new AppError(
        'Invalid, expired, or previously used password reset token',
        400,
        ErrorCode.AUTH_INVALID_TOKEN,
      );
    }

    const passwordValidation = validatePasswordStrength(input.newPassword);
    if (!passwordValidation.isValid) {
      throw new AppError(
        passwordValidation.message || 'Password does not meet complexity requirements',
        400,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    const newPasswordHash = await hashPassword(input.newPassword);

    await prisma.$transaction(async tx => {
      // 1. Update user password
      await tx.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash: newPasswordHash },
      });

      // 2. Mark token as used
      await tx.passwordResetToken.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() },
      });

      // 3. Security: Revoke all existing sessions for this user
      await tx.session.updateMany({
        where: { userId: resetRecord.userId, revokedAt: null },
        data: {
          revokedAt: new Date(),
          revokeReason: 'PASSWORD_RESET_COMPLETED',
        },
      });
    });

    await AuditService.logEvent({
      actorType: 'USER',
      actorId: resetRecord.userId,
      action: 'PASSWORD_RESET_COMPLETED',
      resourceType: 'User',
      resourceId: resetRecord.userId,
      ipAddress,
      userAgent,
    });

    return { message: 'Password has been successfully reset. Please log in with your new credentials.' };
  }

  /** The "verify your email" link; it opens a small page on this server (account/accountPages.routes.ts). */
  static async sendVerificationEmail(email: string, rawToken: string): Promise<boolean> {
    const link = `${publicOrigin()}/account/verify-email?token=${rawToken}`;
    return sendEmail({
      to: email,
      subject: 'Verify your Loveek email',
      text: `Welcome to Loveek! Tap to verify your email (the link works once):\n${link}\n\nDidn't sign up? Ignore this email.`,
      html: `<p>Welcome to Loveek!</p><p><a href="${link}" style="display:inline-block;padding:10px 18px;border-radius:10px;background:#ec4899;color:#fff;font-weight:700;text-decoration:none">Verify my email</a></p><p style="color:#6b6577;font-size:14px">The link works once. Didn't sign up? Ignore this email.</p>`,
    });
  }

  /** A fresh verification link (older ones stop working). False if already verified or email isn't set up. */
  static async resendVerification(userId: string): Promise<{ sent: boolean; alreadyVerified: boolean }> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, emailVerifiedAt: true, deletedAt: true } });
    if (!user || user.deletedAt) throw new AppError('Account not found', 404, ErrorCode.NOT_FOUND);
    if (user.emailVerifiedAt) return { sent: false, alreadyVerified: true };
    const rawToken = generateRandomToken(32);
    await prisma.$transaction([
      prisma.emailVerificationToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } }),
      prisma.emailVerificationToken.create({
        data: { userId, tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + SYSTEM_CONSTANTS.AUTH.EMAIL_VERIFICATION_TOKEN_LIFETIME_SECONDS * 1000) },
      }),
    ]);
    return { sent: await AuthService.sendVerificationEmail(user.email, rawToken), alreadyVerified: false };
  }

  /**
   * Verifies user email address.
   */
  static async verifyEmail(
    rawToken: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const tokenHash = hashToken(rawToken);

    const tokenRecord = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !tokenRecord ||
      tokenRecord.usedAt !== null ||
      tokenRecord.expiresAt < new Date() ||
      tokenRecord.user.deletedAt
    ) {
      throw new AppError(
        'Invalid, expired, or already used email verification token',
        400,
        ErrorCode.AUTH_INVALID_TOKEN,
      );
    }

    await prisma.$transaction(async tx => {
      await tx.user.update({
        where: { id: tokenRecord.userId },
        data: { emailVerifiedAt: new Date() },
      });

      await tx.emailVerificationToken.update({
        where: { id: tokenRecord.id },
        data: { usedAt: new Date() },
      });
    });

    await AuditService.logEvent({
      actorType: 'USER',
      actorId: tokenRecord.userId,
      action: 'EMAIL_VERIFIED',
      resourceType: 'User',
      resourceId: tokenRecord.userId,
      ipAddress,
      userAgent,
    });

    return { message: 'Email address has been successfully verified.' };
  }
}
