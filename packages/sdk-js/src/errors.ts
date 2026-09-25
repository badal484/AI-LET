export class PlatformError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly requestId?: string;

  constructor(message: string, code: string = 'api_error', statusCode: number = 500, requestId?: string) {
    super(message);
    this.name = 'PlatformError';
    this.code = code;
    this.statusCode = statusCode;
    this.requestId = requestId;
  }
}

export class AuthenticationError extends PlatformError {
  constructor(message: string = 'Invalid or missing API credentials', requestId?: string) {
    super(message, 'unauthorized', 401, requestId);
    this.name = 'AuthenticationError';
  }
}

export class PermissionDeniedError extends PlatformError {
  constructor(message: string = 'Insufficient permissions or scope', requestId?: string) {
    super(message, 'forbidden', 403, requestId);
    this.name = 'PermissionDeniedError';
  }
}

export class NotFoundError extends PlatformError {
  constructor(message: string = 'Resource not found', requestId?: string) {
    super(message, 'not_found', 404, requestId);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends PlatformError {
  public readonly errors?: Array<{ field?: string; message: string }>;

  constructor(message: string = 'Invalid request parameters', errors?: Array<{ field?: string; message: string }>, requestId?: string) {
    super(message, 'invalid_request', 400, requestId);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

export class RateLimitError extends PlatformError {
  public readonly retryAfterSeconds?: number;

  constructor(message: string = 'Rate limit exceeded', retryAfterSeconds?: number, requestId?: string) {
    super(message, 'rate_limit_exceeded', 429, requestId);
    this.name = 'RateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class WebhookVerificationError extends Error {
  constructor(message: string = 'Webhook signature verification failed') {
    super(message);
    this.name = 'WebhookVerificationError';
  }
}
