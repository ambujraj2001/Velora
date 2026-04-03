import type { Request, Response } from 'express';
import { supabase } from '../config/db';
import { requireSessionUser } from '../utils/auth';
import { sendSuccess, sendError } from '../utils/response';
import { askCsv } from '../services/csvQueryService';
import type { CsvQueryBody } from '../schemas';

function isCsvQueryFailed(err: unknown): err is { error: string; message: string; sql?: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'error' in err &&
    (err as { error: string }).error === 'CSV_QUERY_FAILED'
  );
}

export const handleCsvQuery = async (req: Request, res: Response): Promise<void> => {
  const { logger } = req.context;

  try {
    const user = requireSessionUser(req, res);
    if (!user) return;

    const { connection_id, query } = req.body as CsvQueryBody;

    const { data: conn, error: connError } = await supabase
      .from('velora_connections')
      .select('*')
      .eq('id', connection_id)
      .eq('user_id', user.userId)
      .single();

    if (connError || !conn) {
      logger.warn('csv_query_connection_not_found', { connection_id, userId: user.userId });
      sendError(res, 'NOT_FOUND', 'Connection not found or access denied.', 404);
      return;
    }

    if (conn.type !== 'csv') {
      logger.warn('csv_query_not_a_csv_connection', { connection_id, type: conn.type });
      sendError(
        res,
        'BAD_REQUEST',
        'Only CSV connections can be queried via this endpoint.',
        400,
      );
      return;
    }

    const csvContext = {
      query,
      file_url: conn.file_url,
      schema_json: conn.schema_json,
      description: conn.description || '',
    };

    logger.info('csv_query_start', { connection_id, query });

    const result = await askCsv(csvContext, logger);

    logger.info('csv_query_complete', { rowCount: result.rows.length });

    sendSuccess(res, result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('csv_query_controller_error', {
      error: message,
      stack: err instanceof Error ? err.stack : undefined,
    });

    if (isCsvQueryFailed(err)) {
      sendError(res, err.error, err.message, 500, err.sql !== undefined ? { sql: err.sql } : undefined);
      return;
    }

    sendError(
      res,
      'CSV_QUERY_FAILED',
      message || 'An unexpected error occurred during CSV query execution.',
    );
  }
};
