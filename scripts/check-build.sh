#!/bin/bash
# Exit on error
set -e

echo "Checking build output..."

# Check dist directory
echo "Contents of /app/dist:"
ls -la /app/dist

# Check if src directory exists
if [ -d "/app/dist/src" ]; then
  echo "Contents of /app/dist/src:"
  ls -la /app/dist/src
else
  echo "dist/src directory does not exist"
  
  # Check if files are directly in dist
  echo "Checking for files directly in dist:"
  find /app/dist -type f -name "*.js" | sort
fi

echo "Build check completed!" 