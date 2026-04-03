import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { sendError } from '../utils/response';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const logger = req.context?.logger;
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  logger?.error('unhandled_error', { error: message, stack });

  if (err instanceof ZodError) {
    sendError(res, 'VALIDATION_ERROR', 'Invalid input', 400, err.flatten().fieldErrors);
    return;
  }

  sendError(res, 'INTERNAL_ERROR', message || 'Something went wrong');
}
