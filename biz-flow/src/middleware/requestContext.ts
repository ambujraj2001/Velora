import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createLogger, flushLogs, type ContextLogger } from '../lib/logger';

export interface RequestContext {
  requestId: string;
  traceId: string;
  startTime: number;
  logger: ContextLogger;
}

declare global {
  namespace Express {
    interface Request {
      context: RequestContext;
    }
  }
}

function generateFallbackTraceId(): string {
  return uuidv4().replace(/-/g, '').substring(0, 16);
}

export function requestContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const traceId =
    (req.headers['x-trace-id'] as string) || generateFallbackTraceId();
  const requestId = uuidv4();
  const startTime = Date.now();

  const logger = createLogger({ requestId, traceId });

  req.context = { requestId, traceId, startTime, logger };

  res.setHeader('x-trace-id', traceId);
  res.setHeader('x-request-id', requestId);

  logger.info('request_start', {
    method: req.method,
    path: req.path,
    userAgent: req.headers['user-agent'],
  });

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info('request_end', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
    });
    flushLogs();
  });

  next();
}
