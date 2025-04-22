#!/bin/bash
# Exit on error
set -e

echo "Copying migration files..."

# Create directories if they don't exist
mkdir -p /app/src/drizzle/migrations/meta

# Copy migration files
cp -r /app/src/drizzle/migrations/* /app/src/drizzle/migrations/

echo "Migration files copied successfully!" 