import { Router } from 'express';
import { validate } from '../middleware/validate';
import {
  chatRequestSchema,
  emailReportSchema,
  chatJobIdParamSchema,
} from '../schemas';
import {
  handleChat,
  handleEmailReport,
  handleCreateChatJob,
  handleGetChatJob,
} from '../controllers/chatController';

const router = Router();

router.post('/jobs', validate(chatRequestSchema), handleCreateChatJob);
router.get('/jobs/:jobId', validate(chatJobIdParamSchema, 'params'), handleGetChatJob);
router.post('/', validate(chatRequestSchema), handleChat);
router.post('/email-report', validate(emailReportSchema), handleEmailReport);

export default router;
