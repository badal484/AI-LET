import { prisma } from '../../infrastructure/database/prisma.js';
import { AuditService } from '../audit/audit.service.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCode, ADMIN_ROLES } from '@ai-companion/config';
import { UserStatus, Prisma } from '@prisma/client';
import { AdminPrincipal } from '@ai-companion/types';

export class AdminUsersService {
  /**
   * Lists users with search, filtering, and pagination for admin console.
   */
  static async listUsers(params: {
    page?: number;
    limit?: number;
    status?: UserStatus;
    search?: string;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};
    if (params.status) where.status = params.status;
    if (params.search) {
      where.OR = [
        { email: { contains: params.search, mode: 'insensitive' } },
        { profile: { displayName: { contains: params.search, mode: 'insensitive' } } },
        { profile: { username: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        include: {
          profile: true,
          _count: {
            select: {
              sessions: { where: { revokedAt: null } },
              devices: { where: { revokedAt: null } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      items: users.map(u => ({
        id: u.id,
        email: u.email,
        status: u.status,
        emailVerified: Boolean(u.emailVerifiedAt),
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
        profile: u.profile,
        activeSessionsCount: u._count.sessions,
        activeDevicesCount: u._count.devices,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + users.length < total,
    };
  }

  /**
   * Retrieves complete user details for admin inspection.
   */
  static async getUserDetails(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        authIdentities: true,
        devices: { orderBy: { lastSeenAt: 'desc' } },
        sessions: {
          where: { revokedAt: null },
          orderBy: { lastUsedAt: 'desc' },
        },
      },
    });

    if (!user) {
      throw new AppError('User not found', 404, ErrorCode.NOT_FOUND);
    }

    return user;
  }

  /**
   * Updates user lifecycle status (e.g. SUSPEND or ACTIVATE) and revokes active sessions.
   */
  static async updateUserStatus(
    userId: string,
    status: UserStatus,
    reason: string | undefined,
    actingAdminId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', 404, ErrorCode.NOT_FOUND);
    }

    const prevStatus = user.status;

    await prisma.$transaction(async tx => {
      await tx.user.update({
        where: { id: userId },
        data: { status },
      });

      // If suspending or deleting, immediately terminate all active sessions
      if (status === UserStatus.SUSPENDED || status === UserStatus.DELETED) {
        await tx.session.updateMany({
          where: { userId, revokedAt: null },
          data: {
            revokedAt: new Date(),
            revokeReason: `ADMIN_${status}_ACTION`,
          },
        });
      }
    });

    await AuditService.logEvent({
      actorType: 'ADMIN',
      actorId: actingAdminId,
      action: status === UserStatus.SUSPENDED ? 'ADMIN_USER_SUSPENDED' : 'ADMIN_USER_UPDATED',
      resourceType: 'User',
      resourceId: userId,
      metadata: { previousStatus: prevStatus, newStatus: status, reason },
      ipAddress,
      userAgent,
    });

    return { message: `User status successfully updated to ${status}` };
  }

  /**
   * Assigns an admin role to an administrator with privilege escalation protection.
   */
  static async assignAdminRole(
    targetAdminId: string,
    roleName: string,
    actingAdmin: AdminPrincipal,
    ipAddress?: string,
    userAgent?: string,
  ) {
    // Privilege Escalation Protection: Only super_admin can assign super_admin role
    if (roleName === ADMIN_ROLES.SUPER_ADMIN && !actingAdmin.roles.includes(ADMIN_ROLES.SUPER_ADMIN)) {
      throw new AppError(
        'Forbidden: Only super administrators can assign the super_admin role',
        403,
        ErrorCode.ADMIN_FORBIDDEN,
      );
    }

    const role = await prisma.adminRole.findUnique({
      where: { name: roleName },
    });

    if (!role) {
      throw new AppError(`Role '${roleName}' not found`, 404, ErrorCode.NOT_FOUND);
    }

    const targetAdmin = await prisma.adminUser.findUnique({
      where: { id: targetAdminId },
    });

    if (!targetAdmin) {
      throw new AppError('Target administrator not found', 404, ErrorCode.NOT_FOUND);
    }

    await prisma.adminRoleAssignment.upsert({
      where: {
        adminId_roleId: {
          adminId: targetAdminId,
          roleId: role.id,
        },
      },
      create: {
        adminId: targetAdminId,
        roleId: role.id,
      },
      update: {},
    });

    await AuditService.logEvent({
      actorType: 'ADMIN',
      actorId: actingAdmin.adminId,
      action: 'ADMIN_ROLE_ASSIGNED',
      resourceType: 'AdminUser',
      resourceId: targetAdminId,
      metadata: { assignedRole: roleName },
      ipAddress,
      userAgent,
    });

    return { message: `Role '${roleName}' successfully assigned` };
  }
}
