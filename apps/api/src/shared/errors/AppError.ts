import { ErrorCode, ErrorCodeType } from '@ai-companion/config';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCodeType;
  public readonly isOperational: boolean;
  public readonly details?: Array<{ field?: string; message: string; code?: string }>;

  constructor(
    message: string,
    statusCode = 500,
    code: ErrorCodeType = ErrorCode.INTERNAL_SERVER_ERROR,
    isOperational = true,
    details?: Array<{ field?: string; message: string; code?: string }>,
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(
    message = 'Validation failed',
    details?: Array<{ field?: string; message: string; code?: string }>,
  ) {
    super(message, 400, ErrorCode.VALIDATION_ERROR, true, details);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', code: ErrorCodeType = ErrorCode.BAD_REQUEST) {
    super(message, 400, code, true);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', code: ErrorCodeType = ErrorCode.UNAUTHORIZED) {
    super(message, 401, code, true);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required', code: ErrorCodeType = ErrorCode.UNAUTHORIZED) {
    super(message, 401, code, true);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Access forbidden') {
    super(message, 403, ErrorCode.FORBIDDEN, true);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden', code: ErrorCodeType = ErrorCode.FORBIDDEN) {
    super(message, 403, code, true);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code: ErrorCodeType = ErrorCode.NOT_FOUND) {
    super(message, 404, code, true);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', code: ErrorCodeType = ErrorCode.CONFLICT) {
    super(message, 409, code, true);
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests, please slow down') {
    super(message, 429, ErrorCode.RATE_LIMIT_EXCEEDED, true);
  }
}

export class AIProviderError extends AppError {
  constructor(
    message = 'AI provider request failed',
    code: ErrorCodeType = ErrorCode.AI_PROVIDER_ERROR,
  ) {
    super(message, 502, code, true);
  }
}

export class PermissionDeniedError extends AppError {
  constructor(message = 'Permission denied', code: ErrorCodeType = ErrorCode.FORBIDDEN) {
    super(message, 403, code, true);
  }
}

export class SecurityViolationError extends AppError {
  constructor(message = 'Security violation', code: ErrorCodeType = ErrorCode.FORBIDDEN) {
    super(message, 403, code, true);
  }
}


