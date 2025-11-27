# Prisma Migration Fix for PostgreSQL

## Option 1: Use db push (Recommended for production)
This will sync your schema directly to PostgreSQL without migrations:

```bash
npx prisma db push
```

## Option 2: Start fresh migrations (For proper migration history)
If you want to use migrations going forward:

1. Backup the old migrations (optional):
```bash
mv prisma/migrations prisma/migrations_sqlite_backup
```

2. Update migration lock:
```bash
echo 'provider = "postgresql"' > prisma/migrations/migration_lock.toml
```

3. Create initial migration:
```bash
npx prisma migrate dev --name init_postgresql
```

4. Deploy to production:
```bash
npx prisma migrate deploy
```

## Option 3: Baseline existing database
If your PostgreSQL database already has tables:

1. Mark migrations as applied:
```bash
npx prisma migrate resolve --applied 0_init_postgresql
```
