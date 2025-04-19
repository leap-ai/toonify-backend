import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';

dotenv.config();
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL || '',
  },
});