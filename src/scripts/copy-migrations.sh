#!/bin/bash
# Exit on error
set -e

echo "Copying migration files..."

# Create directories if they don't exist
mkdir -p /app/drizzle/migrations/meta

# Copy migration files
cp -r /app/drizzle/migrations/* /app/drizzle/migrations/

echo "Migration files copied successfully!" 