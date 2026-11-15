import jwt from 'jsonwebtoken';
import { WebSocket, WebSocketServer } from 'ws';
import { connectDatabase, getCollections, parseObjectId } from '../config/database.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  createChatMessage,
  getAcceptedFriendshipOrThrow,
  hydrateSocketMessage,
} from './chatService.js';

const allowedOrigins = env.clientUrl
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const socketsByUserId = new Map();
let messageStreamPromise = null;
let messageChangeStream = null;

function sendJson(socket, payload) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function sendSocketError(socket, message, clientMessageId) {
  sendJson(socket, {
    type: 'error',
    error: message,
    ...(clientMessageId ? { clientMessageId } : {}),
  });
}

async function broadcastMessage(message) {
  const cols = getCollections();
  const friendship = await cols.friendships.findOne({
    _id: message.conversationId,
    status: 'accepted',
  });
  if (!friendship) return;

  const conversationId = friendship._id.toHexString();
  const hydratedMessage = await hydrateSocketMessage(message);
  const participantIds = [
    friendship.requesterId.toHexString(),
    friendship.recipientId.toHexString(),
  ];

  for (const userId of participantIds) {
    const sockets = socketsByUserId.get(userId);
    if (!sockets) continue;
    for (const socket of sockets) {
      if (socket.subscriptions.has(conversationId)) {
        sendJson(socket, { type: 'new_message', message: hydratedMessage });
      }
    }
  }
}

async function ensureMessageChangeStream() {
  if (messageStreamPromise) return messageStreamPromise;

  messageStreamPromise = (async () => {
    const stream = getCollections().messages.watch(
      [{ $match: { operationType: 'insert' } }],
      { fullDocument: 'default' }
    );
    messageChangeStream = stream;
    stream.on('change', (event) => {
      broadcastMessage(event.fullDocument).catch((err) => {
        console.error('[Chat WS] Message broadcast failed:', err);
      });
    });
    stream.on('error', (err) => {
      console.error('[Chat WS] MongoDB change stream failed:', err);
      if (messageChangeStream === stream) {
        messageChangeStream = null;
        messageStreamPromise = null;
      }
      for (const sockets of socketsByUserId.values()) {
        for (const socket of sockets) {
          socket.close(1011, 'Realtime service reconnecting');
        }
      }
    });
    stream.on('close', () => {
      if (messageChangeStream === stream) {
        messageChangeStream = null;
        messageStreamPromise = null;
      }
    });
    return stream;
  })().catch((err) => {
    messageStreamPromise = null;
    throw err;
  });

  return messageStreamPromise;
}

async function handleSocketMessage(socket, rawData) {
  let event;
  try {
    event = JSON.parse(rawData.toString());
  } catch {
    sendSocketError(socket, 'Invalid chat message format.');
    return;
  }
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    sendSocketError(socket, 'Invalid chat message format.');
    return;
  }

  const conversationId =
    typeof event.conversationId === 'string' ? event.conversationId : '';
  if (event.type === 'subscribe') {
    try {
      const friendship = await getAcceptedFriendshipOrThrow(
        socket.userId,
        conversationId
      );
      const id = friendship._id.toHexString();
      socket.subscriptions.add(id);
      sendJson(socket, { type: 'subscribed', conversationId: id });
    } catch (err) {
      if (!(err instanceof AppError)) {
        console.error('[Chat WS] Conversation subscription failed:', err);
      }
      sendJson(socket, {
        type: 'subscription_error',
        error:
          err instanceof AppError
            ? err.message
            : 'Unable to open this conversation.',
      });
    }
    return;
  }

  if (event.type === 'send_message') {
    const clientMessageId =
      typeof event.clientMessageId === 'string' &&
      event.clientMessageId.length <= 80
        ? event.clientMessageId
        : undefined;
    try {
      const parsedConversationId = parseObjectId(conversationId);
      if (
        !parsedConversationId ||
        !socket.subscriptions.has(parsedConversationId.toHexString())
      ) {
        throw new AppError('Join this conversation before sending a message.');
      }
      const message = await createChatMessage(
        socket.userId,
        conversationId,
        event.content,
        clientMessageId
      );
      sendJson(socket, {
        type: 'message_sent',
        message,
        ...(clientMessageId ? { clientMessageId } : {}),
      });
    } catch (err) {
      if (!(err instanceof AppError)) {
        console.error('[Chat WS] Message send failed:', err);
      }
      sendSocketError(
        socket,
        err instanceof AppError
          ? err.message
          : 'Unable to send message right now.',
        clientMessageId
      );
    }
    return;
  }

  sendSocketError(socket, 'Unsupported chat action.');
}

export function attachChatWebSocket(server) {
  const webSocketServer = new WebSocketServer({
    server,
    path: '/api/ws',
    maxPayload: 16 * 1024,
    verifyClient(info, done) {
      if (!allowedOrigins.includes(info.origin)) {
        done(false, 403, 'Origin not allowed');
        return;
      }

      const requestUrl = new URL(info.req.url, 'http://localhost');
      const ticket = requestUrl.searchParams.get('ticket');
      if (!ticket) {
        done(false, 401, 'Chat ticket required');
        return;
      }
      try {
        const claims = jwt.verify(ticket, env.jwtSecret);
        if (
          typeof claims.userId !== 'string' ||
          !parseObjectId(claims.userId) ||
          claims.purpose !== 'chat_socket'
        ) {
          done(false, 401, 'Invalid chat ticket');
          return;
        }
        info.req.chatUserId = claims.userId;
        done(true);
      } catch {
        done(false, 401, 'Invalid or expired chat ticket');
      }
    },
  });

  webSocketServer.on('connection', (socket, request) => {
    const userObjectId = parseObjectId(request.chatUserId);
    if (!userObjectId) {
      socket.close(1008, 'Invalid user');
      return;
    }
    const userId = userObjectId.toHexString();
    const queuedMessages = [];
    let initialized = false;
    socket.userId = userId;
    socket.subscriptions = new Set();
    socket.on('close', () => {
      const userSockets = socketsByUserId.get(userId);
      if (!userSockets) return;
      userSockets.delete(socket);
      if (userSockets.size === 0) socketsByUserId.delete(userId);
    });
    socket.on('error', (err) => {
      console.warn('[Chat WS] Client connection error:', err.message);
    });
    socket.on('message', (data) => {
      if (!initialized) {
        if (queuedMessages.length >= 5) {
          socket.close(1008, 'Too many messages during connection setup');
          return;
        }
        queuedMessages.push(data);
        return;
      }
      handleSocketMessage(socket, data).catch((err) => {
        console.error('[Chat WS] Request failed:', err);
        sendSocketError(socket, 'Chat service temporarily unavailable.');
      });
    });

    connectDatabase()
      .then(async () => {
        const user = await getCollections().users.findOne({ _id: userObjectId });
        if (!user) {
          socket.close(1008, 'User not found');
          return;
        }

        await ensureMessageChangeStream();
        if (socket.readyState !== WebSocket.OPEN) return;
        if (!socketsByUserId.has(userId)) {
          socketsByUserId.set(userId, new Set());
        }
        socketsByUserId.get(userId).add(socket);
        initialized = true;
        sendJson(socket, { type: 'ready' });
        for (const data of queuedMessages) {
          handleSocketMessage(socket, data).catch((err) => {
            console.error('[Chat WS] Request failed:', err);
            sendSocketError(socket, 'Chat service temporarily unavailable.');
          });
        }
      })
      .catch((err) => {
        console.error('[Chat WS] Connection initialization failed:', err);
        socket.close(1011, 'Chat service unavailable');
      });
  });

  return webSocketServer;
}
