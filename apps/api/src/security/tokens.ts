import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { UserPrincipal, AdminPrincipal } from '@ai-companion/types';
import { env } from '../config/env.js';
import { AppError } from '../shared/errors/AppError.js';
import { ErrorCode } from '@ai-companion/config';

/**
 * Generates a cryptographically secure random hexadecimal token.
 */
export function generateRandomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Hashes a token using SHA-256 for secure database storage.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Signs a short-lived JWT access token for mobile/client users.
 */
export function signAccessToken(payload: UserPrincipal): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: '15m',
    algorithm: 'HS256',
  });
}

/**
 * Verifies and decodes a user access token.
 */
export function verifyAccessToken(token: string): UserPrincipal {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
    });
    return decoded as UserPrincipal;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError('Access token has expired', 401, ErrorCode.AUTH_TOKEN_EXPIRED);
    }
    throw new AppError('Invalid access token', 401, ErrorCode.AUTH_UNAUTHORIZED);
  }
}

/**
 * Signs a JWT session token for privileged admin users.
 */
export function signAdminToken(payload: AdminPrincipal): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: '8h',
    algorithm: 'HS256',
  });
}

/**
 * Verifies and decodes a privileged admin access token.
 */
export function verifyAdminToken(token: string): AdminPrincipal {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
    });
    return decoded as AdminPrincipal;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError('Admin session token has expired', 401, ErrorCode.ADMIN_UNAUTHORIZED);
    }
    throw new AppError('Invalid admin session token', 401, ErrorCode.ADMIN_UNAUTHORIZED);
  }
}
