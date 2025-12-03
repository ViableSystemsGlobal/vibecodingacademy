# Migration Guide

## Current Setup
- **Local Development**: SQLite (`prisma/dev.db`)
- **Production**: PostgreSQL (based on migration_lock.toml)
- **Schema**: `prisma/schema.prisma`

## How to Run Migrations

### For Local Development (SQLite)

1. **Create a new migration:**
   ```bash
   npx prisma migrate dev --name your_migration_name
   ```
   This creates a migration file and applies it to your local SQLite database.

2. **Apply pending migrations:**
   ```bash
   npx prisma migrate deploy
   ```

3. **Generate Prisma Client after schema changes:**
   ```bash
   npx prisma generate
   ```

### For Production (PostgreSQL)

1. **Apply migrations to production:**
   ```bash
   DATABASE_URL="your_production_postgres_url" npx prisma migrate deploy
   ```

2. **Or use Prisma Migrate:**
   ```bash
   DATABASE_URL="your_production_postgres_url" npx prisma migrate dev --name your_migration_name
   ```

## Fixing the Provider Mismatch

Your `migration_lock.toml` says PostgreSQL but your schema says SQLite. To fix:

### Option A: Keep SQLite for local, PostgreSQL for production

1. Update `migration_lock.toml` to match your local setup:
   ```bash
   # Delete the lock file and let Prisma recreate it
   rm prisma/migrations/migration_lock.toml
   npx prisma migrate dev --name init
   ```

2. For production, use a separate migration process or manually apply SQL.

### Option B: Use PostgreSQL for both

1. Update `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

2. Update your `.env` file with PostgreSQL connection string.

3. Run migrations:
   ```bash
   npx prisma migrate dev --name init
   ```

## Manual SQL Migrations

If you need to run manual SQL (like the `add_customer_account_id.sql` file):

### For SQLite:
```bash
sqlite3 prisma/dev.db < migrations/add_customer_account_id.sql
```

### For PostgreSQL:
```bash
psql $DATABASE_URL -f migrations/add_customer_account_id.sql
```

## Common Commands

```bash
# View migration status
npx prisma migrate status

# Create migration without applying
npx prisma migrate dev --create-only --name your_migration_name

# Reset database (⚠️ deletes all data)
npx prisma migrate reset

# Generate Prisma Client
npx prisma generate

# View database in Prisma Studio
npx prisma studio
```

## Best Practices

1. **Always generate Prisma Client after schema changes:**
   ```bash
   npx prisma generate
   ```

2. **Test migrations locally before production:**
   - Use `prisma migrate dev` locally
   - Test thoroughly
   - Then use `prisma migrate deploy` in production

3. **Never edit migration files after they've been applied to production**

4. **Use descriptive migration names:**
   ```bash
   npx prisma migrate dev --name add_customer_account_linking
   ```

## Troubleshooting

### "Provider mismatch" error
- Check `prisma/schema.prisma` datasource provider
- Check `prisma/migrations/migration_lock.toml`
- They should match

### "Migration already applied" error
- Check `_prisma_migrations` table in your database
- If migration is already there, you may need to mark it as applied manually

### "Database is not empty" error
- Use `--skip-seed` flag or `--force-reset` if in development
- In production, ensure migrations are applied in order

