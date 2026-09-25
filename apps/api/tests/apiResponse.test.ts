import { describe, it, expect } from 'vitest';
import { ApiResponse } from '../src/shared/utils/apiResponse.js';
import { Response } from 'express';

describe('ApiResponse Envelope Utility', () => {
  const mockResponse = () => {
    const res: Partial<Response> = {
      locals: { correlationId: 'test-cid-12345' },
    };
    res.status = (code: number) => {
      res.statusCode = code;
      return res as Response;
    };
    res.json = (body: unknown) => {
      // @ts-expect-error test mock
      res.body = body;
      return res as Response;
    };
    return res as Response & { body: unknown };
  };

  it('formats success response correctly with meta and correlationId', () => {
    const res = mockResponse();
    const data = { id: 'char-1', name: 'Aria' };
    ApiResponse.success(res, data, 200, { page: 1, limit: 10, total: 1 });

    expect(res.statusCode).toBe(200);
    // @ts-expect-error test mock body
    expect(res.body.success).toBe(true);
    // @ts-expect-error test mock body
    expect(res.body.data).toEqual(data);
    // @ts-expect-error test mock body
    expect(res.body.meta.correlationId).toBe('test-cid-12345');
    // @ts-expect-error test mock body
    expect(res.body.meta.page).toBe(1);
  });

  it('formats error response correctly with timestamp and error payload', () => {
    const res = mockResponse();
    ApiResponse.error(res, 'VALIDATION_ERROR', 'Field missing', 400, [
      { field: 'email', message: 'Required' },
    ]);

    expect(res.statusCode).toBe(400);
    // @ts-expect-error test mock body
    expect(res.body.success).toBe(false);
    // @ts-expect-error test mock body
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    // @ts-expect-error test mock body
    expect(res.body.error.details).toHaveLength(1);
    // @ts-expect-error test mock body
    expect(res.body.error.correlationId).toBe('test-cid-12345');
    // @ts-expect-error test mock body
    expect(res.body.error.timestamp).toBeDefined();
  });
});
