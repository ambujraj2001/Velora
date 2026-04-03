import { Router } from 'express';
import { validate } from '../middleware/validate';
import { saveDashboardSchema, dashboardIdParamSchema } from '../schemas';
import {
  saveDashboard,
  getDashboards,
  getDashboardById,
  refreshDashboard,
  deleteDashboard,
} from '../controllers/dashboardController';

const router = Router();

router.post('/save', validate(saveDashboardSchema), saveDashboard);
router.get('/', getDashboards);
router.get('/:id', validate(dashboardIdParamSchema, 'params'), getDashboardById);
router.post('/:id/refresh', validate(dashboardIdParamSchema, 'params'), refreshDashboard);
router.delete('/:id', validate(dashboardIdParamSchema, 'params'), deleteDashboard);

export default router;
