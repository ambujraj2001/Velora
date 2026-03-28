import { Router } from 'express';
import {
  addConnection,
  getConnections,
  deleteConnection,
  getConnectionTables,
  getConnectionTableColumns,
} from '../controllers/connectionController';
import { addCsvConnection } from '../controllers/csvConnectionController';

const router = Router();

// ── CSV connections ────────────────────────────────────────────────────────
router.post('/csv', addCsvConnection);

// ── DB connections (postgres / clickhouse) ────────────────────────────────
router.post('/', addConnection);
router.get('/', getConnections);
router.delete('/:id', deleteConnection);
router.get('/:id/tables', getConnectionTables);
router.get('/:id/tables/:table/columns', getConnectionTableColumns);

export default router;
