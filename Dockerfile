FROM node:18

WORKDIR /app

# Install psql client (needed for temporary reset script)
RUN apt-get update && apt-get install -y postgresql-client && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

RUN npm run generate

# Expose port
EXPOSE 3000

# Start the application (this will be overridden by render.yaml's dockerCommand)
CMD ["npm", "start"]