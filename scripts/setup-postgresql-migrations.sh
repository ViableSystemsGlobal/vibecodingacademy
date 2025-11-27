#!/bin/bash
# Setup PostgreSQL migrations for production

echo "Setting up PostgreSQL migrations..."

# Ensure migrations directory exists
mkdir -p prisma/migrations

# Set migration lock to PostgreSQL
echo 'provider = "postgresql"' > prisma/migrations/migration_lock.toml

echo "✅ Migration lock updated to PostgreSQL"
echo ""
echo "Next steps:"
echo "1. In production, run: npx prisma migrate deploy"
echo "   OR"
echo "2. If database is empty, run: npx prisma migrate dev --name init_postgresql"
echo "   OR"
echo "3. To sync schema without migrations: npx prisma db push"

