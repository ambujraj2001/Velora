import { Router } from 'express';
import {
  getSettings,
  updateSettings,
  getTeam,
  sendInvites,
} from '../controllers/settingsController';

const router = Router();

router.get('/', getSettings);
router.put('/', updateSettings);
router.get('/team', getTeam);
router.post('/invite', sendInvites);

export default router;
