import { Router } from 'express';
import { validate } from '../middleware/validate';
import { updateSettingsSchema, sendInvitesSchema } from '../schemas';
import {
  getSettings,
  updateSettings,
  getTeam,
  sendInvites,
} from '../controllers/settingsController';

const router = Router();

router.get('/', getSettings);
router.put('/', validate(updateSettingsSchema), updateSettings);
router.get('/team', getTeam);
router.post('/invite', validate(sendInvitesSchema), sendInvites);

export default router;
