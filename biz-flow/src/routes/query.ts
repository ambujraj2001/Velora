import { Router } from 'express';
import { handleCsvQuery } from '../controllers/csvQueryController';

const router = Router();

/**
 * Endpoint for CSV-specific querying.
 *
 * This flow is separate from existing ClickHouse/Postgres agentic flows.
 */
router.post('/csv', handleCsvQuery);

export default router;
