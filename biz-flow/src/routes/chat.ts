import { Router } from 'express';
import { handleChat, handleEmailReport } from '../controllers/chatController';

const router = Router();

router.post('/', handleChat);
router.post('/email-report', handleEmailReport);

export default router;
