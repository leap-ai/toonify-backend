-- Connect to the toonify database
\c toonify;

-- Drop tables in reverse order of dependency or use CASCADE

DROP TABLE IF EXISTS "session" CASCADE;
DROP TABLE IF EXISTS "account" CASCADE;
DROP TABLE IF EXISTS "generations" CASCADE;
DROP TABLE IF EXISTS "payments" CASCADE;
DROP TABLE IF EXISTS "verification" CASCADE;
DROP TABLE IF EXISTS "user" CASCADE;

-- Drizzle internal table for migrations
DROP TABLE IF EXISTS "drizzle.__drizzle_migrations" CASCADE;

-- Add any other custom tables you might have created manually
-- Example: DROP TABLE IF EXISTS "custom_table" CASCADE;

-- Optional: Sequences or other objects might need dropping if not handled by CASCADE

-- Note: This script DELETES ALL DATA in these tables.
-- It's intended for development/testing environments.
-- The actual table creation should be handled by Drizzle migrations.

-- Recreate tables based on schema.ts

-- User Table
CREATE TABLE "user" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL UNIQUE,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "credits_balance" INTEGER NOT NULL DEFAULT 0
);

-- Session Table
CREATE TABLE "session" (
    "id" TEXT PRIMARY KEY,
    "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "token" TEXT NOT NULL UNIQUE,
    "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Account Table
CREATE TABLE "account" (
    "id" TEXT PRIMARY KEY,
    "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "account_id" TEXT NOT NULL, -- Specific ID from the provider
    "provider_id" TEXT NOT NULL, -- e.g., 'google', 'apple'
    "access_token" TEXT,
    "refresh_token" TEXT,
    "access_token_expires_at" TIMESTAMP WITH TIME ZONE,
    "refresh_token_expires_at" TIMESTAMP WITH TIME ZONE,
    "scope" TEXT,
    "id_token" TEXT,
    "password" TEXT, -- Typically hashed password for email/password provider
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Verification Table (e.g., for email verification tokens)
CREATE TABLE "verification" (
    "id" TEXT PRIMARY KEY,
    "identifier" TEXT NOT NULL, -- e.g., email address
    "value" TEXT NOT NULL, -- e.g., the verification token
    "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Generations Table
CREATE TABLE "generations" (
    "id" TEXT PRIMARY KEY,
    "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "original_image_url" TEXT NOT NULL,
    "cartoon_image_url" TEXT NOT NULL,
    "status" TEXT NOT NULL, -- e.g., 'pending', 'completed', 'failed'
    "credits_used" INTEGER NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Payments Table
CREATE TABLE "payments" (
    "id" TEXT PRIMARY KEY,
    "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "amount" INTEGER NOT NULL, -- Amount in smallest currency unit (e.g., cents) or use NUMERIC/DECIMAL
    "currency" TEXT DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'Success', -- e.g., 'Pending', 'Success', 'Failed'
    "payment_id" TEXT, -- Your internal or a Stripe payment intent ID, etc.
    "transaction_id" TEXT, -- RevenueCat transaction ID (providerTransactionId from webhook)
    "store_transaction_id" TEXT, -- Apple/Google transaction ID
    "product_id" TEXT, -- Identifier of the purchased product
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Optional: Recreate Drizzle migration table if you plan to use migrations later\

-- Print completion message
SELECT 'All specified tables dropped and recreated successfully.'; 