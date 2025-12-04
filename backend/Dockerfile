FROM node:18-slim AS builder

WORKDIR /app

# Install build dependencies for Prisma
RUN apt-get update && apt-get install -y \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Copy package files (from backend directory if build context is root)
COPY backend/package*.json ./
COPY backend/tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code (from backend directory)
COPY backend/ .

# Verify migrations are copied (for debugging)
RUN echo "Checking prisma directory structure:" && \
    ls -la prisma/ && \
    echo "Checking migrations:" && \
    (ls -la prisma/migrations/ 2>/dev/null || echo "Migrations directory not found") && \
    echo "Prisma files:" && \
    ls -la prisma/*.prisma prisma/*.toml 2>/dev/null || echo "No prisma files found"

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-slim

WORKDIR /app

# Install runtime dependencies for Prisma (OpenSSL is included in Debian)
RUN apt-get update && apt-get install -y \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY backend/package*.json ./
COPY backend/tsconfig.json ./

# Install Prisma CLI globally first (needed for postinstall if any)
RUN npm install -g prisma@^5.7.1

# Install production dependencies only
RUN npm ci --only=production

# Copy built files and Prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
# Copy entire prisma directory including migrations
# Use wildcard to handle optional files gracefully
COPY --from=builder /app/prisma ./prisma

# Copy startup script
COPY backend/start.sh ./start.sh
RUN chmod +x ./start.sh

# Create uploads directory
RUN mkdir -p uploads

# Expose port
EXPOSE 3005

# Start server (runs migrations first)
CMD ["./start.sh"]

