import argon2 from 'argon2';
import { SYSTEM_CONSTANTS } from '@ai-companion/config';
import { AppError } from '../shared/errors/AppError.js';
import { ErrorCode } from '@ai-companion/config';

/**
 * Hashes a plaintext password using Argon2id with memory/time cost parameters.
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    return await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: SYSTEM_CONSTANTS.SECURITY.ARGON2_MEMORY_COST,
      timeCost: SYSTEM_CONSTANTS.SECURITY.ARGON2_TIME_COST,
      parallelism: SYSTEM_CONSTANTS.SECURITY.ARGON2_PARALLELISM,
    });
  } catch {
    throw new AppError(
      'Failed to compute secure password hash',
      500,
      ErrorCode.INTERNAL_SERVER_ERROR,
      false,
    );
  }
}

/**
 * Verifies a plaintext password against an Argon2 hash.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

/**
 * Validates password strength without storing or logging it.
 */
export function validatePasswordStrength(password: string): { isValid: boolean; message?: string } {
  if (password.length < SYSTEM_CONSTANTS.AUTH.MIN_PASSWORD_LENGTH) {
    return {
      isValid: false,
      message: `Password must be at least ${SYSTEM_CONSTANTS.AUTH.MIN_PASSWORD_LENGTH} characters long`,
    };
  }

  if (password.length > SYSTEM_CONSTANTS.AUTH.MAX_PASSWORD_LENGTH) {
    return {
      isValid: false,
      message: `Password cannot exceed ${SYSTEM_CONSTANTS.AUTH.MAX_PASSWORD_LENGTH} characters`,
    };
  }

  return { isValid: true };
}
