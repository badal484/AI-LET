import { Request, Response, NextFunction } from 'express';
import { logger } from '../../config/logger.js';

export interface DeadlineContext {
  deadlineMs: number;
  remainingMs: () => number;
  isExpired: () => boolean;
}

export class DeadlineManager {
  /**
   * Wraps an asynchronous task with a strict deadline timeout.
   */
  public static async withDeadline<T>(
    promise: Promise<T>,
    timeoutMs: number,
    operationName = 'Operation',
  ): Promise<T> {
    let timer: NodeJS.Timeout | null = null;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`${operationName} exceeded strict deadline of ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      if (timer) clearTimeout(timer);
      return result;
    } catch (err) {
      if (timer) clearTimeout(timer);
      throw err;
    }
  }

  /**
   * Express middleware to attach request-level deadlines and abort handlers.
   */
  public static requestDeadlineMiddleware(defaultTimeoutMs = 30000) {
    return (req: Request, res: Response, next: NextFunction): void => {
      const headerTimeout = req.headers['x-request-timeout-ms']
        ? Number(req.headers['x-request-timeout-ms'])
        : defaultTimeoutMs;

      const validTimeout = Math.min(Math.max(headerTimeout, 1000), 120000);
      const startTime = Date.now();
      const deadline = startTime + validTimeout;

      const context: DeadlineContext = {
        deadlineMs: deadline,
        remainingMs: () => Math.max(0, deadline - Date.now()),
        isExpired: () => Date.now() >= deadline,
      };

      (req as any).deadline = context;

      const timer = setTimeout(() => {
        if (!res.headersSent) {
          logger.warn(`[Deadline] Request timed out on ${req.method} ${req.originalUrl} after ${validTimeout}ms`);
          res.status(504).json({
            success: false,
            error: {
              code: 'REQUEST_TIMEOUT',
              message: `The server was unable to complete the request within ${validTimeout}ms`,
            },
          });
        }
      }, validTimeout);

      res.on('finish', () => clearTimeout(timer));
      res.on('close', () => clearTimeout(timer));

      next();
    };
  }
}
