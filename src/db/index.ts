import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { config } from '../config';
import * as schema from './schema';

const { Pool } = pg;

const pool = new Pool({
  connectionString: config.database.url,
});

export const db = drizzle(pool, { schema }); 