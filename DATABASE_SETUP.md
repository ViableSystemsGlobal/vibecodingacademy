# PostgreSQL Database Setup Guide

## Quick Answer: **It Depends on Your Setup**

### ✅ **For Development (Local Testing)**
**You DON'T need to create it manually** - Docker Compose will create it automatically!

### ⚠️ **For Production**
You have **3 options** - choose based on your deployment strategy.

---

## Option 1: Docker Compose (Easiest - Recommended for Development)

### ✅ Automatic Setup
Your `docker-compose.yml` already includes PostgreSQL. Just run:

```bash
docker-compose up -d
```

This will:
- ✅ Automatically create PostgreSQL container
- ✅ Create database `vibe_coding_academy`
- ✅ Create user `vibe_user`
- ✅ Set up everything automatically

**No manual database creation needed!**

### Run Migrations
After containers start:

```bash
# Wait a few seconds for database to be ready
docker-compose exec backend npx prisma migrate deploy
```

**That's it!** Your database is ready.

---

## Option 2: Managed PostgreSQL Service (Recommended for Production)

### Best Options:
1. **DigitalOcean Managed Databases** - Easy, affordable
2. **AWS RDS** - Enterprise-grade
3. **Google Cloud SQL** - Good for GCP users
4. **Supabase** - Free tier available
5. **Railway** - Simple setup
6. **Render** - Good free tier

### Setup Steps:

#### Step 1: Create Database Instance
1. Sign up for your chosen provider
2. Create a PostgreSQL 15+ database
3. Note the connection details:
   - Host
   - Port (usually 5432)
   - Database name
   - Username
   - Password

#### Step 2: Update Environment Variables
In your `.env` file:

```env
DATABASE_URL=postgresql://username:password@host:5432/vibe_coding_academy?schema=public
```

#### Step 3: Run Migrations
```bash
npx prisma migrate deploy
```

**Benefits:**
- ✅ Automatic backups
- ✅ High availability
- ✅ Easy scaling
- ✅ Security managed by provider

---

## Option 3: Manual PostgreSQL Installation

### When to Use:
- You have a VPS/server
- You want full control
- You're comfortable with server management

### Setup Steps:

#### Step 1: Install PostgreSQL
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# macOS (using Homebrew)
brew install postgresql@15
brew services start postgresql@15
```

#### Step 2: Create Database and User
```bash
# Switch to postgres user
sudo -u postgres psql

# In PostgreSQL prompt:
CREATE DATABASE vibe_coding_academy;
CREATE USER vibe_user WITH PASSWORD 'your_strong_password';
GRANT ALL PRIVILEGES ON DATABASE vibe_coding_academy TO vibe_user;

# For PostgreSQL 15+, also grant schema privileges:
\c vibe_coding_academy
GRANT ALL ON SCHEMA public TO vibe_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO vibe_user;

# Exit
\q
```

#### Step 3: Update Environment Variables
```env
DATABASE_URL=postgresql://vibe_user:your_strong_password@localhost:5432/vibe_coding_academy?schema=public
```

#### Step 4: Run Migrations
```bash
cd backend
npx prisma migrate deploy
```

---

## 🎯 Recommended Setup by Scenario

### Scenario 1: Local Development
**Use:** Docker Compose (Option 1)
- ✅ Zero configuration
- ✅ Automatic setup
- ✅ Easy to reset

### Scenario 2: Production on VPS (Hostinger, etc.)
**Use:** Docker Compose OR Managed Service
- **Docker Compose:** If you want everything in one place
- **Managed Service:** If you want automatic backups and less maintenance

### Scenario 3: Production on Cloud (AWS, GCP, Azure)
**Use:** Managed Service (Option 2)
- ✅ Best practices
- ✅ Automatic backups
- ✅ High availability

### Scenario 4: Testing/Staging
**Use:** Docker Compose
- ✅ Quick setup
- ✅ Easy to reset
- ✅ Matches production structure

---

## 🔧 Quick Setup Commands

### Using Docker Compose (Recommended)
```bash
# Start everything (creates database automatically)
docker-compose up -d

# Run migrations
docker-compose exec backend npx prisma migrate deploy

# Seed database (optional)
docker-compose exec backend npx prisma db seed

# Check database status
docker-compose ps

# View database logs
docker-compose logs postgres
```

### Using Managed Service
```bash
# 1. Get connection string from provider
# 2. Update .env with DATABASE_URL
# 3. Run migrations
cd backend
npx prisma migrate deploy
```

### Using Manual Installation
```bash
# 1. Install PostgreSQL (see above)
# 2. Create database and user (see above)
# 3. Update .env with DATABASE_URL
# 4. Run migrations
cd backend
npx prisma migrate deploy
```

---

## 📊 Database Requirements

### Minimum Requirements:
- **PostgreSQL Version:** 15+ (recommended)
- **Storage:** 1GB minimum (grows with data)
- **RAM:** 512MB minimum
- **Connections:** 20+ concurrent connections

### Recommended for Production:
- **PostgreSQL Version:** 15 or 16
- **Storage:** 10GB+ (with backups)
- **RAM:** 2GB+
- **Connections:** 100+ concurrent connections
- **Backups:** Daily automated backups

---

## 🔍 Verify Database Setup

### Check Connection
```bash
# Using Docker Compose
docker-compose exec postgres psql -U vibe_user -d vibe_coding_academy -c "SELECT version();"

# Using direct connection
psql -h localhost -U vibe_user -d vibe_coding_academy -c "SELECT version();"
```

### Check Tables
```bash
# List all tables
docker-compose exec postgres psql -U vibe_user -d vibe_coding_academy -c "\dt"

# Count records in a table
docker-compose exec postgres psql -U vibe_user -d vibe_coding_academy -c "SELECT COUNT(*) FROM users;"
```

### Using Prisma Studio (Visual Database Browser)
```bash
# With Docker Compose
docker-compose exec backend npx prisma studio

# Without Docker
cd backend
npx prisma studio
```

---

## 🚨 Common Issues & Solutions

### Issue: "Database does not exist"
**Solution:** Database wasn't created. Run:
```bash
# Docker Compose
docker-compose up -d postgres
# Wait 10 seconds, then run migrations

# Manual
createdb vibe_coding_academy
```

### Issue: "Connection refused"
**Solution:** 
- Check PostgreSQL is running: `docker-compose ps` or `pg_isready`
- Verify DATABASE_URL in .env
- Check firewall/port access

### Issue: "Permission denied"
**Solution:**
```sql
GRANT ALL PRIVILEGES ON DATABASE vibe_coding_academy TO vibe_user;
GRANT ALL ON SCHEMA public TO vibe_user;
```

### Issue: "Migration failed"
**Solution:**
```bash
# Reset migrations (CAUTION: Deletes data)
npx prisma migrate reset

# Or deploy migrations
npx prisma migrate deploy
```

---

## 📝 Environment Variable Format

### Docker Compose (Internal)
```env
DATABASE_URL=postgresql://vibe_user:vibe_password@postgres:5432/vibe_coding_academy?schema=public
```

### External Database
```env
DATABASE_URL=postgresql://username:password@host:5432/database_name?schema=public
```

### With SSL (Production)
```env
DATABASE_URL=postgresql://username:password@host:5432/database_name?schema=public&sslmode=require
```

---

## 🎯 My Recommendation

### For You Right Now:
**Use Docker Compose** - It's the easiest and already configured!

```bash
# Just run this:
docker-compose up -d

# Then run migrations:
docker-compose exec backend npx prisma migrate deploy
```

**That's it!** No manual database creation needed.

### For Production Later:
Consider a **managed PostgreSQL service** for:
- Automatic backups
- Better security
- Easier scaling
- Less maintenance

---

## ✅ Quick Checklist

- [ ] Choose setup method (Docker Compose recommended)
- [ ] Start services: `docker-compose up -d`
- [ ] Wait for database to be ready (10-15 seconds)
- [ ] Run migrations: `docker-compose exec backend npx prisma migrate deploy`
- [ ] Verify connection: Check backend logs
- [ ] Test: Try logging in to admin panel

---

**TL;DR:** For development, just run `docker-compose up -d` - it creates everything automatically! 🚀

