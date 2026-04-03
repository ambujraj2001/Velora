import type { Request, Response } from 'express';
import { requireSessionUser, type SessionUser } from '../utils/auth';
import { sendSuccess, sendError } from '../utils/response';
import { sendReportEmail } from '../services/reportService';
import type { EmailReportBody, ChatRequestBody } from '../schemas';
import { executeChatTurn } from '../services/chatTurnService';
import {
  createChatJob,
  getChatJob,
  toPublicJobSnapshot,
  markChatJobRunning,
  completeChatJob,
  failChatJob,
} from '../services/chatJobService';
import type { ContextLogger } from '../lib/logger';

async function runChatJobInBackground(params: {
  jobId: string;
  body: ChatRequestBody;
  user: SessionUser;
  traceId: string;
  requestId: string;
  logger: ContextLogger;
}): Promise<void> {
  const { jobId, body, user, traceId, requestId, logger } = params;
  try {
    await markChatJobRunning(jobId);
    const result = await executeChatTurn({
      body,
      user,
      traceId,
      requestId,
      logger,
      jobId,
    });
    await completeChatJob(jobId, result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('chat_job_failed', { jobId, error: message });
    await failChatJob(jobId, message, 'CHAT_JOB_FAILED');
  }
}

export const handleCreateChatJob = async (req: Request, res: Response): Promise<void> => {
  const { logger, traceId, requestId } = req.context;

  try {
    const user = requireSessionUser(req, res);
    if (!user) return;

    const body = req.body as ChatRequestBody;
    const jobId = await createChatJob(user.userId);

    void runChatJobInBackground({
      jobId,
      body,
      user,
      traceId,
      requestId,
      logger,
    });

    sendSuccess(res, { jobId }, 202);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('chat_job_create_error', { error: message });
    sendError(res, 'INTERNAL_ERROR', message);
  }
};

export const handleGetChatJob = async (req: Request, res: Response): Promise<void> => {
  const { logger } = req.context;

  try {
    const user = requireSessionUser(req, res);
    if (!user) return;

    const jobId = String(req.params.jobId);
    const job = await getChatJob(jobId);

    if (!job || job.userId !== user.userId) {
      sendError(res, 'NOT_FOUND', 'Job not found.', 404);
      return;
    }

    sendSuccess(res, toPublicJobSnapshot(job));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('chat_job_get_error', { error: message });
    sendError(res, 'INTERNAL_ERROR', message);
  }
};

export const handleChat = async (req: Request, res: Response): Promise<void> => {
  const { logger, traceId, requestId } = req.context;

  try {
    logger.info('chat_request', { body: req.body });

    const user = requireSessionUser(req, res);
    if (!user) return;

    const result = await executeChatTurn({
      body: req.body as ChatRequestBody,
      user,
      traceId,
      requestId,
      logger,
    });

    sendSuccess(res, result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    logger.error('chat_controller_error', {
      error: message,
      stack,
    });
    sendError(res, 'INTERNAL_ERROR', message);
  }
};

export const handleEmailReport = async (req: Request, res: Response): Promise<void> => {
  const { logger } = req.context;
  try {
    const user = requireSessionUser(req, res);
    if (!user) return;

    const { pdfBase64 } = req.body as EmailReportBody;

    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    await sendReportEmail(user.email, pdfBuffer);

    sendSuccess(res, { success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('handleEmailReport_error', { error: message });
    sendError(res, 'INTERNAL_ERROR', message);
  }
};
