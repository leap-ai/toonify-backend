import pg from 'pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed(): Promise<void> {
  const passwordHash = await bcrypt.hash('password123', 10);
  await pool.query(`
    INSERT INTO users (email, password)
    VALUES ($1, $2)
    ON CONFLICT (email) DO NOTHING
  `, ['demo@example.com', passwordHash]);

  console.log('Seed complete.');
  process.exit();
}

seed(); 