import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { connectDatabase, getDbMode } from './config/database.js';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createOriginGuard } from './middleware/originGuard.js';
import authRoutes from './routes/authRoutes.js';
import { commentRouter, postRouter } from './routes/postRoutes.js';
import userRoutes from './routes/userRoutes.js';
import { assertUploadConfig } from './services/uploadService.js';

async function startServer() {
  if (!env.mongoUri.trim()) {
    throw new Error('MONGODB_URI is required. Set it in backend/.env.');
  }
  if (!env.jwtSecret || !env.jwtSecret.trim()) {
    throw new Error(
      'JWT_SECRET is required. Set JWT_SECRET in backend/.env for authentication.'
    );
  }
  assertUploadConfig();
  await connectDatabase();

  const app = express();
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

  app.get('/api/health', (_req, res) => {
    res.json({
      success: true,
      service: 'connectly-api',
      dbMode: getDbMode(),
    });
  });

  app.use('/api/auth', authRoutes);
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

  app.listen(env.port, env.host, () => {
    console.log(
      `[Connectly] Express API server running at http://${env.host}:${env.port} (${env.nodeEnv})`
    );
  });
}

startServer().catch((err) => {
  console.error('[Connectly] Failed to start server:', err.message || err);
  process.exit(1);
});
