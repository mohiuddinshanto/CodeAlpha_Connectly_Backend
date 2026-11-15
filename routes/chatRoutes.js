import { Router } from 'express';
import {
  createChatSocketTicketHandler,
  getChatDetailsHandler,
  getChatMessagesHandler,
  getUnreadMessageCountsHandler,
  markConversationReadHandler,
} from '../controllers/chatController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);
router.post('/socket-ticket', createChatSocketTicketHandler);
router.get('/unread-count', getUnreadMessageCountsHandler);
router.post('/:conversationId/read', markConversationReadHandler);
router.get('/:conversationId', getChatDetailsHandler);
router.get('/:conversationId/messages', getChatMessagesHandler);

export default router;
