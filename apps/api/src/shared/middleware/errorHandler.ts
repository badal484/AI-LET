import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ErrorCode } from '@ai-companion/config';
import { AppError } from '../errors/AppError.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { logger } from '../../config/logger.js';
import { env } from '../../config/env.js';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const correlationId = res.locals['correlationId'] as string;

  // 1. Handled Domain AppError
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(`AppError: ${err.message}`, { correlationId, error: err, stack: err.stack });
    } else {
      logger.warn(`Client Error [${err.code}]: ${err.message}`, {
        correlationId,
        details: err.details,
      });
    }

    ApiResponse.error(res, err.code, err.message, err.statusCode, err.details);
    return;
  }

  // 2. Zod Validation Error
  // Structural check as well as instanceof: @ai-companion/validation is compiled to CommonJS and
  // loads zod's CJS build, while this ESM app loads zod's ESM build, so `instanceof` alone fails
  // for shared schemas (dual-package hazard) and validation errors would surface as 500s.
  if (isZodError(err)) {
    const details = err.issues.map(e => ({
      field: e.path.join('.'),
      message: e.message,
      code: e.code,
    }));

    logger.warn('Request validation failed', { correlationId, details });
    ApiResponse.error(
      res,
      ErrorCode.VALIDATION_ERROR,
      'Validation failed for request data',
      400,
      details,
    );
    return;
  }

  // 3. Unhandled Internal Server Errors
  logger.error('Unhandled Exception occurred', {
    correlationId,
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
  });

  const message = env.NODE_ENV === 'production' ? 'Internal server error' : err.message;

  ApiResponse.error(res, ErrorCode.INTERNAL_SERVER_ERROR, message, 500);
};

function isZodError(err: unknown): err is ZodError {
  return (
    err instanceof ZodError ||
    (typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'ZodError' && Array.isArray((err as { issues?: unknown }).issues))
  );
}
