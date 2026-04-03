import type { Request, Response } from 'express';
import { requireSessionUser } from '../utils/auth';
import { sendSuccess, sendError } from '../utils/response';
import { createCsvConnection } from '../services/csvService';
import type { AddCsvConnectionBody } from '../schemas';

export const addCsvConnection = async (req: Request, res: Response): Promise<void> => {
  const { logger } = req.context;
  try {
    const user = requireSessionUser(req, res);
    if (!user) return;

    const { name, file_url, description } = req.body as AddCsvConnectionBody;

    logger.info('csv_connection_creating', { name, file_url });

    const connection = await createCsvConnection(
      {
        name,
        file_url,
        description,
        user_id: user.userId,
      },
      logger,
    );

    logger.info('csv_connection_created', { id: connection.id, name });

    sendSuccess(res, connection, 201);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('csv_connection_create_error', { error: msg });

    sendError(res, 'CSV_CONNECTION_FAILED', 'Failed to create CSV connection', 500, {
      detail: msg,
    });
  }
};
