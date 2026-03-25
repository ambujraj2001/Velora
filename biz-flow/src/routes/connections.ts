import { Router } from 'express';
import {
  addConnection,
  getConnections,
  deleteConnection,
  getConnectionTables,
  getConnectionTableColumns,
} from '../controllers/connectionController';

const router = Router();

router.post('/', addConnection);
router.get('/', getConnections);
router.delete('/:id', deleteConnection);
router.get('/:id/tables', getConnectionTables);
router.get('/:id/tables/:table/columns', getConnectionTableColumns);

export default router;
