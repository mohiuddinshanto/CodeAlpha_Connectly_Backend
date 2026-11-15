import { Router } from 'express';
import {
  followUserHandler,
  getUserFollowersHandler,
  getUserFollowingHandler,
  getUserPostsHandler,
  getUserProfile,
  listUsers,
  searchUsersHandler,
  unfollowUserHandler,
  updateOwnProfile,
  uploadAvatarHandler,
} from '../controllers/userController.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', optionalAuth, listUsers);
router.get('/search', optionalAuth, searchUsersHandler);
router.put('/profile', requireAuth, updateOwnProfile);
router.post('/upload-avatar', requireAuth, uploadAvatarHandler);

router.get('/:id', optionalAuth, getUserProfile);
router.get('/:id/posts', optionalAuth, getUserPostsHandler);
router.get('/:id/followers', optionalAuth, getUserFollowersHandler);
router.get('/:id/following', optionalAuth, getUserFollowingHandler);
router.post('/:id/follow', requireAuth, followUserHandler);
router.delete('/:id/follow', requireAuth, unfollowUserHandler);

export default router;
