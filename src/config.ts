import dotenv from 'dotenv';

dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'GOOGLE_CLIENT_ID',
  'APPLE_CLIENT_ID',
  'APPLE_TEAM_ID',
  'APPLE_KEY_ID',
  'APPLE_PRIVATE_KEY',
  'FAL_API_KEY',
  'BETTER_AUTH_SECRET',
  'BETTER_AUTH_BASE_URL',
  'APPLE_CLIENT_SECRET',
] as const;

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

export const config = {
  database: {
    url: process.env.DATABASE_URL,
  },
  jwt: {
    secret: process.env.JWT_SECRET!,
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID!,
  },
  apple: {
    clientId: process.env.APPLE_CLIENT_ID!,
    teamId: process.env.APPLE_TEAM_ID!,
    keyId: process.env.APPLE_KEY_ID!,
    privateKey: process.env.APPLE_PRIVATE_KEY!,
    clientSecret: process.env.APPLE_CLIENT_SECRET!,
  },
  fal: {
    key: process.env.FAL_API_KEY!,
  },
  betterAuth: {
    secret: process.env.BETTER_AUTH_SECRET!,
    baseUrl: process.env.BETTER_AUTH_BASE_URL || 'https://xxxx-xx-xx-xxx-xx.ngrok.io',
  },
} as const;

// export const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
// export const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/cartoonify';
// export const FAL_API_KEY = process.env.FAL_API_KEY || '';

// if (!FAL_API_KEY) {
//   console.warn('Warning: FAL_API_KEY is not set in environment variables');
// } 