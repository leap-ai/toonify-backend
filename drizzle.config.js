// drizzle.config.js
import dotenv from "dotenv";
dotenv.config();
// Load .env file vars into process.env
import { defineConfig } from "drizzle-kit";

// Ensure the DATABASE_URL is set
if (!process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL environment variable is not set");
}

export default defineConfig({
	dialect: "postgresql",
	schema: "./src/db/schema.ts",

	dbCredentials: {
		url: process.env.DATABASE_URL,
	},
});
