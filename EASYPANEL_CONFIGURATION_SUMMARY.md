# EasyPanel Deployment Configuration Summary

## 📋 Project Overview

This is a **Next.js monorepo application** that serves two different interfaces:
- **E-commerce Shop**: `thepoolshop.africa` (port 3000)
- **Admin Dashboard**: `sms.thepoolshop.africa` (port 3001/3003)

The application uses **domain-based routing** via Next.js middleware to automatically route users to the correct interface.

---

## 🏗️ Architecture

### Application Type
- **Framework**: Next.js 15.5.3 (App Router)
- **Database**: PostgreSQL (production) / SQLite (local dev)
- **ORM**: Prisma
- **Authentication**: NextAuth.js
- **Deployment**: EasyPanel (Docker-based)

### Key Features
- Single codebase, dual interfaces (shop + admin)
- Domain-based routing (no separate deployments needed)
- PostgreSQL database with Prisma migrations
- File uploads support (`/uploads` directory)
- Payment gateway integration (Paystack)

---

## 🚀 EasyPanel Deployment Configuration

### 1. **Database Setup**

The project uses **PostgreSQL** for production:

```prisma
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

**In EasyPanel:**
1. Create a PostgreSQL service (or use external managed database)
2. Note the connection details:
   - Host: Usually the service name (e.g., `adpools-db`)
   - Port: `5432`
   - Database name: Your choice (e.g., `adpoolsgroup`)
   - Username: Your choice
   - Password: Generate a strong password

**Connection String Format:**
```
postgresql://username:password@host:5432/database_name?schema=public
```

---

### 2. **Application Deployment**

Since this is a **Next.js monorepo** (not separate backend/frontend), you'll deploy it as a **single application** in EasyPanel:

#### Option A: Using Node.js Buildpack (Recommended)

1. **Create New App in EasyPanel**
   - Click **"+ New"** or **"Add Service"**
   - Select **"App"** or **"Node.js"**

2. **Configure Repository**
   - **Source**: `GitHub` (or your Git provider)
   - **Repository**: Your repository URL
   - **Branch**: `main` (or your production branch)
   - **Build Pack**: `Node.js` or `Nixpacks`
   - **Root Directory**: `/` (root of repository)

3. **Build Configuration**
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
   - **Node Version**: Check `package.json` for required version (likely Node 18+)

#### Option B: Using Dockerfile (If Available)

If you create a Dockerfile, EasyPanel can use it:

1. **Create Dockerfile** (if not exists):
   ```dockerfile
   FROM node:18-alpine AS builder
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci
   COPY . .
   RUN npm run build
   
   FROM node:18-alpine
   WORKDIR /app
   ENV NODE_ENV=production
   COPY package*.json ./
   RUN npm ci --only=production
   COPY --from=builder /app/.next ./.next
   COPY --from=builder /app/public ./public
   COPY --from=builder /app/prisma ./prisma
   COPY --from=builder /app/next.config.js ./
   EXPOSE 3000
   CMD ["npm", "start"]
   ```

2. **In EasyPanel**:
   - Select **"Dockerfile"** as build method
   - Dockerfile path: `Dockerfile` (root)

---

### 3. **Environment Variables**

Add these in EasyPanel's environment variables section:

```bash
# ============================================
# Database (CRITICAL)
# ============================================
DATABASE_URL=postgresql://username:password@host:5432/database_name?schema=public

# ============================================
# NextAuth Authentication (CRITICAL)
# ============================================
NEXTAUTH_URL=https://sms.thepoolshop.africa
NEXTAUTH_SECRET=your-generated-secret-here
# Generate with: openssl rand -base64 32

# ============================================
# Domain Configuration
# ============================================
ECOMMERCE_DOMAIN=thepoolshop.africa
ADMIN_DOMAIN=sms.thepoolshop.africa
NEXT_PUBLIC_APP_URL=https://thepoolshop.africa

# ============================================
# Server Configuration
# ============================================
NODE_ENV=production
PORT=3000

# ============================================
# Paystack Payment Gateway (Optional)
# ============================================
PAYSTACK_SECRET_KEY=sk_live_your-secret-key
PAYSTACK_PUBLIC_KEY=pk_live_your-public-key

# ============================================
# SMTP Email (Optional)
# ============================================
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@yourdomain.com
SMTP_PASS=your-smtp-password
SMTP_FROM=your-email@yourdomain.com

# ============================================
# SMS Configuration (Optional)
# ============================================
# These are stored in database SystemSettings table
# Configure via admin panel after deployment
```

---

### 4. **Port Configuration**

**In EasyPanel:**
- **Internal Port**: `3000` (Next.js default)
- **External Port**: `3000` (or let EasyPanel assign)
- **Domains**: 
  - `thepoolshop.africa` → Routes to shop
  - `sms.thepoolshop.africa` → Routes to admin

**Note**: The middleware automatically routes based on domain, so you only need **one application** running on port 3000.

---

### 5. **Volumes (For File Uploads)**

**In EasyPanel**, add a volume for uploaded files:

- **Source**: `/app/uploads` (or `/app/public/uploads`)
- **Destination**: `/app/uploads`
- **Purpose**: Stores uploaded product images, logos, documents, etc.

---

### 6. **Domain & SSL Configuration**

1. **Add Domains in EasyPanel**
   - Go to your application → **Domains**
   - Add: `thepoolshop.africa`
   - Add: `sms.thepoolshop.africa`

2. **SSL Certificates**
   - EasyPanel usually handles SSL automatically with Let's Encrypt
   - Enable **"SSL"** or **"HTTPS"** in domain settings
   - Wait for certificate to be issued

3. **DNS Configuration**
   - **A Record** for `thepoolshop.africa` → Your EasyPanel server IP
   - **A Record** for `sms.thepoolshop.africa` → Your EasyPanel server IP
   - **CNAME** for `www.thepoolshop.africa` → `thepoolshop.africa` (optional)

---

## 📝 Post-Deployment Steps

### Step 1: Run Database Migrations

After the app is deployed, open EasyPanel terminal and run:

```bash
# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Seed database with admin user and initial data
npx tsx scripts/deploy-seed.ts
```

**Default Admin Credentials** (change immediately after first login):
- Email: `admin@thepoolshop.africa`
- Password: `admin123`

### Step 2: Verify Deployment

1. **Test E-commerce**: Visit `https://thepoolshop.africa`
   - Should show shop homepage
   - Test product browsing, cart, checkout

2. **Test Admin**: Visit `https://sms.thepoolshop.africa`
   - Should redirect to login
   - Login with admin credentials
   - Verify dashboard loads

3. **Test Payment Webhook** (if using Paystack):
   - Configure webhook in Paystack dashboard
   - URL: `https://thepoolshop.africa/api/public/shop/payment/webhook`
   - Events: `charge.success`, `charge.failed`

---

## 🔧 How Domain Routing Works

The application uses **Next.js middleware** (`src/middleware.ts`) to route requests:

```typescript
// Admin domain/port (sms.thepoolshop.africa or port 3001)
if (isAdminDomain || isAdminPort) {
  // Blocks /shop routes, allows /dashboard routes
}

// Shop domain/port (thepoolshop.africa or port 3000)
if (isShopPort || (!isAdminDomain && !isAdminPort)) {
  // Blocks admin routes, allows /shop routes
}
```

**Key Points:**
- Single application handles both domains
- No need for separate deployments
- Middleware automatically routes based on domain name
- Port-based routing also supported for development

---

## 📦 Build Configuration

The project uses separate build directories to prevent conflicts:

```json
// package.json
{
  "scripts": {
    "build": "prisma generate && next build",
    "build:shop": "prisma generate && NEXT_PUBLIC_APP_MODE=shop next build",
    "build:admin": "prisma generate && NEXT_PUBLIC_APP_MODE=admin next build",
    "start": "next start"
  }
}
```

**For EasyPanel**: Use `npm run build` (standard build) - the middleware handles routing.

---

## 🗄️ Database Migrations

**Migration Lock File**: `prisma/migrations/migration_lock.toml`
```toml
provider = "postgresql"
```

**Important**: The project is configured for PostgreSQL in production. Make sure:
1. `DATABASE_URL` points to PostgreSQL (not SQLite)
2. `prisma/schema.prisma` has `provider = "postgresql"`
3. Run `npx prisma migrate deploy` after deployment

---

## 🔐 Security Checklist

Before going live:
- [ ] Changed admin password from `admin123`
- [ ] Updated `NEXTAUTH_SECRET` to a secure random value
- [ ] Verified `NEXTAUTH_URL` matches your domain exactly (no trailing slash)
- [ ] SSL certificates active on both domains
- [ ] Paystack webhook configured (if using payments)
- [ ] Database backups enabled in EasyPanel
- [ ] Environment variables are secure (not exposed in logs)

---

## 🐛 Common Issues & Solutions

### Issue: "401 Unauthorized" on login
**Solution:**
1. Verify `NEXTAUTH_URL=https://sms.thepoolshop.africa` (no trailing slash)
2. Verify `NEXTAUTH_SECRET` matches the one used during build
3. Run seed script: `npx tsx scripts/deploy-seed.ts`
4. Restart the application in EasyPanel

### Issue: Database connection error
**Solution:**
1. Check `DATABASE_URL` format: `postgresql://user:pass@host:port/db`
2. Ensure PostgreSQL service is running in EasyPanel
3. Test connection: `npx prisma db push`

### Issue: Domain not routing correctly
**Solution:**
1. Check middleware is enabled in `next.config.js`
2. Verify environment variables (`ECOMMERCE_DOMAIN`, `ADMIN_DOMAIN`)
3. Check DNS records are propagated (can take up to 48 hours)
4. Clear browser cache and cookies

### Issue: Build fails
**Solution:**
1. Ensure Node.js version matches (check `package.json`)
2. Clear build cache: `rm -rf .next .next-shop .next-admin`
3. Reinstall dependencies: `npm ci`
4. Check for TypeScript errors: `npm run lint`

---

## 📚 Additional Resources

- **EasyPanel Deployment Guide**: `docs/easypanel-deployment.md`
- **Production Setup Guide**: `docs/PRODUCTION-SETUP.md`
- **Database Setup**: `docs/database-setup.md`
- **Environment Template**: `docs/environment-template.md`

---

## ✅ Summary

**What Makes This EasyPanel-Ready:**

1. ✅ **Single Application**: One Next.js app handles both shop and admin
2. ✅ **Domain Routing**: Middleware automatically routes based on domain
3. ✅ **PostgreSQL Ready**: Configured for PostgreSQL in production
4. ✅ **Environment Variables**: Well-documented environment variable requirements
5. ✅ **Migration Scripts**: Includes database seeding and migration scripts
6. ✅ **File Uploads**: Volume configuration for persistent file storage
7. ✅ **SSL Support**: Works with EasyPanel's automatic SSL certificates

**Deployment Steps Summary:**
1. Create PostgreSQL database in EasyPanel
2. Deploy Next.js application (single app)
3. Configure environment variables
4. Add domains (`thepoolshop.africa` and `sms.thepoolshop.africa`)
5. Run database migrations and seed
6. Test both domains

---

**Last Updated**: January 2025
