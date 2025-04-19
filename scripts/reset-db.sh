#!/bin/bash

# Stop any running containers
docker compose down

# Remove the volume to ensure a clean slate
docker volume rm toonify-v1_postgres_data

# Start the services
docker compose up -d db

# Wait for the database to be ready
echo "Waiting for database to be ready..."
sleep 5

# Run the reset script
docker compose exec -T db psql -U postgres -d postgres -f /reset.sql

# Run migrations
docker compose exec -T api npm run db:migrate

echo "Database reset complete!" 