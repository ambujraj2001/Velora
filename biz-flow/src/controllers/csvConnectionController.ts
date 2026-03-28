import { requireSessionUser } from '../utils/auth';
import {
  validateCsvInput,
  createCsvConnection,
} from '../services/csvService';

/**
 * POST /api/connections/csv
 *
 * Body: { name: string, file_url: string, description: string }
 *
 * Returns the inserted velora_connections row (with schema_json).
 * Responds 400 for validation errors, 500 for runtime failures.
 */
export const addCsvConnection = async (req: any, res: any) => {
  const { logger } = req.context;
  try {
    const user = requireSessionUser(req, res);
    if (!user) return;

    const { name, file_url, description } = req.body;

    // ── Validate ──────────────────────────────────────────────────────────
    const validationError = validateCsvInput(name, file_url, description);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    logger.info('csv_connection_creating', { name, file_url });

    // ── Infer schema + persist ─────────────────────────────────────────────
    const connection = await createCsvConnection(
      {
        name,
        file_url,
        description,
        user_id: user.userId,
      },
      logger
    );

    logger.info('csv_connection_created', { id: connection.id, name });

    return res.status(201).json(connection);
  } catch (err: any) {
    logger.error('csv_connection_create_error', { error: err.message });

    // Surface DuckDB / CSV fetch errors as 500 with a clear message
    return res.status(500).json({
      error: 'Failed to create CSV connection',
      detail: err.message,
    });
  }
};
