import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const { Pool } = pg;

// Create a PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create a Drizzle instance
const db = drizzle(pool);

// Get the directory name
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Run migrations
async function main() {
  console.log('Running migrations in production...');
  
  try {
    // Run migrations from the migrations folder
    await migrate(db, { migrationsFolder: path.join(__dirname, '../drizzle/migrations') });
    console.log('Migrations completed successfully!');
  } catch (error) {
    console.error('Error running migrations:', error);
    process.exit(1);
  } finally {
    // Close the connection
    await pool.end();
  }
}

main(); 