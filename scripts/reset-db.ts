import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import { config } from '../src/config';
import * as schema from '../src/db/schema';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

async function main() {
  console.log('Resetting database...');

  // Create a new connection pool
  const pool = new Pool({
    connectionString: config.database.url,
  });

  try {
    // Drop all existing tables
    await pool.query(`
      DROP TABLE IF EXISTS payments CASCADE;
      DROP TABLE IF EXISTS cartoon_generations CASCADE;
      DROP TABLE IF EXISTS credits_transactions CASCADE;
      DROP TABLE IF EXISTS verification CASCADE;
      DROP TABLE IF EXISTS account CASCADE;
      DROP TABLE IF EXISTS session CASCADE;
      DROP TABLE IF EXISTS "user" CASCADE;
    `);

    console.log('Dropped all existing tables');

    // Create drizzle instance
    const db = drizzle(pool, { schema });

    // Run migrations
    await migrate(db, { migrationsFolder: './drizzle/migrations' });
    console.log('Applied migrations successfully');

    console.log('Database reset complete!');
  } catch (error) {
    console.error('Error resetting database:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main(); 