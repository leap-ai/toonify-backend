import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Load environment variables
dotenv.config();

const { Pool } = pg;

// Create a PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create a Drizzle instance
const db = drizzle(pool);

// Run migrations
async function main() {
  console.log('Running migrations in production...');
  
  try {
    // Define migrations folder path
    const migrationsFolder = path.join(__dirname, '../drizzle/migrations');
    console.log(`Migrations folder path: ${migrationsFolder}`);
    
    // Check if migrations folder exists
    if (!fs.existsSync(migrationsFolder)) {
      console.error(`Migrations folder does not exist: ${migrationsFolder}`);
      process.exit(1);
    }
    
    // Check if meta folder exists
    const metaFolder = path.join(migrationsFolder, 'meta');
    if (!fs.existsSync(metaFolder)) {
      console.error(`Meta folder does not exist: ${metaFolder}`);
      process.exit(1);
    }
    
    // Check if _journal.json exists
    const journalFile = path.join(metaFolder, '_journal.json');
    if (!fs.existsSync(journalFile)) {
      console.error(`_journal.json file does not exist: ${journalFile}`);
      process.exit(1);
    }
    
    // List files in migrations folder
    console.log('Files in migrations folder:');
    fs.readdirSync(migrationsFolder).forEach(file => {
      console.log(`- ${file}`);
    });
    
    // List files in meta folder
    console.log('Files in meta folder:');
    fs.readdirSync(metaFolder).forEach(file => {
      console.log(`- ${file}`);
    });
    
    // Run migrations from the migrations folder
    await migrate(db, { migrationsFolder });
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