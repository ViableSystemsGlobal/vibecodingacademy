#!/bin/sh
set -e

echo "Checking Prisma setup..."
echo "Current directory: $(pwd)"
echo "Prisma directory exists: $(test -d prisma && echo 'yes' || echo 'no')"
echo "Migrations directory exists: $(test -d prisma/migrations && echo 'yes' || echo 'no')"
if [ -d prisma/migrations ]; then
  echo "Migrations found: $(ls -la prisma/migrations | head -5)"
fi

echo "Running database migrations..."
cd /app && prisma migrate deploy --schema=./prisma/schema.prisma || {
  echo "Migration failed, trying db push as fallback..."
  prisma db push --schema=./prisma/schema.prisma --accept-data-loss || {
    echo "Both migrate deploy and db push failed!"
    echo "Continuing anyway - database may not be set up correctly"
  }
}

echo "Starting server..."
exec node dist/server.js

