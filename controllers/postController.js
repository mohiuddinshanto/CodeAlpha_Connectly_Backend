import { ObjectId } from 'mongodb';
import { getCollections, parseObjectId } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  getPostByIdOrThrow,
  hydrateComments,
  hydratePosts,
  listFollowingPosts,
  listPosts,
} from '../services/postService.js';
import {
  parseMultipartImage,
  uploadImageToImgBB,
} from '../services/uploadService.js';
import {
  validateCommentContent,
  validatePostContent,
} from '../validators/index.js';

export async function createPostHandler(req, res, next) {
  try {
    if (!req.userId) {
      throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
    }
    const authorOid = parseObjectId(req.userId);
    if (!authorOid) {
      throw new AppError('Invalid user ID.', 400, 'INVALID_OBJECT_ID');
    }

    const { content, image } = req.body || {};
    const imageUrl = typeof image === 'string' ? image.trim() : '';

    const contentRes = validatePostContent(content, imageUrl);
    if (!contentRes.valid) {
      throw new AppError(contentRes.error, 400);
    }

    const now = new Date();
    const newPost = {
      _id: new ObjectId(),
      authorId: authorOid,
      content: contentRes.value,
      image: imageUrl,
      likes: [],
      createdAt: now,
      updatedAt: now,
    };

    const cols = getCollections();
    await cols.posts.insertOne(newPost);

    const [hydrated] = await hydratePosts([newPost], req.userId);
    res.status(201).json({ success: true, post: hydrated });
  } catch (err) {
    next(err);
  }
}

export async function getAllPostsHandler(req, res, next) {
  try {
    const limit = Math.min(30, Math.max(1, Number(req.query.limit) || 10));
    const skip = Math.max(0, Number(req.query.skip) || 0);
    const topicQuery = typeof req.query.q === 'string' ? req.query.q : '';
    const result = await listPosts({
      viewerId: req.userId,
      limit,
      skip,
      topicQuery,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getFollowingFeedHandler(req, res, next) {
  try {
    if (!req.userId) {
      throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
    }
    const limit = Math.min(30, Math.max(1, Number(req.query.limit) || 10));
    const skip = Math.max(0, Number(req.query.skip) || 0);
    const result = await listFollowingPosts({
      viewerId: req.userId,
      limit,
      skip,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getPostDetailHandler(req, res, next) {
  try {
    const postDoc = await getPostByIdOrThrow(String(req.params.id || ''));
    const [hydrated] = await hydratePosts([postDoc], req.userId);
    res.json({ success: true, post: hydrated });
  } catch (err) {
    next(err);
  }
}

export async function updatePostHandler(req, res, next) {
  try {
    if (!req.userId) {
      throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
    }
    const postDoc = await getPostByIdOrThrow(String(req.params.id || ''));
    if (postDoc.authorId.toHexString() !== req.userId) {
      throw new AppError(
        'You can only edit your own posts.',
        403,
        'FORBIDDEN'
      );
    }

    const { content, image } = req.body || {};
    const nextImage =
      image !== undefined
        ? typeof image === 'string'
          ? image.trim()
          : ''
        : postDoc.image;

    const contentRes = validatePostContent(content, nextImage);
    if (!contentRes.valid) {
      throw new AppError(contentRes.error, 400);
    }

    const cols = getCollections();
    const updatedAt = new Date();
    await cols.posts.updateOne(
      { _id: postDoc._id },
      {
        $set: {
          content: contentRes.value,
          image: nextImage,
          updatedAt,
        },
      }
    );

    const updatedDoc = await cols.posts.findOne({ _id: postDoc._id });
    if (!updatedDoc) {
      throw new AppError('Post not found.', 404, 'POST_NOT_FOUND');
    }
    const [hydrated] = await hydratePosts([updatedDoc], req.userId);
    res.json({ success: true, post: hydrated });
  } catch (err) {
    next(err);
  }
}

export async function deletePostHandler(req, res, next) {
  try {
    if (!req.userId) {
      throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
    }
    const postDoc = await getPostByIdOrThrow(String(req.params.id || ''));
    if (postDoc.authorId.toHexString() !== req.userId) {
      throw new AppError(
        'You can only delete your own posts.',
        403,
        'FORBIDDEN'
      );
    }

    const cols = getCollections();
    await Promise.all([
      cols.posts.deleteOne({ _id: postDoc._id }),
      cols.comments.deleteMany({ postId: postDoc._id }),
    ]);

    res.json({ success: true, deletedId: postDoc._id.toHexString() });
  } catch (err) {
    next(err);
  }
}

export async function uploadPostImageHandler(req, res, next) {
  try {
    const parsedFile = await parseMultipartImage(req);
    const imageUrl = await uploadImageToImgBB(parsedFile);
    res.json({ success: true, imageUrl });
  } catch (err) {
    next(err);
  }
}

export async function likePostHandler(req, res, next) {
  try {
    if (!req.userId) {
      throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
    }
    const userOid = parseObjectId(req.userId);
    if (!userOid) {
      throw new AppError('Invalid user ID.', 400, 'INVALID_OBJECT_ID');
    }
    const postDoc = await getPostByIdOrThrow(String(req.params.id || ''));

    const cols = getCollections();
    await cols.posts.updateOne(
      { _id: postDoc._id },
      { $addToSet: { likes: userOid } }
    );

    const refreshed = await cols.posts.findOne({ _id: postDoc._id });
    const likesCount = refreshed?.likes?.length ?? 0;
    res.json({ success: true, isLiked: true, likesCount });
  } catch (err) {
    next(err);
  }
}

export async function unlikePostHandler(req, res, next) {
  try {
    if (!req.userId) {
      throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
    }
    const userOid = parseObjectId(req.userId);
    if (!userOid) {
      throw new AppError('Invalid user ID.', 400, 'INVALID_OBJECT_ID');
    }
    const postDoc = await getPostByIdOrThrow(String(req.params.id || ''));

    const cols = getCollections();
    await cols.posts.updateOne(
      { _id: postDoc._id },
      { $pull: { likes: userOid } }
    );

    const refreshed = await cols.posts.findOne({ _id: postDoc._id });
    const likesCount = refreshed?.likes?.length ?? 0;
    res.json({ success: true, isLiked: false, likesCount });
  } catch (err) {
    next(err);
  }
}

export async function addCommentHandler(req, res, next) {
  try {
    if (!req.userId) {
      throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
    }
    const authorOid = parseObjectId(req.userId);
    if (!authorOid) {
      throw new AppError('Invalid user ID.', 400, 'INVALID_OBJECT_ID');
    }
    const postDoc = await getPostByIdOrThrow(String(req.params.id || ''));

    const { content } = req.body || {};
    const contentRes = validateCommentContent(content);
    if (!contentRes.valid) {
      throw new AppError(contentRes.error, 400);
    }

    const newComment = {
      _id: new ObjectId(),
      postId: postDoc._id,
      authorId: authorOid,
      content: contentRes.value,
      createdAt: new Date(),
    };

    const cols = getCollections();
    await cols.comments.insertOne(newComment);

    const [hydrated] = await hydrateComments([newComment]);
    const commentsCount = await cols.comments.countDocuments({
      postId: postDoc._id,
    });

    res.status(201).json({
      success: true,
      comment: hydrated,
      commentsCount,
    });
  } catch (err) {
    next(err);
  }
}

export async function getPostCommentsHandler(req, res, next) {
  try {
    const postDoc = await getPostByIdOrThrow(String(req.params.id || ''));
    const cols = getCollections();
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const skip = Math.max(0, Number(req.query.skip) || 0);
    const rawComments = await cols.comments
      .find({ postId: postDoc._id })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .toArray();
    const comments = await hydrateComments(rawComments);
    const total = await cols.comments.countDocuments({ postId: postDoc._id });
    res.json({ success: true, comments, total, hasMore: skip + comments.length < total });
  } catch (err) {
    next(err);
  }
}

export async function deleteCommentHandler(req, res, next) {
  try {
    if (!req.userId) {
      throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
    }
    const commentOid = parseObjectId(String(req.params.id || ''));
    if (!commentOid) {
      throw new AppError('Invalid comment ID.', 400, 'INVALID_OBJECT_ID');
    }

    const cols = getCollections();
    const comment = await cols.comments.findOne({ _id: commentOid });
    if (!comment) {
      throw new AppError('Comment not found.', 404, 'COMMENT_NOT_FOUND');
    }
    if (comment.authorId.toHexString() !== req.userId) {
      throw new AppError(
        'You can only delete your own comments.',
        403,
        'FORBIDDEN'
      );
    }

    await cols.comments.deleteOne({ _id: comment._id });
    const commentsCount = await cols.comments.countDocuments({
      postId: comment.postId,
    });

    res.json({
      success: true,
      deletedId: comment._id.toHexString(),
      postId: comment.postId.toHexString(),
      commentsCount,
    });
  } catch (err) {
    next(err);
  }
}
