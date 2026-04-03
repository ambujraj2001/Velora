import type { ZodSchema } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';

export const validate =
  (schema: ZodSchema, source: 'body' | 'params' | 'query' = 'body') =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      sendError(
        res,
        'VALIDATION_ERROR',
        'Invalid input',
        400,
        result.error.flatten().fieldErrors,
      );
      return;
    }
    (req as Request & Record<string, unknown>)[source] = result.data as never;
    next();
  };
