import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { connectDatabase, getDbMode } from './config/database.js';
import { env } from './config/env.js';
import { AppError, errorHandler } from './middleware/errorHandler.js';
import { createOriginGuard } from './middleware/originGuard.js';
import authRoutes from './routes/authRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import friendRoutes from './routes/friendRoutes.js';
import { commentRouter, postRouter } from './routes/postRoutes.js';
import userRoutes from './routes/userRoutes.js';

export async function initializeApp() {
  if (!env.mongoUri.trim()) {
    throw new Error('MONGODB_URI is required. Set it in backend/.env.');
  }
  if (!env.jwtSecret || !env.jwtSecret.trim()) {
    throw new Error(
      'JWT_SECRET is required. Set JWT_SECRET in backend/.env for authentication.'
    );
  }
  await connectDatabase();
}

export const app = express();
app.set('trust proxy', 1);

const allowedOrigins = env.clientUrl
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
    credentials: true,
  })
);

app.use(createOriginGuard(allowedOrigins));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(async (_req, _res, next) => {
  try {
    await initializeApp();
    next();
  } catch (err) {
    console.error(
      '[Connectly] Request initialization failed:',
      err.message || err
    );
    next(
      new AppError(
        'Service temporarily unavailable. Check the server configuration.',
        503,
        'SERVICE_UNAVAILABLE'
      )
    );
  }
});

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    service: 'connectly-api',
    dbMode: getDbMode(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRouter);
app.use('/api/comments', commentRouter);

app.use('/api', (_req, res) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found.',
  });
});

app.use(errorHandler);
