import { Router } from 'express';
import { validate } from '../middleware/validate';
import {
  addConnectionSchema,
  addCsvConnectionSchema,
  connectionIdParamSchema,
  tableColumnParamsSchema,
} from '../schemas';
import {
  addConnection,
  getConnections,
  deleteConnection,
  getConnectionTables,
  getConnectionTableColumns,
} from '../controllers/connectionController';
import { addCsvConnection } from '../controllers/csvConnectionController';

const router = Router();

router.post('/csv', validate(addCsvConnectionSchema), addCsvConnection);

router.post('/', validate(addConnectionSchema), addConnection);
router.get('/', getConnections);
router.delete('/:id', validate(connectionIdParamSchema, 'params'), deleteConnection);
router.get('/:id/tables', validate(connectionIdParamSchema, 'params'), getConnectionTables);
router.get(
  '/:id/tables/:table/columns',
  validate(tableColumnParamsSchema, 'params'),
  getConnectionTableColumns,
);

export default router;
