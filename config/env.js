import dotenv from 'dotenv';

dotenv.config();

const portValue = process.env.PORT || '5000';
const port = Number(portValue);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

export const env = {
  port,
  host: '127.0.0.1',
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI || '',
  mongoDbName: process.env.MONGODB_DB_NAME || 'connectly',
  jwtSecret: process.env.JWT_SECRET || '',
  imgbbApiKey: process.env.IMGBB_API_KEY || '',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  crossSiteCookies: process.env.CROSS_SITE_COOKIES === 'true',
};
