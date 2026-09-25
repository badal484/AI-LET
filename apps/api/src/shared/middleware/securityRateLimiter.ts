import rateLimit from 'express-rate-limit';
import { ApiResponse } from '../utils/apiResponse.js';
import { ErrorCode } from '@ai-companion/config';
import { Request, Response } from 'express';

const createRateLimiter = (options: {
  windowMs: number;
  max: number;
  message: string;
}) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env['NODE_ENV'] === 'test',
    handler: (_req: Request, res: Response) => {
      ApiResponse.error(
        res,
        ErrorCode.RATE_LIMIT_EXCEEDED,
        options.message,
        429,
      );
    },
  });
};

// Strict limit for login and registration attempts (10 requests per 15 minutes per IP)
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
});

// Strict limit for password reset and email verification requests (5 requests per hour)
export const passwordResetRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many password reset requests. Please try again later.',
});

// Refresh token rate limit (60 per 15 mins)
export const tokenRefreshRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: 'Too many token refresh requests. Please slow down.',
});

// Admin login rate limiter (5 attempts per 15 mins)
export const adminLoginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many privileged login attempts. Access temporarily restricted.',
});
