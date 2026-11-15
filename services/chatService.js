import { getCollections, parseObjectId } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { validateChatMessageContent } from '../validators/index.js';

function toChatUser(user) {
  return {
    id: user._id.toHexString(),
    name: user.name,
    username: user.username,
    profilePicture: user.profilePicture || '',
  };
}

function toChatMessage(message, sender) {
  return {
    id: message._id.toHexString(),
    conversationId: message.conversationId.toHexString(),
    sender: sender ? toChatUser(sender) : null,
    content: message.content,
    createdAt: message.createdAt,
  };
}

export async function getAcceptedFriendshipOrThrow(userId, conversationId) {
  const userObjectId = parseObjectId(userId);
  const conversationObjectId = parseObjectId(conversationId);
  if (!userObjectId || !conversationObjectId) {
    throw new AppError('Invalid conversation ID.', 400, 'INVALID_OBJECT_ID');
  }

  const cols = getCollections();
  const friendship = await cols.friendships.findOne({
    _id: conversationObjectId,
    status: 'accepted',
    $or: [{ requesterId: userObjectId }, { recipientId: userObjectId }],
  });
  if (!friendship) {
    throw new AppError(
      'Conversation not found or you are not a friend.',
      404,
      'CONVERSATION_NOT_FOUND'
    );
  }
  return friendship;
}

export async function getConversationDetails(userId, conversationId) {
  const friendship = await getAcceptedFriendshipOrThrow(
    userId,
    conversationId
  );
  const userObjectId = parseObjectId(userId);
  const friendId = friendship.requesterId.equals(userObjectId)
    ? friendship.recipientId
    : friendship.requesterId;
  const friend = await getCollections().users.findOne({ _id: friendId });
  if (!friend) {
    throw new AppError('Friend not found.', 404, 'USER_NOT_FOUND');
  }
  return {
    conversationId: friendship._id.toHexString(),
    friend: toChatUser(friend),
  };
}

export async function listConversationMessages(
  userId,
  conversationId,
  { limit = 50, skip = 0 } = {}
) {
  const friendship = await getAcceptedFriendshipOrThrow(
    userId,
    conversationId
  );
  const cols = getCollections();
  const filter = { conversationId: friendship._id };
  const total = await cols.messages.countDocuments(filter);
  const messages = await cols.messages
    .find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();
  messages.reverse();

  const senderIds = [...new Map(
    messages.map((message) => [message.senderId.toHexString(), message.senderId])
  ).values()];
  const senders = await cols.users.find({ _id: { $in: senderIds } }).toArray();
  const sendersById = new Map(
    senders.map((sender) => [sender._id.toHexString(), sender])
  );

  return {
    messages: messages.map((message) =>
      toChatMessage(
        message,
        sendersById.get(message.senderId.toHexString())
      )
    ),
    total,
    hasMore: skip + messages.length < total,
  };
}

export async function createChatMessage(
  userId,
  conversationId,
  content,
  clientMessageId
) {
  const contentResult = validateChatMessageContent(content);
  if (!contentResult.valid) {
    throw new AppError(contentResult.error, 400, 'INVALID_MESSAGE');
  }
  const friendship = await getAcceptedFriendshipOrThrow(
    userId,
    conversationId
  );
  const senderObjectId = parseObjectId(userId);
  if (
    clientMessageId !== undefined &&
    (typeof clientMessageId !== 'string' ||
      clientMessageId.length === 0 ||
      clientMessageId.length > 80)
  ) {
    throw new AppError('Invalid message ID.', 400, 'INVALID_MESSAGE_ID');
  }

  const cols = getCollections();
  if (clientMessageId) {
    const existing = await cols.messages.findOne({
      senderId: senderObjectId,
      clientMessageId,
    });
    if (existing) {
      if (
        !existing.conversationId.equals(friendship._id) ||
        existing.content !== contentResult.value
      ) {
        throw new AppError(
          'This message could not be sent with its current ID.',
          409,
          'MESSAGE_ID_CONFLICT'
        );
      }
      return hydrateSocketMessage(existing);
    }
  }

  const message = {
    conversationId: friendship._id,
    senderId: senderObjectId,
    content: contentResult.value,
    createdAt: new Date(),
    ...(clientMessageId ? { clientMessageId } : {}),
  };

  try {
    const result = await cols.messages.insertOne(message);
    message._id = result.insertedId;
  } catch (err) {
    if (err?.code !== 11000 || !clientMessageId) throw err;
    const existing = await cols.messages.findOne({
      senderId: senderObjectId,
      clientMessageId,
    });
    if (
      !existing ||
      !existing.conversationId.equals(friendship._id) ||
      existing.content !== contentResult.value
    ) {
      throw new AppError(
        'This message could not be sent with its current ID.',
        409,
        'MESSAGE_ID_CONFLICT'
      );
    }
    return hydrateSocketMessage(existing);
  }

  const sender = await cols.users.findOne({ _id: senderObjectId });
  return toChatMessage(message, sender);
}

export async function hydrateSocketMessage(message) {
  const cols = getCollections();
  const sender = await cols.users.findOne({ _id: message.senderId });
  return toChatMessage(message, sender);
}
