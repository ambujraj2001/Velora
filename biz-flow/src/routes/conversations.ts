import { Router } from 'express';
import { validate } from '../middleware/validate';
import { conversationIdParamSchema } from '../schemas';
import {
  getConversations,
  getMessages,
  deleteConversation,
} from '../controllers/conversationController';

const router = Router();

router.get('/', getConversations);
router.delete(
  '/:conversationId',
  validate(conversationIdParamSchema, 'params'),
  deleteConversation,
);
router.get(
  '/:conversationId/messages',
  validate(conversationIdParamSchema, 'params'),
  getMessages,
);

export default router;
