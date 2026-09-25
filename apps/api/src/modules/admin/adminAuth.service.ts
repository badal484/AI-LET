import { prisma } from '../../infrastructure/database/prisma.js';
import { verifyPassword } from '../../security/password.js';
import { generateRandomToken, hashToken, signAdminToken } from '../../security/tokens.js';
import { AuditService } from '../audit/audit.service.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCode, ADMIN_PERMISSIONS, ADMIN_ROLES } from '@ai-companion/config';
import { AdminLoginRequestInput } from '@ai-companion/validation';

export class AdminAuthService {
  /**
   * Authenticates a privileged administrator.
   */
  static async login(
    input: AdminLoginRequestInput,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const normalizedEmail = input.email.trim().toLowerCase();

    const admin = await prisma.adminUser.findFirst({
      where: { normalizedEmail, deletedAt: null },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!admin || !admin.isActive) {
      await AuditService.logEvent({
        actorType: 'ADMIN',
        action: 'ADMIN_LOGIN_FAILED',
        resourceType: 'AdminUser',
        metadata: { email: normalizedEmail, reason: 'admin_not_found_or_inactive' },
        ipAddress,
        userAgent,
      });
      throw new AppError('Invalid admin credentials', 401, ErrorCode.ADMIN_UNAUTHORIZED);
    }

    const isPasswordValid = await verifyPassword(input.password, admin.passwordHash);
    if (!isPasswordValid) {
      await AuditService.logEvent({
        actorType: 'ADMIN',
        actorId: admin.id,
        action: 'ADMIN_LOGIN_FAILED',
        resourceType: 'AdminUser',
        resourceId: admin.id,
        metadata: { email: normalizedEmail, reason: 'invalid_password' },
        ipAddress,
        userAgent,
      });
      throw new AppError('Invalid admin credentials', 401, ErrorCode.ADMIN_UNAUTHORIZED);
    }

    // MFA Verification check if enabled
    if (admin.isMfaEnabled && admin.mfaSecret) {
      if (!input.mfaCode) {
        throw new AppError('MFA verification code required', 403, ErrorCode.AUTH_MFA_REQUIRED);
      }
      // Note: TOTP validation hook is prepared here
    }

    // Create Admin Session
    const rawSessionToken = generateRandomToken(48);
    const sessionTokenHash = hashToken(rawSessionToken);
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours

    const session = await prisma.adminSession.create({
      data: {
        adminId: admin.id,
        sessionTokenHash,
        expiresAt,
        ipAddress,
        userAgent,
      },
    });

    // Extract roles & permissions
    const roles: string[] = [];
    const permissionsSet = new Set<string>();

    for (const assignment of admin.roles) {
      roles.push(assignment.role.name);
      for (const rolePerm of assignment.role.permissions) {
        permissionsSet.add(rolePerm.permission.name);
      }
    }

    if (roles.includes(ADMIN_ROLES.SUPER_ADMIN)) {
      Object.values(ADMIN_PERMISSIONS).forEach(p => permissionsSet.add(p));
    }

    const permissions = Array.from(permissionsSet);

    // Update last login
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    const token = signAdminToken({
      adminId: admin.id,
      email: admin.email,
      roles,
      permissions,
      sessionId: session.id,
    });

    await AuditService.logEvent({
      actorType: 'ADMIN',
      actorId: admin.id,
      action: 'ADMIN_LOGIN_SUCCESS',
      resourceType: 'AdminUser',
      resourceId: admin.id,
      ipAddress,
      userAgent,
    });

    return {
      admin: {
        id: admin.id,
        email: admin.email,
        displayName: admin.displayName,
        roles,
        permissions,
      },
      token,
      sessionToken: rawSessionToken,
      expiresIn: 8 * 3600,
    };
  }

  /**
   * Logs out admin and revokes session.
   */
  static async logout(
    adminId: string,
    sessionId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (sessionId) {
      await prisma.adminSession.update({
        where: { id: sessionId },
        data: { revokedAt: new Date() },
      });
    }

    await AuditService.logEvent({
      actorType: 'ADMIN',
      actorId: adminId,
      action: 'ADMIN_LOGOUT',
      resourceType: 'AdminUser',
      resourceId: adminId,
      ipAddress,
      userAgent,
    });

    return { message: 'Admin logged out successfully' };
  }
}
