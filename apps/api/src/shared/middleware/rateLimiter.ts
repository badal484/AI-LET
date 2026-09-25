import rateLimit from 'express-rate-limit';
import { env } from '../../config/env.js';
import { RateLimitError } from '../errors/AppError.js';

export const standardRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new RateLimitError());
  },
});
