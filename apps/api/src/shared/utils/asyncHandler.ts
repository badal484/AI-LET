import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Forwards rejected promises from async handlers to the error middleware (Express 4 does not). */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
