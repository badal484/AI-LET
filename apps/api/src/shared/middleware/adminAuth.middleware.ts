import { Request, Response, NextFunction } from 'express';
import { verifyAdminToken, hashToken } from '../../security/tokens.js';
import { prisma } from '../../infrastructure/database/prisma.js';
import { AppError } from '../errors/AppError.js';
import { ErrorCode, AdminPermissionType, ADMIN_PERMISSIONS, ADMIN_ROLES } from '@ai-companion/config';

/**
 * Authenticates privileged administrators from Bearer tokens or admin session cookies.
 */
export async function authenticateAdmin(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.cookies && req.cookies['admin_session_token']) {
    token = req.cookies['admin_session_token'];
  }

  if (!token) {
    return next(
      new AppError(
        'Admin authentication required',
        401,
        ErrorCode.ADMIN_UNAUTHORIZED,
      ),
    );
  }

  try {
    let adminId: string;
    let sessionId: string | undefined;

    // Check if token is a JWT admin token or raw session token
    if (token.includes('.')) {
      const payload = verifyAdminToken(token);
      if (!payload || !payload.adminId) {
        return next(
          new AppError('Invalid admin session token', 401, ErrorCode.ADMIN_UNAUTHORIZED),
        );
      }
      adminId = payload.adminId;
      sessionId = payload.sessionId;
    } else {
      // Direct session token lookup via hash
      const tokenHash = hashToken(token);
      const session = await prisma.adminSession.findUnique({
        where: { sessionTokenHash: tokenHash },
        include: { admin: true },
      });

      if (!session || session.revokedAt || session.expiresAt < new Date()) {
        return next(
          new AppError('Admin session is expired or revoked', 401, ErrorCode.ADMIN_UNAUTHORIZED),
        );
      }

      adminId = session.adminId;
      sessionId = session.id;
    }

    // Load admin with assigned roles and role permissions
    const admin = await prisma.adminUser.findUnique({
      where: { id: adminId },
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

    if (!admin || admin.deletedAt || !admin.isActive) {
      return next(
        new AppError(
          'Admin account is disabled or does not exist',
          401,
          ErrorCode.ADMIN_UNAUTHORIZED,
        ),
      );
    }

    // Compile active roles and distinct permissions
    const roles: string[] = [];
    const permissionsSet = new Set<string>();

    for (const assignment of admin.roles) {
      roles.push(assignment.role.name);
      for (const rolePerm of assignment.role.permissions) {
        permissionsSet.add(rolePerm.permission.name);
      }
    }

    // Super admin automatically has all permissions
    if (roles.includes(ADMIN_ROLES.SUPER_ADMIN)) {
      Object.values(ADMIN_PERMISSIONS).forEach(p => permissionsSet.add(p));
    }

    req.admin = {
      adminId: admin.id,
      email: admin.email,
      roles,
      permissions: Array.from(permissionsSet),
      sessionId,
    };

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware factory to enforce granular admin permissions.
 */
export function requirePermission(permission: AdminPermissionType) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.admin) {
      return next(
        new AppError('Admin authentication required', 401, ErrorCode.ADMIN_UNAUTHORIZED),
      );
    }

    const hasPermission =
      req.admin.roles.includes(ADMIN_ROLES.SUPER_ADMIN) ||
      req.admin.permissions.includes(permission);

    if (!hasPermission) {
      return next(
        new AppError(
          `Forbidden: Missing required permission '${permission}'`,
          403,
          ErrorCode.ADMIN_FORBIDDEN,
        ),
      );
    }

    next();
  };
}

/**
 * Middleware factory to enforce specific admin roles.
 */
export function requireAdminRole(role: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.admin) {
      return next(
        new AppError('Admin authentication required', 401, ErrorCode.ADMIN_UNAUTHORIZED),
      );
    }

    const hasRole =
      req.admin.roles.includes(ADMIN_ROLES.SUPER_ADMIN) || req.admin.roles.includes(role);

    if (!hasRole) {
      return next(
        new AppError(
          `Forbidden: Requires '${role}' role`,
          403,
          ErrorCode.ADMIN_FORBIDDEN,
        ),
      );
    }

    next();
  };
}
