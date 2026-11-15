import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from './errorHandler.js';

export const AUTH_COOKIE_NAME = 'connectly_token';

function cookieOptions(req, persistent = true) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const sameSite = env.crossSiteCookies ? 'none' : 'lax';
  const options = {
    httpOnly: true,
    secure: env.crossSiteCookies || isHttps || env.nodeEnv === 'production',
    sameSite,
    path: '/',
  };
  if (persistent) options.maxAge = 7 * 24 * 60 * 60 * 1000;
  return options;
}

export function signAuthToken(userId) {
  return jwt.sign({ userId }, env.jwtSecret, { expiresIn: '7d' });
}

export function setAuthCookie(req, res, token, persistent = true) {
  res.cookie(AUTH_COOKIE_NAME, token, cookieOptions(req, persistent));
}

export function clearAuthCookie(req, res) {
  const options = cookieOptions(req, false);
  res.clearCookie(AUTH_COOKIE_NAME, options);
}

function extractUserIdFromRequest(req) {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  if (!token || typeof token !== 'string') return null;
  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    return decoded?.userId || null;
  } catch {
    return null;
  }
}

export function requireAuth(req, _res, next) {
  const userId = extractUserIdFromRequest(req);
  if (!userId) {
    next(new AppError('Authentication required. Please sign in.', 401, 'UNAUTHORIZED'));
    return;
  }
  req.userId = userId;
  next();
}

export function optionalAuth(req, _res, next) {
  const userId = extractUserIdFromRequest(req);
  if (userId) {
    req.userId = userId;
  }
  next();
}
