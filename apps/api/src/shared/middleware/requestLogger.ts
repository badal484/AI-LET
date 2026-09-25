import { Request, Response, NextFunction } from 'express';
import { logger } from '../../config/logger.js';

export const requestLoggerMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  const correlationId = res.locals['correlationId'] as string;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { method, originalUrl } = req;
    const { statusCode } = res;

    const logPayload = {
      correlationId,
      method,
      url: originalUrl,
      status: statusCode,
      durationMs: duration,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    };

    if (statusCode >= 500) {
      logger.error(`HTTP ${method} ${originalUrl} ${statusCode} - ${duration}ms`, logPayload);
    } else if (statusCode >= 400) {
      logger.warn(`HTTP ${method} ${originalUrl} ${statusCode} - ${duration}ms`, logPayload);
    } else {
      logger.http(`HTTP ${method} ${originalUrl} ${statusCode} - ${duration}ms`, logPayload);
    }
  });

  next();
};
