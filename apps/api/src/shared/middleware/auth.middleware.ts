import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../../security/tokens.js';
import { prisma } from '../../infrastructure/database/prisma.js';
import { AppError } from '../errors/AppError.js';
import { ErrorCode } from '@ai-companion/config';
import { UserStatus } from '@prisma/client';

/**
 * Middleware to authenticate requests using a Bearer access token.
 */
export async function authenticateUser(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(
      new AppError('Missing or malformed Authorization header', 401, ErrorCode.AUTH_UNAUTHORIZED),
    );
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return next(new AppError('Authentication token is required', 401, ErrorCode.AUTH_UNAUTHORIZED));
  }

  try {
    const payload = verifyAccessToken(token);

    // Fast-path / verification against active user state
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        status: true,
        emailVerifiedAt: true,
        deletedAt: true,
      },
    });

    if (!user) {
      return next(new AppError('User account not found', 401, ErrorCode.AUTH_UNAUTHORIZED));
    }

    if (user.deletedAt || user.status === UserStatus.DELETED) {
      return next(
        new AppError('This account has been deleted', 403, ErrorCode.AUTH_ACCOUNT_DELETED),
      );
    }

    if (user.status === UserStatus.SUSPENDED) {
      return next(
        new AppError(
          'This account has been suspended for policy violations',
          403,
          ErrorCode.AUTH_ACCOUNT_SUSPENDED,
        ),
      );
    }

    // Verify session validity if sessionId was provided in token
    if (payload.sessionId) {
      const session = await prisma.session.findUnique({
        where: { id: payload.sessionId },
        select: { id: true, revokedAt: true, expiresAt: true },
      });

      if (!session || session.revokedAt) {
        return next(
          new AppError('Session has been revoked or expired', 401, ErrorCode.AUTH_SESSION_REVOKED),
        );
      }

      if (session.expiresAt < new Date()) {
        return next(new AppError('Session has expired', 401, ErrorCode.AUTH_SESSION_EXPIRED));
      }
    }

    req.user = {
      userId: user.id,
      email: payload.email,
      roles: payload.roles || ['USER'],
      sessionId: payload.sessionId,
      deviceId: payload.deviceId,
      emailVerified: Boolean(user.emailVerifiedAt),
    };

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Optional authentication: populates req.user if a valid token is provided,
 * but does not reject unauthenticated requests.
 */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.substring(7).trim();
  if (!token) return next();

  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, status: true, emailVerifiedAt: true, deletedAt: true },
    });

    if (user && !user.deletedAt && user.status === UserStatus.ACTIVE) {
      req.user = {
        userId: user.id,
        email: payload.email,
        roles: payload.roles || ['USER'],
        sessionId: payload.sessionId,
        deviceId: payload.deviceId,
        emailVerified: Boolean(user.emailVerifiedAt),
      };
    }
  } catch {
    // Ignore invalid tokens for optional auth
  }

  next();
}

/**
 * Middleware to require that the user's email has been verified.
 */
export function requireVerifiedEmail(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    return next(new AppError('Authentication required', 401, ErrorCode.AUTH_UNAUTHORIZED));
  }

  if (!req.user.emailVerified) {
    return next(
      new AppError(
        'Email verification required to perform this action',
        403,
        ErrorCode.AUTH_EMAIL_NOT_VERIFIED,
      ),
    );
  }

  next();
}
