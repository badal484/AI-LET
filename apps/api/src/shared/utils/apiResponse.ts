import { Response } from 'express';
import { ApiSuccessResponse, ApiErrorResponse, ApiErrorDetail } from '@ai-companion/types';

export class ApiResponse {
  static success<T>(
    res: Response,
    data: T,
    statusCode = 200,
    meta?: {
      page?: number;
      limit?: number;
      total?: number;
      hasMore?: boolean;
      requestId?: string;
      correlationId?: string;
    },
  ): Response<ApiSuccessResponse<T>> {
    const correlationId =
      meta?.correlationId || (res.locals['correlationId'] as string | undefined);
    const payload: ApiSuccessResponse<T> = {
      success: true,
      data,
      meta: {
        ...meta,
        requestId: correlationId,
        correlationId,
      },
    };
    return res.status(statusCode).json(payload);
  }

  static error(
    res: Response,
    code: string,
    message: string,
    statusCode = 500,
    details?: ApiErrorDetail[],
  ): Response<ApiErrorResponse> {
    const correlationId = res.locals['correlationId'] as string | undefined;
    const payload: ApiErrorResponse = {
      success: false,
      error: {
        code,
        message,
        details,
        requestId: correlationId,
        correlationId,
        timestamp: new Date().toISOString(),
      },
    };
    return res.status(statusCode).json(payload);
  }
}
