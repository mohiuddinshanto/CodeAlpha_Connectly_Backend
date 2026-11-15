import { Router } from 'express';
import {
  createChatSocketTicketHandler,
  getChatDetailsHandler,
  getChatMessagesHandler,
} from '../controllers/chatController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);
router.post('/socket-ticket', createChatSocketTicketHandler);
router.get('/:conversationId', getChatDetailsHandler);
router.get('/:conversationId/messages', getChatMessagesHandler);

export default router;
