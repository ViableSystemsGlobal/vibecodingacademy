#!/bin/bash

# Production Deployment Script
# Usage: ./scripts/deploy.sh

set -e

echo "🚀 Starting production deployment..."

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found!"
    echo "Please create .env file from .env.production.example"
    exit 1
fi

# Load environment variables
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Check critical environment variables
if [ -z "$JWT_SECRET" ] || [ -z "$JWT_REFRESH_SECRET" ]; then
    echo "❌ Error: JWT secrets not set in .env file"
    exit 1
fi

if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL not set in .env file"
    exit 1
fi

echo "✅ Environment variables validated"

# Build Docker images
echo "📦 Building Docker images..."
docker-compose -f docker-compose.prod.yml build

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose -f docker-compose.prod.yml down

# Start services
echo "▶️  Starting services..."
docker-compose -f docker-compose.prod.yml up -d

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 10

# Run database migrations
echo "🔄 Running database migrations..."
docker-compose -f docker-compose.prod.yml exec -T backend npx prisma migrate deploy || \
docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy

# Generate Prisma client
echo "🔧 Generating Prisma client..."
docker-compose -f docker-compose.prod.yml exec backend npx prisma generate

# Check health
echo "🏥 Checking service health..."
sleep 5
curl -f http://localhost:${PORT:-3005}/health || echo "⚠️  Health check failed - services may still be starting"

echo "✅ Deployment completed!"
echo ""
echo "📋 Next steps:"
echo "1. Verify services are running: docker-compose -f docker-compose.prod.yml ps"
echo "2. Check logs: docker-compose -f docker-compose.prod.yml logs -f"
echo "3. Test API: curl http://localhost:${PORT:-3005}/health"
echo "4. Set up automated backups (see scripts/backup-database.sh)"

