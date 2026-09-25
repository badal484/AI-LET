import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { redis } from '../../infrastructure/redis/redis.js';
import { logger } from '../../config/logger.js';
import { verifyAccessToken, verifyAdminToken } from '../../security/tokens.js';

export interface CachedIdempotentResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
}

const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

/**
 * This middleware is mounted globally, before any route's auth runs, so `req.user` is never set here.
 * The replay scope must still be the caller: derive it from a verified token when there is one, and
 * otherwise from a hash of whatever credential was presented (plus the client IP). A key is never
 * shared across callers — previously every caller shared the `anonymous` scope, so a second user
 * reusing a key received the first user's cached response body.
 */
function principalScope(req: Request): string {
  const auth = req.headers.authorization;
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const adminCookie = (req as Request & { cookies?: Record<string, string> }).cookies?.['admin_session_token'];
  if (bearer) {
    try {
      return `u:${verifyAccessToken(bearer).userId}`;
    } catch {
      try {
        return `a:${verifyAdminToken(bearer).adminId}`;
      } catch {
        return `t:${sha256(bearer)}`;
      }
    }
  }
  if (adminCookie) {
    try {
      return `a:${verifyAdminToken(adminCookie).adminId}`;
    } catch {
      return `t:${sha256(adminCookie)}`;
    }
  }
  return `ip:${sha256(req.ip ?? 'unknown')}`;
}

/** Binds a key to the exact operation, so reusing a key for a different request cannot replay. */
function requestFingerprint(req: Request): string {
  return sha256(`${req.method} ${req.originalUrl.split('?')[0]}\n${JSON.stringify(req.body ?? null)}`);
}

export const idempotencyMiddleware = (ttlSeconds = 86400) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Only apply to mutating requests
    if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
      return next();
    }

    const idempotencyKey =
      (req.headers['idempotency-key'] as string) ||
      (req.headers['x-idempotency-key'] as string);

    if (!idempotencyKey) {
      return next();
    }

    // Mounted globally and again on some routers (e.g. social): apply once per request, or the
    // second pass would find the first pass's in-flight lock and reject its own request.
    if (res.locals['idempotencyApplied']) {
      return next();
    }
    res.locals['idempotencyApplied'] = true;

    if (idempotencyKey.length > 255) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Idempotency-Key must be at most 255 characters.' },
      });
      return;
    }

    const redisKey = `idempotency:${principalScope(req)}:${sha256(idempotencyKey)}`;
    const fingerprint = requestFingerprint(req);

    try {
      // 1. Check if request was already completed
      const cached = await redis.get(redisKey);
      if (cached) {
        if (cached === 'IN_FLIGHT') {
          res.status(409).json({
            success: false,
            error: {
              code: 'IDEMPOTENT_OPERATION_IN_FLIGHT',
              message: 'A request with this Idempotency-Key is currently being processed.',
            },
          });
          return;
        }

        try {
          const parsed: CachedIdempotentResponse & { fingerprint?: string } = JSON.parse(cached);
          if (parsed.fingerprint && parsed.fingerprint !== fingerprint) {
            res.status(422).json({
              success: false,
              error: {
                code: 'IDEMPOTENCY_KEY_REUSED',
                message: 'This Idempotency-Key was already used for a different request.',
              },
            });
            return;
          }
          res.setHeader('X-Idempotent-Replay', 'true');
          res.status(parsed.statusCode).json(parsed.body);
          return;
        } catch {
          // JSON parse failed, continue
        }
      }

      // 2. Set in-flight lock (TTL 60s). NX closes the race where two concurrent first attempts
      // both miss the cache and both execute.
      const acquired = await redis.set(redisKey, 'IN_FLIGHT', 'EX', 60, 'NX');
      if (acquired !== 'OK') {
        res.status(409).json({
          success: false,
          error: {
            code: 'IDEMPOTENT_OPERATION_IN_FLIGHT',
            message: 'A request with this Idempotency-Key is currently being processed.',
          },
        });
        return;
      }
      let settled = false;

      // 3. Intercept response to cache result
      const originalJson = res.json.bind(res);

      res.json = (body: any): Response => {
        settled = true;
        if (res.statusCode >= 200 && res.statusCode < 400) {
          const responseToCache: CachedIdempotentResponse & { fingerprint: string } = {
            fingerprint,
            statusCode: res.statusCode,
            headers: { 'content-type': 'application/json' },
            body,
          };
          redis
            .set(redisKey, JSON.stringify(responseToCache), 'EX', ttlSeconds)
            .catch((err) => logger.error('[Idempotency] Failed to cache idempotent response', { err }));
        } else {
          // Clear lock on error so client can retry safely
          redis.del(redisKey).catch(() => {});
        }

        return originalJson(body);
      };
      // Responses that never go through res.json (204, send, aborted) must not keep the lock.
      res.on('close', () => {
        if (!settled) redis.del(redisKey).catch(() => {});
      });

      next();
    } catch (err) {
      logger.warn('[Idempotency] Redis error during idempotency check, proceeding safely without lock', {
        error: err,
      });
      next();
    }
  };
};
