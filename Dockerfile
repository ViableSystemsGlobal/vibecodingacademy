# Root-level Dockerfile for EasyPanel
# This builds the FRONTEND service (Next.js)
# For backend API, use backend/Dockerfile

FROM node:18-alpine AS builder

WORKDIR /app

# Accept build-time environment variables
# EasyPanel should pass these automatically, but we declare them explicitly
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Copy package files (from frontend directory)
COPY frontend/package*.json ./
COPY frontend/tsconfig.json ./
COPY frontend/next.config.js ./
COPY frontend/tailwind.config.ts ./
COPY frontend/postcss.config.js ./
COPY frontend/components.json ./

# Install dependencies
RUN npm ci

# Copy source code (from frontend directory)
COPY frontend/ .

# Create public directory if it doesn't exist (Next.js requires it)
RUN mkdir -p public

# Debug: Print the API URL being used (helps troubleshoot)
RUN echo "Building with NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}"

# Build Next.js app
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

ENV NODE_ENV=production

# Copy package files
COPY frontend/package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy built files
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.js ./

# Copy public directory from builder (we ensured it exists in builder stage)
# Create it first in case COPY fails, then copy
RUN mkdir -p ./public
COPY --from=builder /app/public ./public

# Expose port (Next.js default)
EXPOSE 3000

# Start Next.js
CMD ["npm", "start"]
