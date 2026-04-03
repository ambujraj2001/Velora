import type { Request, Response } from 'express';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    requestId?: string;
    traceId?: string;
  };
}

function getMeta(res: Response): ApiResponse['meta'] {
  const req = res.req as Request & { context?: { requestId: string; traceId: string } };
  if (!req.context) return undefined;
  return {
    requestId: req.context.requestId,
    traceId: req.context.traceId,
  };
}

export function sendSuccess<T>(res: Response, data: T, status = 200): void {
  const payload: ApiResponse<T> = {
    success: true,
    data,
    meta: getMeta(res),
  };
  res.status(status).json(payload);
}

export function sendError(
  res: Response,
  code: string,
  message: string,
  status = 500,
  details?: unknown,
): void {
  const payload: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
    meta: getMeta(res),
  };
  res.status(status).json(payload);
}
