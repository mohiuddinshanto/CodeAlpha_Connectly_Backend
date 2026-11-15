import { ObjectId } from 'mongodb';
import { getCollections, parseObjectId } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';

export async function formatUserProfile(
  user,
  viewerId,
  includeEmail = false
) {
  const cols = getCollections();
  const viewerOid = viewerId ? parseObjectId(viewerId) : null;

  const [postsCount, followersCount, followingCount, followRecord] =
    await Promise.all([
      cols.posts.countDocuments({ authorId: user._id }),
      cols.follows.countDocuments({ followingId: user._id }),
      cols.follows.countDocuments({ followerId: user._id }),
      viewerOid && !viewerOid.equals(user._id)
        ? cols.follows.findOne({ followerId: viewerOid, followingId: user._id })
        : Promise.resolve(null),
    ]);

  return {
    id: user._id.toHexString(),
    name: user.name,
    username: user.username,
    ...(includeEmail ? { email: user.email } : {}),
    profilePicture: user.profilePicture || '',
    bio: user.bio || '',
    createdAt:
      user.createdAt instanceof Date
        ? user.createdAt.toISOString()
        : String(user.createdAt),
    postsCount,
    followersCount,
    followingCount,
    isFollowing: Boolean(followRecord),
  };
}

export async function getSuggestedUsers(viewerId, limit = 6) {
  const cols = getCollections();
  const viewerOid = viewerId ? parseObjectId(viewerId) : null;

  const filter = viewerOid ? { _id: { $ne: viewerOid } } : {};

  const users = await cols.users
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  return Promise.all(users.map((u) => formatUserProfile(u, viewerId, false)));
}

export async function searchUsers(query, viewerId, limit = 12) {
  const cols = getCollections();
  const safe = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (safe.length < 2) return [];

  const users = await cols.users
    .find({
      $or: [
        { name: { $regex: safe, $options: 'i' } },
        { username: { $regex: safe, $options: 'i' } },
      ],
    })
    .limit(limit)
    .toArray();

  return Promise.all(users.map((u) => formatUserProfile(u, viewerId, false)));
}

export async function getUserByIdOrThrow(userId) {
  const oid = parseObjectId(userId);
  if (!oid) {
    throw new AppError('Invalid user ID format.', 400, 'INVALID_OBJECT_ID');
  }
  const cols = getCollections();
  const user = await cols.users.findOne({ _id: oid });
  if (!user) {
    throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
  }
  return user;
}

export async function followUser(followerId, targetUserId) {
  const followerOid = parseObjectId(followerId);
  const targetOid = parseObjectId(targetUserId);
  if (!followerOid || !targetOid) {
    throw new AppError('Invalid user ID.', 400, 'INVALID_OBJECT_ID');
  }
  if (followerOid.equals(targetOid)) {
    throw new AppError('You cannot follow yourself.', 400, 'SELF_FOLLOW');
  }

  const cols = getCollections();
  const targetUser = await cols.users.findOne({ _id: targetOid });
  if (!targetUser) {
    throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
  }

  const existing = await cols.follows.findOne({
    followerId: followerOid,
    followingId: targetOid,
  });

  if (!existing) {
    try {
      await cols.follows.insertOne({
        _id: new ObjectId(),
        followerId: followerOid,
        followingId: targetOid,
        createdAt: new Date(),
      });
    } catch (err) {
      if (err?.code !== 11000) throw err;
    }
  }

  const followersCount = await cols.follows.countDocuments({
    followingId: targetOid,
  });
  return { following: true, followersCount };
}

export async function unfollowUser(followerId, targetUserId) {
  const followerOid = parseObjectId(followerId);
  const targetOid = parseObjectId(targetUserId);
  if (!followerOid || !targetOid) {
    throw new AppError('Invalid user ID.', 400, 'INVALID_OBJECT_ID');
  }

  const cols = getCollections();
  await cols.follows.deleteOne({
    followerId: followerOid,
    followingId: targetOid,
  });

  const followersCount = await cols.follows.countDocuments({
    followingId: targetOid,
  });
  return { following: false, followersCount };
}

export async function getFollowersList(targetUserId, viewerId, limit = 50, skip = 0) {
  const targetOid = parseObjectId(targetUserId);
  if (!targetOid) {
    throw new AppError('Invalid user ID.', 400, 'INVALID_OBJECT_ID');
  }
  const cols = getCollections();
  const edges = await cols.follows
    .find({ followingId: targetOid })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  if (edges.length === 0) return { users: [], total: 0, hasMore: false };
  const followerIds = edges.map((e) => e.followerId);
  const users = await cols.users.find({ _id: { $in: followerIds } }).toArray();
  const total = await cols.follows.countDocuments({ followingId: targetOid });
  return {
    users: await Promise.all(users.map((u) => formatUserProfile(u, viewerId, false))),
    total,
    hasMore: skip + edges.length < total,
  };
}

export async function getFollowingList(targetUserId, viewerId, limit = 50, skip = 0) {
  const targetOid = parseObjectId(targetUserId);
  if (!targetOid) {
    throw new AppError('Invalid user ID.', 400, 'INVALID_OBJECT_ID');
  }
  const cols = getCollections();
  const edges = await cols.follows
    .find({ followerId: targetOid })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  if (edges.length === 0) return { users: [], total: 0, hasMore: false };
  const followingIds = edges.map((e) => e.followingId);
  const users = await cols.users.find({ _id: { $in: followingIds } }).toArray();
  const total = await cols.follows.countDocuments({ followerId: targetOid });
  return {
    users: await Promise.all(users.map((u) => formatUserProfile(u, viewerId, false))),
    total,
    hasMore: skip + edges.length < total,
  };
}
