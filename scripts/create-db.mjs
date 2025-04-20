import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

async function createDatabase() {
  // Connect to the default postgres database
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL');

    // Check if the database exists
    const result = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = 'toonify'"
    );

    if (result.rows.length === 0) {
      // Database doesn't exist, create it
      await client.query('CREATE DATABASE toonify');
      console.log('Database "toonify" created successfully');
    } else {
      console.log('Database "toonify" already exists');
    }
  } catch (err) {
    console.error('Error creating database:', err);
    process.exit(1); // Exit with error code
  } finally {
    await client.end();
  }
}

createDatabase(); 