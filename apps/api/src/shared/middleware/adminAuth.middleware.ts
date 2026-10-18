import { Request, Response, NextFunction } from 'express';
import { verifyAdminToken, hashToken } from '../../security/tokens.js';
import { prisma } from '../../infrastructure/database/prisma.js';
import { AppError } from '../errors/AppError.js';
import { ErrorCode, AdminPermissionType, ADMIN_PERMISSIONS, ADMIN_ROLES } from '@ai-companion/config';
import { adminMfaRequired } from '../../modules/admin/adminMfa.service.js';

/** What an admin who still has to set up two-step sign-in may reach (audit H-2). */
const MFA_SETUP_PATHS = new Set(['/api/v1/admin/me', '/api/v1/admin/logout', '/api/v1/admin/mfa/setup', '/api/v1/admin/mfa/enable']);

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
      // A signed token is only as good as its session: after logout (or a revoke) it must stop working,
      // not live on for its full 8 hours.
      const session = sessionId
        ? await prisma.adminSession.findUnique({ where: { id: sessionId }, select: { adminId: true, revokedAt: true, expiresAt: true } })
        : null;
      if (!session || session.adminId !== adminId || session.revokedAt || session.expiresAt < new Date()) {
        return next(new AppError('Admin session is expired or revoked', 401, ErrorCode.ADMIN_UNAUTHORIZED));
      }
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

    const mfaEnabled = Boolean(admin.isMfaEnabled && admin.mfaSecret);
    const mfaSetupOnly = adminMfaRequired() && !mfaEnabled;
    req.admin = {
      adminId: admin.id,
      email: admin.email,
      roles,
      permissions: Array.from(permissionsSet),
      sessionId,
      mfaEnabled,
      mfaSetupOnly,
    };

    // Two-step sign-in required but not set up: nothing but the setup screen until it is.
    if (mfaSetupOnly && !MFA_SETUP_PATHS.has(req.originalUrl.split('?')[0]!.replace(/\/$/, ''))) {
      return next(new AppError('Set up two-step sign-in first', 403, ErrorCode.AUTH_MFA_REQUIRED));
    }

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
