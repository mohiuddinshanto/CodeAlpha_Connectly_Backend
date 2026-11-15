import { ObjectId } from 'mongodb';
import { getCollections, parseObjectId } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';

function toAuthorDTO(user, fallbackId) {
  if (!user) {
    return {
      id: fallbackId.toHexString(),
      name: 'Connectly Member',
      username: 'member',
      profilePicture: '',
    };
  }
  return {
    id: user._id.toHexString(),
    name: user.name,
    username: user.username,
    profilePicture: user.profilePicture || '',
  };
}

export async function hydratePosts(posts, viewerId) {
  if (posts.length === 0) return [];
  const cols = getCollections();
  const viewerOid = viewerId ? parseObjectId(viewerId) : null;

  const authorIds = Array.from(
    new Map(posts.map((p) => [p.authorId.toHexString(), p.authorId])).values()
  );

  const authors = await cols.users
    .find({ _id: { $in: authorIds } })
    .toArray();
  const authorMap = new Map(authors.map((a) => [a._id.toHexString(), a]));

  const postIds = posts.map((p) => p._id);
  const commentCountsRaw = await cols.comments
    .aggregate([
      { $match: { postId: { $in: postIds } } },
      { $group: { _id: '$postId', count: { $sum: 1 } } },
    ])
    .toArray();
  const commentCounts = new Map();
  for (const result of commentCountsRaw) {
    commentCounts.set(result._id.toHexString(), result.count);
  }

  return posts.map((post) => {
    const likes = Array.isArray(post.likes) ? post.likes : [];
    const isLiked = viewerOid
      ? likes.some((id) => id instanceof ObjectId && id.equals(viewerOid))
      : false;
    const author = authorMap.get(post.authorId.toHexString());
    return {
      id: post._id.toHexString(),
      content: post.content,
      image: post.image || '',
      createdAt:
        post.createdAt instanceof Date
          ? post.createdAt.toISOString()
          : String(post.createdAt),
      updatedAt:
        post.updatedAt instanceof Date
          ? post.updatedAt.toISOString()
          : String(post.updatedAt),
      author: toAuthorDTO(author, post.authorId),
      likesCount: likes.length,
      commentsCount: commentCounts.get(post._id.toHexString()) || 0,
      isLiked,
    };
  });
}

export async function hydrateComments(comments) {
  if (comments.length === 0) return [];
  const cols = getCollections();
  const authorIds = Array.from(
    new Map(
      comments.map((c) => [c.authorId.toHexString(), c.authorId])
    ).values()
  );
  const authors = await cols.users
    .find({ _id: { $in: authorIds } })
    .toArray();
  const authorMap = new Map(authors.map((a) => [a._id.toHexString(), a]));

  return comments.map((comment) => ({
    id: comment._id.toHexString(),
    postId: comment.postId.toHexString(),
    content: comment.content,
    createdAt:
      comment.createdAt instanceof Date
        ? comment.createdAt.toISOString()
        : String(comment.createdAt),
    author: toAuthorDTO(
      authorMap.get(comment.authorId.toHexString()),
      comment.authorId
    ),
  }));
}

export async function listPosts(options) {
  const cols = getCollections();
  const filter = {};

  if (options.topicQuery && options.topicQuery.trim().length > 0) {
    const safe = options.topicQuery
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.content = { $regex: safe, $options: 'i' };
  }

  const [total, rawPosts] = await Promise.all([
    cols.posts.countDocuments(filter),
    cols.posts
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(options.skip)
      .limit(options.limit)
      .toArray(),
  ]);

  const posts = await hydratePosts(rawPosts, options.viewerId);
  return {
    posts,
    total,
    hasMore: options.skip + posts.length < total,
  };
}

export async function listFollowingPosts(options) {
  const viewerOid = parseObjectId(options.viewerId);
  if (!viewerOid) {
    throw new AppError('Invalid user ID.', 400, 'INVALID_OBJECT_ID');
  }
  const cols = getCollections();
  const followEdges = await cols.follows
    .find({ followerId: viewerOid })
    .toArray();
  const followedIds = followEdges.map((f) => f.followingId);

  if (followedIds.length === 0) {
    return { posts: [], total: 0, hasMore: false };
  }

  const filter = { authorId: { $in: followedIds } };
  const [total, rawPosts] = await Promise.all([
    cols.posts.countDocuments(filter),
    cols.posts
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(options.skip)
      .limit(options.limit)
      .toArray(),
  ]);

  const posts = await hydratePosts(rawPosts, options.viewerId);
  return {
    posts,
    total,
    hasMore: options.skip + posts.length < total,
  };
}

export async function listUserPosts(
  targetUserId,
  viewerId,
  limit = 20,
  skip = 0
) {
  const targetOid = parseObjectId(targetUserId);
  if (!targetOid) {
    throw new AppError('Invalid user ID.', 400, 'INVALID_OBJECT_ID');
  }
  const cols = getCollections();
  const filter = { authorId: targetOid };
  const [total, rawPosts] = await Promise.all([
    cols.posts.countDocuments(filter),
    cols.posts
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
  ]);

  const posts = await hydratePosts(rawPosts, viewerId);
  return {
    posts,
    total,
    hasMore: skip + posts.length < total,
  };
}

export async function getPostByIdOrThrow(postId) {
  const oid = parseObjectId(postId);
  if (!oid) {
    throw new AppError('Invalid post ID format.', 400, 'INVALID_OBJECT_ID');
  }
  const cols = getCollections();
  const post = await cols.posts.findOne({ _id: oid });
  if (!post) {
    throw new AppError('Post not found.', 404, 'POST_NOT_FOUND');
  }
  return post;
}
