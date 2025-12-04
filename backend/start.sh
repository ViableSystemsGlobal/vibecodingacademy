#!/bin/sh
set -e

echo "Checking Prisma setup..."
echo "Current directory: $(pwd)"
echo "Prisma directory exists: $(test -d prisma && echo 'yes' || echo 'no')"
if [ -d prisma/migrations ]; then
  echo "Migrations directory exists: yes"
  echo "Migration files: $(ls prisma/migrations | head -5)"
else
  echo "Migrations directory exists: no"
fi

echo "Running database migrations..."
# Try migrate deploy first (for existing databases with migration history)
if [ -d prisma/migrations ] && [ "$(ls -A prisma/migrations 2>/dev/null | grep -v migration_lock.toml)" ]; then
  echo "Attempting prisma migrate deploy..."
  prisma migrate deploy --schema=./prisma/schema.prisma || {
    echo "migrate deploy failed, trying db push as fallback..."
    prisma db push --schema=./prisma/schema.prisma --accept-data-loss --skip-generate || {
      echo "Both migration methods failed!"
      exit 1
    }
  }
else
  echo "No migrations found, using db push to create schema..."
  prisma db push --schema=./prisma/schema.prisma --accept-data-loss --skip-generate || {
    echo "db push failed!"
    exit 1
  }
fi

echo "Database setup complete. Starting server..."
exec node dist/server.js

