import { MongoClient, ObjectId } from 'mongodb';
import { env } from './env.js';

let mongoClient = null;
let cachedDb = null;
let initPromise = null;

async function ensureIndexes() {
  const cols = getCollections();

  await cols.users.createIndex({ email: 1 }, { unique: true });
  await cols.users.createIndex({ username: 1 }, { unique: true });
  await cols.posts.createIndex({ authorId: 1, createdAt: -1 });
  await cols.posts.createIndex({ createdAt: -1 });
  await cols.comments.createIndex({ postId: 1 });
  await cols.follows.createIndex(
    { followerId: 1, followingId: 1 },
    { unique: true }
  );
  await cols.follows.createIndex({ followingId: 1, createdAt: -1 });
}

export async function connectDatabase() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const mongoUri = env.mongoUri ? env.mongoUri.trim() : '';
    if (!mongoUri) {
      throw new Error(
        'MONGODB_URI is required. Set MONGODB_URI in backend/.env to connect to MongoDB.'
      );
    }

    const client = new MongoClient(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });

    try {
      await client.connect();
      await client.db(env.mongoDbName).command({ ping: 1 });
      mongoClient = client;
      cachedDb = client.db(env.mongoDbName);
      console.log(`[DB] Connected to MongoDB (${env.mongoDbName})`);
    } catch (err) {
      await client.close().catch(() => {});
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Failed to connect to MongoDB at MONGODB_URI (${message}).`
      );
    }

    await ensureIndexes();
  })();

  return initPromise;
}

export function getDbMode() {
  return cachedDb ? 'mongodb' : 'disconnected';
}

export function getCollections() {
  if (!cachedDb) {
    throw new Error('Database not initialized. Call connectDatabase() first.');
  }
  return {
    users: cachedDb.collection('users'),
    posts: cachedDb.collection('posts'),
    comments: cachedDb.collection('comments'),
    follows: cachedDb.collection('follows'),
  };
}

export function parseObjectId(id) {
  if (!ObjectId.isValid(id)) return null;
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

export async function closeDatabase() {
  if (mongoClient) {
    await mongoClient.close();
    mongoClient = null;
    cachedDb = null;
  }
}
