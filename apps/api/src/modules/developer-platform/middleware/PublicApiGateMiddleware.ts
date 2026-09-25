import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { DeveloperAuthService } from '../services/DeveloperAuthService.js';
import { OAuthService } from '../services/OAuthService.js';
import { DeveloperEmbedService } from '../services/DeveloperEmbedService.js';
import { AuthenticationError, PermissionDeniedError, RateLimitError, NotFoundError, ValidationError, AppError } from '../../../shared/errors/AppError.js';
import { logger } from '../../../shared/utils/logger.js';

// Simple in-memory / Redis-compatible sliding window rate limiter state
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

/**
 * Public API authentication and gateway middleware.
 * Authenticates Developer API Keys (Bearer sk_live_...), OAuth access tokens (Bearer dpt_...),
 * or Ephemeral Embed Tokens (X-Embed-Token / Bearer).
 */
export async function publicApiGateMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const requestId = (req.headers['x-request-id'] as string) || `req_${crypto.randomBytes(12).toString('hex')}`;
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  try {
    const authHeader = req.headers.authorization;
    const apiKeyHeader = req.headers['x-api-key'] as string | undefined;
    const embedTokenHeader = req.headers['x-embed-token'] as string | undefined;

    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (apiKeyHeader) {
      token = apiKeyHeader.trim();
    }

    if (!token && !embedTokenHeader) {
      throw new AuthenticationError('Missing authentication credential. Provide Authorization: Bearer <key_or_token> or X-Api-Key');
    }

    const authService = DeveloperAuthService.getInstance();
    const oauthService = OAuthService.getInstance();
    const embedService = DeveloperEmbedService.getInstance();

    // 1. Check if token is Developer API Key (sk_live_, pk_live_, sk_test_, pk_test_, etc.)
    if (token && (token.startsWith('sk_') || token.startsWith('pk_') || token.startsWith('ak_'))) {
      const authResult = await authService.authenticateApiKey(token);

      req.developerContext = {
        projectId: authResult.projectId,
        userId: authResult.userId,
        authType: 'API_KEY',
        scopes: authResult.scopes,
        environment: authResult.environment,
        keyType: authResult.keyType,
        apiKeyId: authResult.apiKeyId,
        requestId,
      };
    }
    // 2. Check if token is OAuth Access Token (dpt_...)
    else if (token && token.startsWith('dpt_')) {
      const oauthResult = await oauthService.verifyAccessToken(token);

      req.developerContext = {
        projectId: oauthResult.projectId,
        userId: oauthResult.userId,
        authType: 'OAUTH',
        scopes: oauthResult.scopes,
        environment: 'PRODUCTION', // OAuth apps map to project environment
        clientId: oauthResult.clientId,
        requestId,
      };
    }
    // 3. Check if token is Ephemeral Embed Token
    else if (embedTokenHeader || (token && token.startsWith('eyJ'))) {
      const embedToken = embedTokenHeader || token!;
      const origin = (req.headers.origin as string) || (req.headers.referer as string) || '';
      const embedResult = embedService.verifyEphemeralSessionToken(embedToken, origin);

      req.developerContext = {
        projectId: embedResult.projectId,
        userId: 'embed-anonymous-user',
        authType: 'EMBED',
        scopes: ['conversations:read', 'conversations:write', 'messages:write'],
        environment: 'PRODUCTION',
        characterId: embedResult.characterId,
        requestId,
      };
    } else {
      throw new AuthenticationError('Invalid API credential format');
    }

    // Enforce Rate Limiting per Project / Environment
    const rateLimitKey = `${req.developerContext.projectId}:${req.developerContext.environment}`;
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    const maxRequestsPerMinute = req.developerContext.environment === 'PRODUCTION' ? 600 : 120;

    let bucket = rateLimitMap.get(rateLimitKey);
    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 1, resetAt: now + windowMs };
      rateLimitMap.set(rateLimitKey, bucket);
    } else {
      bucket.count += 1;
    }

    const remaining = Math.max(0, maxRequestsPerMinute - bucket.count);
    const resetSeconds = Math.ceil((bucket.resetAt - now) / 1000);

    res.setHeader('X-RateLimit-Limit', maxRequestsPerMinute.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', resetSeconds.toString());

    if (bucket.count > maxRequestsPerMinute) {
      res.setHeader('Retry-After', resetSeconds.toString());
      throw new RateLimitError(`Rate limit exceeded (${maxRequestsPerMinute} req/min). Please retry in ${resetSeconds}s.`);
    }

    next();
  } catch (error) {
    publicApiErrorHandler(error, req, res, next);
  }
}

/**
 * Middleware generator requiring specific scopes.
 */
export function requirePublicScope(...requiredScopes: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.developerContext) {
        throw new AuthenticationError('Unauthenticated public request');
      }

      const grantedScopes = req.developerContext.scopes;
      const authService = DeveloperAuthService.getInstance();

      for (const scope of requiredScopes) {
        if (!authService.hasScope(grantedScopes, scope)) {
          throw new PermissionDeniedError(`Missing required scope '${scope}' for this endpoint`);
        }
      }

      next();
    } catch (error) {
      publicApiErrorHandler(error, req, res, next);
    }
  };
}

/**
 * Standardized Public API Error Formatter.
 * Adheres strictly to the JSON contract:
 * {
 *   "error": {
 *     "code": "invalid_request",
 *     "message": "Human-readable explanation",
 *     "request_id": "req_..."
 *   }
 * }
 */
export function publicApiErrorHandler(
  err: any,
  req: Request,
  res: Response,
  _next?: NextFunction
): void {
  const requestId = req.requestId || (req.headers['x-request-id'] as string) || `req_${crypto.randomBytes(8).toString('hex')}`;
  res.setHeader('X-Request-Id', requestId);

  let statusCode = 500;
  let errorCode = 'internal_server_error';
  let message = 'An unexpected error occurred while processing your request';

  if (err instanceof AuthenticationError || err.statusCode === 401) {
    statusCode = 401;
    errorCode = 'unauthorized';
    message = err.message || 'Authentication credentials are invalid or missing';
  } else if (err instanceof PermissionDeniedError || err.statusCode === 403) {
    statusCode = 403;
    errorCode = 'permission_denied';
    message = err.message || 'You do not have permission to access this resource';
  } else if (err instanceof NotFoundError || err.statusCode === 404) {
    statusCode = 404;
    errorCode = 'not_found';
    message = err.message || 'The requested resource was not found';
  } else if (err instanceof RateLimitError || err.statusCode === 429) {
    statusCode = 429;
    errorCode = 'rate_limit_exceeded';
    message = err.message || 'Rate limit or spend limit exceeded';
  } else if (err instanceof ValidationError || err.statusCode === 400 || err.statusCode === 422) {
    statusCode = 400;
    errorCode = 'invalid_request';
    message = err.message || 'Invalid request parameters';
  } else if (err instanceof AppError) {
    statusCode = err.statusCode || 400;
    errorCode = err.code ? err.code.toLowerCase() : 'application_error';
    message = err.message;
  } else {
    logger.error(`[PublicAPI] Unhandled Error [${requestId}]:`, err);
  }

  res.status(statusCode).json({
    error: {
      code: errorCode,
      message,
      request_id: requestId,
    },
  });
}
