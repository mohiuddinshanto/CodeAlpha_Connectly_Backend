import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  getConversationDetails,
  listConversationMessages,
} from '../services/chatService.js';

export async function getChatDetailsHandler(req, res, next) {
  try {
    const conversation = await getConversationDetails(
      req.userId,
      req.params.conversationId
    );
    res.json({ success: true, conversation });
  } catch (err) {
    next(err);
  }
}

export async function getChatMessagesHandler(req, res, next) {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const skip = Math.max(0, Number(req.query.skip) || 0);
    const result = await listConversationMessages(
      req.userId,
      req.params.conversationId,
      { limit, skip }
    );
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export function createChatSocketTicketHandler(req, res, next) {
  try {
    if (!req.userId) {
      throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
    }
    const ticket = jwt.sign(
      { userId: req.userId, purpose: 'chat_socket' },
      env.jwtSecret,
      { expiresIn: '60s' }
    );
    const hostValue =
      process.env.VERCEL_PROJECT_PRODUCTION_URL ||
      process.env.VERCEL_URL ||
      req.headers.host ||
      '';
    const host = String(hostValue)
      .replace(/^https?:\/\//i, '')
      .split('/')[0];
    if (!/^[a-z0-9.-]+(?::\d+)?$/i.test(host)) {
      throw new AppError(
        'Chat connection is not configured.',
        503,
        'CHAT_UNAVAILABLE'
      );
    }
    const protocol = /^(localhost|127\.)/i.test(host) ? 'ws' : 'wss';
    res.json({ success: true, ticket, socketUrl: `${protocol}://${host}/api/ws` });
  } catch (err) {
    next(err);
  }
}
