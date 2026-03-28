import { Request, Response } from 'express';
import { supabase } from '../config/db';
import { requireSessionUser } from '../utils/auth';
import { askCsv } from '../services/csvQueryService';

/**
 * POST /api/query/csv
 *
 * Body: { "connection_id": "string", "query": "string" }
 *
 * Fetches connection details, validates type is 'csv', calls askCsv,
 * and returns generated SQL and resulting rows.
 */
export const handleCsvQuery = async (req: Request, res: Response) => {
  const { logger } = (req as any).context;

  try {
    const user = requireSessionUser(req, res);
    if (!user) return;

    const { connection_id, query } = req.body;

    if (!connection_id || !query) {
      return res.status(400).json({ error: 'connection_id and query are required' });
    }

    // 1. Fetch connection detail
    const { data: conn, error: connError } = await supabase
      .from('velora_connections')
      .select('*')
      .eq('id', connection_id)
      .eq('user_id', user.userId)
      .single();

    if (connError || !conn) {
      logger.warn('csv_query_connection_not_found', { connection_id, userId: user.userId });
      return res.status(404).json({ error: 'Connection not found or access denied.' });
    }

    // 2. Validate type is 'csv'
    if (conn.type !== 'csv') {
      logger.warn('csv_query_not_a_csv_connection', { connection_id, type: conn.type });
      return res.status(400).json({ error: 'Only CSV connections can be queried via this endpoint.' });
    }

    // 3. Prepare query context
    const csvContext = {
      query: query,
      file_url: conn.file_url,
      schema_json: conn.schema_json,
      description: conn.description || ''
    };

    logger.info('csv_query_start', { connection_id, query });

    // 4. Call askCsv (SQL Generation + Execution)
    const result = await askCsv(csvContext, logger);

    logger.info('csv_query_complete', { rowCount: result.rows.length });

    return res.status(200).json(result);

  } catch (err: any) {
    logger.error('csv_query_controller_error', {
      error: err.message,
      stack: err.stack,
    });

    if (err.error === 'CSV_QUERY_FAILED') {
      return res.status(500).json(err);
    }

    return res.status(500).json({
      error: 'CSV_QUERY_FAILED',
      message: err.message || 'An unexpected error occurred during CSV query execution.'
    });
  }
};
