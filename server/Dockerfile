# Use Node.js with build tools for native modules
FROM node:20-alpine

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++ sqlite-dev

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Initialize database on build
RUN node src/db/init.js || true
RUN node src/db/seed.js || true

# Expose port
EXPOSE 3001

# Start command
CMD ["npm", "start"]
