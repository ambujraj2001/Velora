import { Router } from 'express';
import {
  saveDashboard,
  getDashboards,
  getDashboardById,
  refreshDashboard,
  deleteDashboard,
} from '../controllers/dashboardController';

const router = Router();

router.post('/save', saveDashboard);
router.get('/', getDashboards);
router.get('/:id', getDashboardById);
router.post('/:id/refresh', refreshDashboard);
router.delete('/:id', deleteDashboard);

export default router;
