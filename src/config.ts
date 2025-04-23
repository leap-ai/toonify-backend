import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { getApplePrivateKey } from './utils/helper';

dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'APPLE_CLIENT_ID',
  'APPLE_TEAM_ID',
  'APPLE_KEY_ID',
  'APPLE_APP_BUNDLE_IDENTIFIER',
  'FAL_API_KEY',
  'BETTER_AUTH_SECRET',
  'REVENUECAT_SECRET',
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
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  },
  apple: {
    clientId: process.env.APPLE_CLIENT_ID!,
    teamId: process.env.APPLE_TEAM_ID!,
    keyId: process.env.APPLE_KEY_ID!,
    appBundleIdentifier: process.env.APPLE_APP_BUNDLE_IDENTIFIER!,
  },
  fal: {
    key: process.env.FAL_API_KEY!,
  },
  betterAuth: {
    secret: process.env.BETTER_AUTH_SECRET!,
  },
  revenuecat: {
    secret: process.env.REVENUECAT_SECRET!,
  },
  // Method to generate Apple client secret on the fly
  getAppleClientSecret: () => {
    const teamId = config.apple.teamId;
    const clientId = config.apple.clientId;
    const keyId = config.apple.keyId;
    const privateKey = getApplePrivateKey();

    const payload = {
      iss: teamId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400 * 180,
      aud: "https://appleid.apple.com",
      sub: clientId,
    };

    const header = {
      alg: 'ES256',
      kid: keyId,
    };

    try {
      const clientSecret = jwt.sign(payload, privateKey, {
        algorithm: 'ES256',
        header: header,
      });
      return clientSecret;
    } catch (error) {
      console.error('Error generating Apple client secret:', error);
      throw new Error('Failed to generate Apple client secret');
    }
  }
} as const;