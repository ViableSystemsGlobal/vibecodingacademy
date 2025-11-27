# Database Setup (PostgreSQL)

This project now targets **PostgreSQL** for all Prisma models and migrations.  
If you previously ran against `dev.db` (SQLite), follow the steps below to wire the app back to your real data.

## 1. Provision Postgres

You can use any Postgres instance (local Docker, managed cloud, etc.).  
Example Docker command:

```bash
docker run --name adpoolsgroup-db \
  -e POSTGRES_DB=adpoolsgroup \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  -d postgres:16
```

## 2. Configure the connection string

Add/update the following in your `.env`:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/adpoolsgroup?schema=public"
```

Adjust username, password, host, or database name to match your environment.  
Make sure the same value is used in any deployment secrets.

## 3. Apply migrations

```bash
npx prisma migrate deploy
```

> If the command fails, verify you can `psql` into the database and that the user has permission to create types/tables.

## 4. Import your existing data

If you have a backup (SQL dump, `.tar`, etc.) restore it **after** the migrations succeed:

```bash
psql "$DATABASE_URL" < your_backup.sql
```

## 5. Restart the dev servers

```bash
npm run dev:admin
npm run dev:shop
```

Both admin (`3001`) and shop (`3000`) should now connect to Postgres without the schema mismatch errors that happened with SQLite.

## Troubleshooting

- `P2021` / `P2022` errors → migrations didn’t run against this database. Re-run step 3.
- Auth/login failing → ensure the restored data contains the admin user or create a new one with a hashed password.
- Want to retire the old `dev.db` files → you can safely delete or archive them once Postgres is confirmed working.


