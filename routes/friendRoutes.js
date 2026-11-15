import { Router } from 'express';
import {
  acceptFriendRequestHandler,
  getFriendRequestsHandler,
  getFriendStatusHandler,
  getFriendsHandler,
  removeFriendRequestHandler,
  sendFriendRequestHandler,
} from '../controllers/friendController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);
router.get('/', getFriendsHandler);
router.get('/requests', getFriendRequestsHandler);
router.get('/status/:userId', getFriendStatusHandler);
router.post('/requests/:userId', sendFriendRequestHandler);
router.post('/requests/:requestId/accept', acceptFriendRequestHandler);
router.delete('/requests/:requestId', removeFriendRequestHandler);

export default router;
