import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { getCollections } from '../config/database.js';

export const DEMO_ACCOUNT = Object.freeze({
  name: 'Connectly Demo',
  username: 'connectlydemo',
  email: 'demo@connectly.app',
  password: 'ConnectlyDemo2026!',
});

const DEMO_POSTS = [
  'Welcome to Connectly! This demo account is here so you can explore the feed, try reactions, and join the conversation.',
  'A little progress each day adds up to something meaningful. What are you working on this week?',
  'Community makes every idea better. Share a thought, leave a comment, and say hello 👋',
];

export async function ensureDemoAccount() {
  const cols = getCollections();
  await cols.posts.createIndex({ demoKey: 1 }, { unique: true, sparse: true });

  let user = await cols.users.findOne({ email: DEMO_ACCOUNT.email });
  if (!user) {
    const now = new Date();
    const newUser = {
      _id: new ObjectId(),
      name: DEMO_ACCOUNT.name,
      username: DEMO_ACCOUNT.username,
      email: DEMO_ACCOUNT.email,
      password: await bcrypt.hash(DEMO_ACCOUNT.password, 10),
      profilePicture: '',
      bio: 'The official Connectly demo account. Feel free to explore!',
      createdAt: now,
      updatedAt: now,
    };
    try {
      await cols.users.insertOne(newUser);
      user = newUser;
    } catch (error) {
      if (error?.code !== 11000) throw error;
      user = await cols.users.findOne({ email: DEMO_ACCOUNT.email });
      if (!user) throw error;
    }
  }

  const now = new Date();
  await Promise.all(
    DEMO_POSTS.map((content, index) =>
      cols.posts.updateOne(
        { demoKey: `demo-post-${index + 1}` },
        {
          $setOnInsert: {
            _id: new ObjectId(),
            demoKey: `demo-post-${index + 1}`,
            authorId: user._id,
            content,
            image: '',
            likes: [],
            createdAt: new Date(now.getTime() - index * 60_000),
            updatedAt: now,
          },
        },
        { upsert: true }
      )
    )
  );
}
