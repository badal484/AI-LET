import { prisma } from '../../infrastructure/database/prisma.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCode } from '@ai-companion/config';
import { UpdateProfileInput, RegisterDeviceInput } from '@ai-companion/validation';
import { AuditService } from '../audit/audit.service.js';
import { UserStatus } from '@prisma/client';

export class UsersService {
  /**
   * Retrieves full profile for a user.
   */
  static async getProfile(userId: string) {
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            status: true,
            emailVerifiedAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!profile) {
      throw new AppError('User profile not found', 404, ErrorCode.NOT_FOUND);
    }

    return profile;
  }

  /**
   * Updates user profile fields safely.
   */
  static async updateProfile(userId: string, input: UpdateProfileInput) {
    // Check username uniqueness if provided
    if (input.username) {
      const existing = await prisma.userProfile.findFirst({
        where: {
          username: input.username,
          userId: { not: userId },
        },
      });

      if (existing) {
        throw new AppError('Username is already taken', 409, ErrorCode.CONFLICT);
      }
    }

    const updated = await prisma.userProfile.update({
      where: { userId },
      data: {
        ...(input.displayName !== undefined && { displayName: input.displayName }),
        ...(input.username !== undefined && { username: input.username }),
        ...(input.avatarUrl !== undefined && { avatarUrl: input.avatarUrl }),
        ...(input.locale !== undefined && { locale: input.locale }),
        ...(input.timezone !== undefined && { timezone: input.timezone }),
        ...(input.preferredLanguage !== undefined && { preferredLanguage: input.preferredLanguage }),
        ...(input.bio !== undefined && { bio: input.bio }),
        ...(input.onboardingCompleted !== undefined && {
          onboardingCompleted: input.onboardingCompleted,
        }),
      },
    });

    await AuditService.logEvent({
      actorType: 'USER',
      actorId: userId,
      action: 'PROFILE_UPDATED',
      resourceType: 'UserProfile',
      resourceId: updated.id,
      metadata: { changedFields: Object.keys(input) },
    });

    return updated;
  }

  /**
   * Retrieves all active registered devices for a user.
   */
  static async getDevices(userId: string) {
    return prisma.device.findMany({
      where: { userId, revokedAt: null },
      orderBy: { lastSeenAt: 'desc' },
    });
  }

  /**
   * Registers or updates a device for push notifications and device tracking.
   */
  static async registerDevice(userId: string, input: RegisterDeviceInput) {
    const device = await prisma.device.create({
      data: {
        userId,
        platform: input.platform,
        appVersion: input.appVersion,
        osVersion: input.osVersion,
        deviceName: input.deviceName,
        pushToken: input.pushToken,
      },
    });

    return device;
  }

  /**
   * Revokes a device and terminates its associated active sessions.
   */
  static async revokeDevice(userId: string, deviceId: string) {
    const device = await prisma.device.findFirst({
      where: { id: deviceId, userId },
    });

    if (!device) {
      throw new AppError('Device not found', 404, ErrorCode.NOT_FOUND);
    }

    await prisma.$transaction(async tx => {
      await tx.device.update({
        where: { id: deviceId },
        data: { revokedAt: new Date() },
      });

      await tx.session.updateMany({
        where: { deviceId, userId, revokedAt: null },
        data: {
          revokedAt: new Date(),
          revokeReason: 'DEVICE_REVOKED',
        },
      });
    });

    await AuditService.logEvent({
      actorType: 'USER',
      actorId: userId,
      action: 'DEVICE_REVOKED',
      resourceType: 'Device',
      resourceId: deviceId,
    });

    return { message: 'Device revoked successfully' };
  }

  /**
   * Performs soft deletion & privacy anonymization of a user account.
   */
  static async deleteAccount(userId: string, reason?: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.deletedAt) {
      throw new AppError('User not found or already deleted', 404, ErrorCode.NOT_FOUND);
    }

    const anonymizedEmail = `deleted_${userId.substring(0, 8)}_${Date.now()}@anonymized.local`;

    await prisma.$transaction(async tx => {
      // 1. Soft-delete user and anonymize identity
      await tx.user.update({
        where: { id: userId },
        data: {
          status: UserStatus.DELETED,
          deletedAt: new Date(),
          email: anonymizedEmail,
          normalizedEmail: anonymizedEmail,
          passwordHash: null,
          phoneNumber: null,
          normalizedPhoneNumber: null,
        },
      });

      // 2. Anonymize user profile
      await tx.userProfile.update({
        where: { userId },
        data: {
          displayName: 'Deleted User',
          username: null,
          avatarUrl: null,
          bio: null,
        },
      });

      // 3. Revoke all active sessions and devices
      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: {
          revokedAt: new Date(),
          revokeReason: 'ACCOUNT_DELETED',
        },
      });

      await tx.device.updateMany({
        where: { userId, revokedAt: null },
        data: {
          revokedAt: new Date(),
          pushToken: null,
        },
      });

      // 4. Remove auth identities
      await tx.authIdentity.deleteMany({
        where: { userId },
      });
    });

    await AuditService.logEvent({
      actorType: 'USER',
      actorId: userId,
      action: 'ACCOUNT_DELETED',
      resourceType: 'User',
      resourceId: userId,
      metadata: { reason },
    });

    return { message: 'Account successfully scheduled for deletion and personal data anonymized' };
  }
}
