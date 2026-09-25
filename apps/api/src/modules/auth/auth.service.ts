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
  ResetPasswordRequestInput,
} from '@ai-companion/validation';
import { UserStatus } from '@prisma/client';
import crypto from 'crypto';

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

    // 5. Generate short-lived access token
    const accessToken = signAccessToken({
      userId: result.user.id,
      email: result.user.email,
      roles: ['USER'],
      sessionId: result.session.id,
      deviceId: result.session.deviceId || undefined,
      emailVerified: false,
    });

    // 6. Security Audit Event
    await AuditService.logEvent({
      actorType: 'USER',
      actorId: result.user.id,
      action: 'USER_REGISTERED',
      resourceType: 'User',
      resourceId: result.user.id,
      metadata: { email: normalizedEmail },
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
      throw new AppError(
        'Invalid email or password',
        401,
        ErrorCode.AUTH_INVALID_CREDENTIALS,
      );
    }

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
      action: 'USER_LOGIN_SUCCESS',
      resourceType: 'User',
      resourceId: user.id,
      metadata: { sessionId: session.id },
      ipAddress,
      userAgent,
    });

    return {
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
