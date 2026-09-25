import { Request, Response, NextFunction } from 'express';
import type { ZodTypeAny } from 'zod';

type RequestValidationSchema =
  | ZodTypeAny
  | {
      body?: ZodTypeAny;
      query?: ZodTypeAny;
      params?: ZodTypeAny;
    };

/**
 * Schemas come from `@ai-companion/validation`, which is CommonJS and so loads zod's CJS build, while
 * this ESM app loads zod's ESM build. The two builds have distinct classes, so `instanceof z.ZodType`
 * is always false for shared schemas — which previously sent every bare schema down the
 * `{ body, query, params }` branch and silently skipped validation. Detect a schema structurally.
 */
function isZodSchema(value: unknown): value is ZodTypeAny {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { parseAsync?: unknown }).parseAsync === 'function' &&
    '_def' in value
  );
}

export const validateRequest = (schema: RequestValidationSchema) => {
  if (!isZodSchema(schema) && !schema.body && !schema.query && !schema.params) {
    throw new Error('validateRequest: expected a zod schema or { body | query | params }');
  }
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (isZodSchema(schema)) {
        req.body = await schema.parseAsync(req.body);
      } else {
        if (schema.body) {
          req.body = await schema.body.parseAsync(req.body);
        }
        if (schema.query) {
          req.query = await schema.query.parseAsync(req.query);
        }
        if (schema.params) {
          req.params = await schema.params.parseAsync(req.params);
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};

export const validateBody = (schema: ZodTypeAny) => validateRequest(schema);
export const validateQuery = (schema: ZodTypeAny) => validateRequest({ query: schema });
export const validateParams = (schema: ZodTypeAny) => validateRequest({ params: schema });


