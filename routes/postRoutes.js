import { Router } from 'express';
import {
  addCommentHandler,
  createPostHandler,
  deleteCommentHandler,
  deletePostHandler,
  getAllPostsHandler,
  getFollowingFeedHandler,
  getPostCommentsHandler,
  getPostDetailHandler,
  likePostHandler,
  unlikePostHandler,
  updatePostHandler,
  uploadPostImageHandler,
} from '../controllers/postController.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';

export const postRouter = Router();

postRouter.get('/', optionalAuth, getAllPostsHandler);
postRouter.get('/following', requireAuth, getFollowingFeedHandler);
postRouter.post('/upload-image', requireAuth, uploadPostImageHandler);
postRouter.post('/', requireAuth, createPostHandler);

postRouter.get('/:id', optionalAuth, getPostDetailHandler);
postRouter.put('/:id', requireAuth, updatePostHandler);
postRouter.delete('/:id', requireAuth, deletePostHandler);

postRouter.post('/:id/like', requireAuth, likePostHandler);
postRouter.delete('/:id/like', requireAuth, unlikePostHandler);

postRouter.post('/:id/comments', requireAuth, addCommentHandler);
postRouter.get('/:id/comments', optionalAuth, getPostCommentsHandler);

export const commentRouter = Router();
commentRouter.delete('/:id', requireAuth, deleteCommentHandler);
