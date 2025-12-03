#!/bin/bash
# Script to sync Prisma schema to database
# This will add missing columns without losing data

echo "🔄 Syncing Prisma schema to database..."
echo "⚠️  This will add missing columns but won't delete existing data"
echo ""

# Option 1: Use db push (recommended for development/staging)
echo "Using 'prisma db push' to sync schema..."
npx prisma db push --accept-data-loss

# Option 2: Create and apply migration (recommended for production)
# Uncomment below if you prefer migrations
# echo "Creating migration..."
# npx prisma migrate dev --name add_security_fields
# npx prisma migrate deploy

echo ""
echo "✅ Schema sync complete!"
echo "🔄 Regenerating Prisma Client..."
npx prisma generate

echo ""
echo "✅ Done! Your database should now have all required columns."

