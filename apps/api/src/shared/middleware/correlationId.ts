import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

export const correlationIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const correlationId =
    (req.headers['x-correlation-id'] as string) ||
    (req.headers['x-request-id'] as string) ||
    randomUUID();
  res.locals['correlationId'] = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  res.setHeader('x-request-id', correlationId);
  next();
};
