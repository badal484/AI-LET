import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  AIProviderError,
} from '../src/shared/errors/AppError.js';
import { ErrorCode } from '@ai-companion/config';

describe('AppError Hierarchy Unit Tests', () => {
  it('instantiates ValidationError correctly with 400 status', () => {
    const err = new ValidationError('Invalid email format', [
      { field: 'email', message: 'Must be valid' },
    ]);
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(err.details).toHaveLength(1);
    expect(err.isOperational).toBe(true);
  });

  it('instantiates AuthenticationError with 401 status', () => {
    const err = new AuthenticationError('Token expired', ErrorCode.TOKEN_EXPIRED);
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe(ErrorCode.TOKEN_EXPIRED);
  });

  it('instantiates AuthorizationError with 403 status', () => {
    const err = new AuthorizationError('Admin privileges required');
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe(ErrorCode.FORBIDDEN);
  });

  it('instantiates NotFoundError with 404 status', () => {
    const err = new NotFoundError('Character not found', ErrorCode.CHARACTER_NOT_FOUND);
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe(ErrorCode.CHARACTER_NOT_FOUND);
  });

  it('instantiates RateLimitError with 429 status', () => {
    const err = new RateLimitError();
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
  });

  it('instantiates AIProviderError with 502 status', () => {
    const err = new AIProviderError('Anthropic API connection timeout');
    expect(err.statusCode).toBe(502);
    expect(err.code).toBe(ErrorCode.AI_PROVIDER_ERROR);
  });

  it('maintains prototype chain and stack traces', () => {
    const err = new AppError('General operational error', 500);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err.stack).toBeDefined();
  });
});
