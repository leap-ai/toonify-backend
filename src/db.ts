import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg'
const { Pool } = pg
import * as schema from '../drizzle/schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema }); 