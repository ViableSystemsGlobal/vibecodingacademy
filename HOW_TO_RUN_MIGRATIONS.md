# How to Run Database Migrations in EasyPanel

## Quick Answer

**In EasyPanel, you have 3 ways to run migrations:**

### Option 1: Automatic (Recommended) ✅
The backend `start.sh` script **automatically runs migrations** when the container starts. Just deploy the backend and migrations will run automatically!

### Option 2: Using EasyPanel Terminal (Manual)
Open the terminal in EasyPanel and run the commands manually.

### Option 3: Using SSH (If you have SSH access)
SSH into your server and run commands directly.

---

## Option 1: Automatic Migration (Easiest)

The backend Dockerfile includes a `start.sh` script that automatically runs migrations on startup. **You don't need to do anything** - migrations run automatically when you deploy!

**How it works:**
1. When backend container starts, `start.sh` runs
2. It checks for migrations in `prisma/migrations/`
3. Runs `prisma migrate deploy` automatically
4. Generates Prisma client
5. Starts the server

**To use this:**
- Just deploy the backend service in EasyPanel
- Migrations will run automatically on first startup
- Check the logs to see migration output

---

## Option 2: Manual Migration via EasyPanel Terminal

If you need to run migrations manually (or re-run them):

### Step 1: Open Terminal in EasyPanel

1. Go to your **backend service** in EasyPanel
2. Click the **Terminal** icon (or "Console" button)
3. A terminal window will open

### Step 2: Run Migration Commands

In the terminal, run these commands:

```bash
# Step 1: Generate Prisma Client
npx prisma generate

# Step 2: Run migrations (for production)
npx prisma migrate deploy

# Optional: If migrate deploy fails, use db push (for new databases)
# npx prisma db push --accept-data-loss
```

### Step 3: Verify Migrations Ran

Check if migrations were successful:

```bash
# Check migration status
npx prisma migrate status

# Or verify database connection
npx prisma db pull
```

---

## Option 3: Using SSH (If Available)

If you have SSH access to your EasyPanel server:

### Step 1: SSH into Server

```bash
ssh user@your-server-ip
```

### Step 2: Navigate to Backend Container

```bash
# List running containers
docker ps

# Find your backend container name (e.g., "viable_vibecoding_backend")
# Enter the container
docker exec -it viable_vibecoding_backend sh
```

### Step 3: Run Migrations

```bash
# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate deploy
```

---

## Migration Commands Explained

### `npx prisma generate`
- **What it does**: Generates the Prisma Client based on your schema
- **When to use**: After schema changes, or if Prisma Client is missing
- **Safe to run**: Yes, anytime

### `npx prisma migrate deploy`
- **What it does**: Applies pending migrations to the database (production-safe)
- **When to use**: In production, after deploying new code with migrations
- **Safe to run**: Yes, it only applies new migrations

### `npx prisma migrate dev`
- **What it does**: Creates new migrations and applies them (development only)
- **When to use**: Only in development, when creating new migrations
- **Safe to run**: No, don't use in production

### `npx prisma db push`
- **What it does**: Pushes schema changes directly without migrations
- **When to use**: For quick prototyping, or if migrations fail
- **Safe to run**: Use with caution - can cause data loss

---

## Troubleshooting

### Error: "Migration engine failed to connect"

**Cause**: Database is not accessible or DATABASE_URL is wrong

**Fix**:
1. Check `DATABASE_URL` environment variable in EasyPanel
2. Verify PostgreSQL service is running
3. Test connection: `npx prisma db pull`

### Error: "Migration X is already applied"

**Cause**: Migration was already run

**Fix**: This is normal - migrations are idempotent. You can ignore this.

### Error: "No migrations found"

**Cause**: Migrations directory is empty or not copied to container

**Fix**:
1. Check if `prisma/migrations/` exists in your repository
2. Verify Dockerfile copies the prisma directory
3. Use `npx prisma db push` as fallback

### Error: "Schema and database are out of sync"

**Cause**: Database structure doesn't match schema

**Fix**:
```bash
# Option 1: Reset and migrate (WARNING: Deletes all data!)
npx prisma migrate reset

# Option 2: Push schema directly (safer)
npx prisma db push --accept-data-loss
```

---

## Step-by-Step: First Time Setup

### 1. Deploy Backend Service

In EasyPanel:
- Create new app/service
- Use `backend/Dockerfile`
- Set environment variables (especially `DATABASE_URL`)
- Deploy

### 2. Check Logs

After deployment, check the logs:
- Look for "Running database migrations..."
- Look for "Database setup complete"
- If you see errors, proceed to manual migration

### 3. Manual Migration (If Needed)

If automatic migration didn't work:

```bash
# In EasyPanel Terminal
npx prisma generate
npx prisma migrate deploy
```

### 4. Verify

Test the API:
```bash
curl https://api.vibecoding.africa/public/landing
```

---

## Common Migration Scenarios

### Scenario 1: Fresh Database (First Time)

```bash
# Generate client
npx prisma generate

# Deploy all migrations
npx prisma migrate deploy

# Or if no migrations exist yet:
npx prisma db push
```

### Scenario 2: Existing Database (Update)

```bash
# Just deploy new migrations
npx prisma migrate deploy
```

### Scenario 3: Migration Failed

```bash
# Check status
npx prisma migrate status

# If stuck, resolve manually:
npx prisma migrate resolve --applied <migration-name>

# Then continue
npx prisma migrate deploy
```

### Scenario 4: Reset Everything (Development Only!)

```bash
# WARNING: Deletes all data!
npx prisma migrate reset

# Then deploy fresh
npx prisma migrate deploy
```

---

## Quick Reference

| Command | Use Case | Safe for Production |
|---------|----------|---------------------|
| `npx prisma generate` | Generate Prisma Client | ✅ Yes |
| `npx prisma migrate deploy` | Apply migrations | ✅ Yes |
| `npx prisma migrate dev` | Create new migrations | ❌ No (dev only) |
| `npx prisma db push` | Push schema directly | ⚠️ Use with caution |
| `npx prisma migrate status` | Check migration status | ✅ Yes |
| `npx prisma migrate reset` | Reset database | ❌ No (deletes data) |

---

## For Your Current Situation

Since you're deploying for the first time:

1. **Deploy the backend** in EasyPanel (migrations will run automatically)
2. **Check the logs** to see if migrations succeeded
3. **If migrations failed**, use EasyPanel Terminal:
   ```bash
   npx prisma generate
   npx prisma migrate deploy
   ```
4. **Verify** by testing the API endpoint

That's it! 🎉
