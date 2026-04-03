import { Router } from 'express';
import { validate } from '../middleware/validate';
import { chatRequestSchema, emailReportSchema } from '../schemas';
import { handleChat, handleEmailReport } from '../controllers/chatController';

const router = Router();

router.post('/', validate(chatRequestSchema), handleChat);
router.post('/email-report', validate(emailReportSchema), handleEmailReport);

export default router;
