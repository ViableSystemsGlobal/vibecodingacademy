#!/bin/sh
set -e

echo "Running database migrations..."
prisma migrate deploy || {
  echo "Migration failed, but continuing..."
  # Don't exit - let the server start anyway
}

echo "Starting server..."
exec node dist/server.js

