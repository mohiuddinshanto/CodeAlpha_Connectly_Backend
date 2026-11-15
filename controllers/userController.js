import { getCollections, parseObjectId } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { listUserPosts } from '../services/postService.js';
import {
  parseMultipartImage,
  uploadImageToImgBB,
} from '../services/uploadService.js';
import {
  followUser,
  formatUserProfile,
  getFollowersList,
  getFollowingList,
  getSuggestedUsers,
  getUserByIdOrThrow,
  searchUsers,
  unfollowUser,
} from '../services/userService.js';
import { validateBio, validateFullName } from '../validators/index.js';

export async function listUsers(req, res, next) {
  try {
    const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 6));
    const users = await getSuggestedUsers(req.userId, limit);
    res.json({ success: true, users });
  } catch (err) {
    next(err);
  }
}

export async function searchUsersHandler(req, res, next) {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const users = await searchUsers(q, req.userId, 12);
    res.json({ success: true, users });
  } catch (err) {
    next(err);
  }
}

export async function getUserProfile(req, res, next) {
  try {
    const userId = String(req.params.id || '');
    const userDoc = await getUserByIdOrThrow(userId);
    const isSelf = req.userId === userDoc._id.toHexString();
    const user = await formatUserProfile(userDoc, req.userId, isSelf);
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
}

export async function updateOwnProfile(req, res, next) {
  try {
    if (!req.userId) {
      throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
    }
    const userOid = parseObjectId(req.userId);
    if (!userOid) {
      throw new AppError('Invalid user ID.', 400, 'INVALID_OBJECT_ID');
    }

    const { name, bio, profilePicture } = req.body || {};
    const updates = { updatedAt: new Date() };

    if (name !== undefined) {
      const nameRes = validateFullName(name);
      if (!nameRes.valid) throw new AppError(nameRes.error, 400);
      updates.name = nameRes.value;
    }

    if (bio !== undefined) {
      const bioRes = validateBio(bio);
      if (!bioRes.valid) throw new AppError(bioRes.error, 400);
      updates.bio = bioRes.value;
    }

    if (profilePicture !== undefined) {
      if (typeof profilePicture !== 'string') {
        throw new AppError('Invalid profile picture URL.', 400);
      }
      updates.profilePicture = profilePicture.trim();
    }

    const cols = getCollections();
    await cols.users.updateOne({ _id: userOid }, { $set: updates });
    const updatedDoc = await cols.users.findOne({ _id: userOid });
    if (!updatedDoc) {
      throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
    }

    const user = await formatUserProfile(updatedDoc, req.userId, true);
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
}

export async function getUserPostsHandler(req, res, next) {
  try {
    const userId = String(req.params.id || '');
    await getUserByIdOrThrow(userId);
    const limit = Math.min(30, Math.max(1, Number(req.query.limit) || 10));
    const skip = Math.max(0, Number(req.query.skip) || 0);
    const result = await listUserPosts(userId, req.userId, limit, skip);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getUserFollowersHandler(req, res, next) {
  try {
    const userId = String(req.params.id || '');
    await getUserByIdOrThrow(userId);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const skip = Math.max(0, Number(req.query.skip) || 0);
    const result = await getFollowersList(userId, req.userId, limit, skip);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getUserFollowingHandler(req, res, next) {
  try {
    const userId = String(req.params.id || '');
    await getUserByIdOrThrow(userId);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const skip = Math.max(0, Number(req.query.skip) || 0);
    const result = await getFollowingList(userId, req.userId, limit, skip);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function uploadAvatarHandler(req, res, next) {
  try {
    const parsedFile = await parseMultipartImage(req);
    const imageUrl = await uploadImageToImgBB(parsedFile);
    res.json({ success: true, imageUrl });
  } catch (err) {
    next(err);
  }
}

export async function followUserHandler(req, res, next) {
  try {
    if (!req.userId) {
      throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
    }
    const targetId = String(req.params.id || '');
    const result = await followUser(req.userId, targetId);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function unfollowUserHandler(req, res, next) {
  try {
    if (!req.userId) {
      throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
    }
    const targetId = String(req.params.id || '');
    const result = await unfollowUser(req.userId, targetId);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}
