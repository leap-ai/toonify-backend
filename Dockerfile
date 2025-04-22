FROM node:18

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Ensure migrations folder exists and has the correct structure
RUN mkdir -p /app/drizzle/migrations/meta && \
    if [ -f /app/drizzle/migrations/meta/_journal.json ]; then \
      echo "Migration files exist"; \
    else \
      echo "Creating migration files"; \
      echo '{"version":"5","dialect":"pg","entries":[]}' > /app/drizzle/migrations/meta/_journal.json; \
    fi

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]