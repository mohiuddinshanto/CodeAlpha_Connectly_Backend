import { getCollections, parseObjectId } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { getUnreadCountsByConversation } from './chatService.js';

export function createFriendshipPairKey(firstId, secondId) {
  return [firstId.toString(), secondId.toString()].sort().join(':');
}

function toFriendUser(user) {
  return {
    id: user._id.toHexString(),
    name: user.name,
    username: user.username,
    profilePicture: user.profilePicture || '',
    bio: user.bio || '',
  };
}

function getRelationshipStatus(relationship, viewerId) {
  if (!relationship) return { status: 'not_friends' };
  if (relationship.status === 'accepted') {
    return {
      status: 'friends',
      conversationId: relationship._id.toHexString(),
    };
  }
  const viewerIsRequester = relationship.requesterId.equals(viewerId);
  return {
    status: viewerIsRequester ? 'pending_sent' : 'pending_received',
    requestId: relationship._id.toHexString(),
  };
}

export async function getFriendStatus(viewerId, targetId) {
  const viewerObjectId = parseObjectId(viewerId);
  const targetObjectId = parseObjectId(targetId);
  if (!viewerObjectId || !targetObjectId) {
    throw new AppError('Invalid user ID.', 400, 'INVALID_OBJECT_ID');
  }
  if (viewerObjectId.equals(targetObjectId)) {
    throw new AppError('You cannot add yourself as a friend.', 400);
  }

  const cols = getCollections();
  const target = await cols.users.findOne({ _id: targetObjectId });
  if (!target) throw new AppError('User not found.', 404, 'USER_NOT_FOUND');

  const relationship = await cols.friendships.findOne({
    pairKey: createFriendshipPairKey(viewerObjectId, targetObjectId),
  });
  return getRelationshipStatus(relationship, viewerObjectId);
}

export async function listFriends(userId) {
  const userObjectId = parseObjectId(userId);
  if (!userObjectId) {
    throw new AppError('Invalid user ID.', 400, 'INVALID_OBJECT_ID');
  }

  const cols = getCollections();
  const relationships = await cols.friendships
    .find({
      status: 'accepted',
      $or: [{ requesterId: userObjectId }, { recipientId: userObjectId }],
    })
    .sort({ acceptedAt: -1 })
    .toArray();
  const unreadByConversation = await getUnreadCountsByConversation(
    userObjectId.toHexString(),
    relationships.map((relationship) => relationship._id)
  );

  const friendIds = relationships.map((relationship) =>
    relationship.requesterId.equals(userObjectId)
      ? relationship.recipientId
      : relationship.requesterId
  );
  const users = await cols.users.find({ _id: { $in: friendIds } }).toArray();
  const usersById = new Map(
    users.map((user) => [user._id.toHexString(), toFriendUser(user)])
  );

  return relationships
    .map((relationship, index) => {
      const friendId = friendIds[index].toHexString();
      const friend = usersById.get(friendId);
      if (!friend) return null;
      return {
        conversationId: relationship._id.toHexString(),
        acceptedAt: relationship.acceptedAt,
        unreadCount:
          unreadByConversation.get(relationship._id.toHexString()) || 0,
        user: friend,
      };
    })
    .filter(Boolean);
}

export async function listFriendRequests(userId) {
  const userObjectId = parseObjectId(userId);
  if (!userObjectId) {
    throw new AppError('Invalid user ID.', 400, 'INVALID_OBJECT_ID');
  }

  const cols = getCollections();
  const relationships = await cols.friendships
    .find({
      status: 'pending',
      $or: [{ requesterId: userObjectId }, { recipientId: userObjectId }],
    })
    .sort({ createdAt: -1 })
    .toArray();
  const otherIds = relationships.map((relationship) =>
    relationship.requesterId.equals(userObjectId)
      ? relationship.recipientId
      : relationship.requesterId
  );
  const users = await cols.users.find({ _id: { $in: otherIds } }).toArray();
  const usersById = new Map(
    users.map((user) => [user._id.toHexString(), toFriendUser(user)])
  );

  const incoming = [];
  const outgoing = [];
  relationships.forEach((relationship, index) => {
    const user = usersById.get(otherIds[index].toHexString());
    if (!user) return;
    const request = {
      id: relationship._id.toHexString(),
      createdAt: relationship.createdAt,
      user,
    };
    if (relationship.recipientId.equals(userObjectId)) {
      incoming.push(request);
    } else {
      outgoing.push(request);
    }
  });

  return { incoming, outgoing };
}

export async function sendFriendRequest(viewerId, targetId) {
  const viewerObjectId = parseObjectId(viewerId);
  const targetObjectId = parseObjectId(targetId);
  if (!viewerObjectId || !targetObjectId) {
    throw new AppError('Invalid user ID.', 400, 'INVALID_OBJECT_ID');
  }
  if (viewerObjectId.equals(targetObjectId)) {
    throw new AppError('You cannot add yourself as a friend.', 400);
  }

  const cols = getCollections();
  const target = await cols.users.findOne({ _id: targetObjectId });
  if (!target) throw new AppError('User not found.', 404, 'USER_NOT_FOUND');

  const pairKey = createFriendshipPairKey(viewerObjectId, targetObjectId);
  const existing = await cols.friendships.findOne({ pairKey });
  if (existing) return getRelationshipStatus(existing, viewerObjectId);

  const now = new Date();
  const relationship = {
    requesterId: viewerObjectId,
    recipientId: targetObjectId,
    pairKey,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };
  try {
    const result = await cols.friendships.insertOne(relationship);
    return {
      status: 'pending_sent',
      requestId: result.insertedId.toHexString(),
    };
  } catch (err) {
    if (err?.code !== 11000) throw err;
    const current = await cols.friendships.findOne({ pairKey });
    if (!current) throw err;
    return getRelationshipStatus(current, viewerObjectId);
  }
}

export async function acceptFriendRequest(viewerId, requestId) {
  const viewerObjectId = parseObjectId(viewerId);
  const requestObjectId = parseObjectId(requestId);
  if (!viewerObjectId || !requestObjectId) {
    throw new AppError('Invalid request ID.', 400, 'INVALID_OBJECT_ID');
  }

  const cols = getCollections();
  const request = await cols.friendships.findOne({
    _id: requestObjectId,
    status: 'pending',
  });
  if (!request) {
    throw new AppError('Friend request not found.', 404, 'REQUEST_NOT_FOUND');
  }
  if (!request.recipientId.equals(viewerObjectId)) {
    throw new AppError(
      'Only the recipient can accept this request.',
      403,
      'FORBIDDEN'
    );
  }

  const acceptedAt = new Date();
  const result = await cols.friendships.updateOne(
    {
      _id: requestObjectId,
      recipientId: viewerObjectId,
      status: 'pending',
    },
    { $set: { status: 'accepted', acceptedAt, updatedAt: acceptedAt } }
  );
  if (result.modifiedCount !== 1) {
    const current = await cols.friendships.findOne({ _id: requestObjectId });
    if (current?.status === 'accepted') {
      return {
        status: 'friends',
        conversationId: current._id.toHexString(),
      };
    }
    throw new AppError(
      'This friend request is no longer available.',
      409,
      'REQUEST_NOT_PENDING'
    );
  }

  return { status: 'friends', conversationId: requestObjectId.toHexString() };
}

export async function removeFriendRequest(viewerId, requestId) {
  const viewerObjectId = parseObjectId(viewerId);
  const requestObjectId = parseObjectId(requestId);
  if (!viewerObjectId || !requestObjectId) {
    throw new AppError('Invalid request ID.', 400, 'INVALID_OBJECT_ID');
  }

  const cols = getCollections();
  const result = await cols.friendships.deleteOne({
    _id: requestObjectId,
    status: 'pending',
    $or: [{ requesterId: viewerObjectId }, { recipientId: viewerObjectId }],
  });
  if (result.deletedCount !== 1) {
    throw new AppError(
      'Friend request not found or no longer pending.',
      404,
      'REQUEST_NOT_FOUND'
    );
  }
}
