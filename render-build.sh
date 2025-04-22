#!/bin/bash
# Exit on error
set -e

echo "Installing dependencies..."
npm install

echo "Building TypeScript..."
npm run build

echo "Running database migrations..."
npm run migrate:prod

echo "Build completed successfully!" 