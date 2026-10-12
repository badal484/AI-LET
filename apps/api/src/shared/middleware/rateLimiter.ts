import rateLimit from 'express-rate-limit';
import { verifyAccessToken } from '../../security/tokens.js';
import { env } from '../../config/env.js';
import { RateLimitError } from '../errors/AppError.js';
import { rateLimitStore } from './rateLimitStore.js';

export const standardRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  store: rateLimitStore('api'),
  // Signed-in users are counted per account (many Indian mobile users share one carrier IP); others per IP.
  keyGenerator: (req) => {
    const bearer = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
    if (bearer) {
      try {
        return `u:${verifyAccessToken(bearer).userId}`;
      } catch {
        /* expired / invalid: fall back to the IP */
      }
    }
    return `ip:${req.ip ?? 'unknown'}`;
  },
  // If Redis is unavailable, let requests through rather than failing every call.
  passOnStoreError: true,
  handler: (_req, _res, next) => {
    next(new RateLimitError());
  },
});

/**
 * Sending chat messages (each one costs an AI reply): at most CHAT_RATE_LIMIT_PER_MINUTE per account
 * (default 20) — far above any human, and stops a script from running up the AI bill.
 */
export const chatSendRateLimiter = rateLimit({
  windowMs: 60_000,
  max: Number(process.env['CHAT_RATE_LIMIT_PER_MINUTE'] ?? 20),
  standardHeaders: true,
  legacyHeaders: false,
  store: rateLimitStore('chat'),
  passOnStoreError: true,
  skip: () => process.env['NODE_ENV'] === 'test',
  keyGenerator: (req) => `u:${(req as { user?: { userId?: string } }).user?.userId ?? req.ip ?? 'unknown'}`,
  handler: (_req, _res, next) => {
    next(new RateLimitError('You are sending messages too fast. Please wait a few seconds.'));
  },
});
