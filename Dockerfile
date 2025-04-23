FROM node:18

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Migrate database
RUN npm run migrate

# Expose port
EXPOSE 3000

# Start the application (this will be overridden by render.yaml's dockerCommand)
CMD ["npm", "start"]