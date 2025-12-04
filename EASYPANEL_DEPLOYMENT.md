# EasyPanel Deployment Guide
**Complete guide for deploying Vibe Coding Academy on EasyPanel**

EasyPanel is perfect for Docker-based deployments. This guide will walk you through the entire process.

---

## 🎯 Overview

EasyPanel makes Docker deployment easy. You'll deploy:
1. **PostgreSQL Database** (as a service)
2. **Backend API** (Node.js/Express)
3. **Frontend** (Next.js)

---

## 📋 Prerequisites

- EasyPanel account and access to your VPS
- Domain name configured (optional but recommended)
- SSH access to your server

---

## 🚀 Step-by-Step Deployment

### Step 1: Create PostgreSQL Database in EasyPanel

#### Option A: Use EasyPanel's PostgreSQL Service (Recommended)

1. **Login to EasyPanel**
   - Go to your EasyPanel dashboard
   - Navigate to your project/server

2. **Create PostgreSQL Database**
   - Click **"+ New"** or **"Add Service"**
   - Select **"PostgreSQL"**
   - Configure:
     - **Service Name:** `vibecoding-db` (or any name)
     - **PostgreSQL Version:** `15` or `16`
     - **Database Name:** `vibe_coding_academy`
     - **Username:** `vibe_user` (or your choice)
     - **Password:** Generate a strong password (save it!)
     - **Port:** `5432` (default)

3. **Save Connection Details**
   - Note the **Internal Host:** Usually `vibecoding-db` (service name)
   - Note the **Port:** `5432`
   - Note the **Database Name:** `vibe_coding_academy`
   - Note the **Username:** `vibe_user`
   - Note the **Password:** (the one you created)

4. **Connection String Format:**
   ```
   postgresql://vibe_user:your_password@vibecoding-db:5432/vibe_coding_academy?schema=public
   ```

#### Option B: Use External Managed Database

If you prefer a managed service (DigitalOcean, AWS RDS, etc.):
- Get connection string from provider
- Use that in Step 2

---

### Step 2: Deploy Backend API

1. **Create New App in EasyPanel**
   - Click **"+ New"** or **"Add Service"**
   - Select **"Docker Compose"** or **"App"**

2. **Configure Repository**
   - **Source:** `GitHub`
   - **Repository:** `ViableSystemsGlobal/vibecodingacademy`
   - **Branch:** `main`
   - **Build Pack:** `Docker` or `Dockerfile`
   - **Dockerfile Path:** `backend/Dockerfile` ⚠️ **IMPORTANT: Specify this path!**
   - **Root Directory:** Leave empty or set to root `/`
   - **Build Context:** Root directory (where docker-compose.yml is)
   
   **Note:** If EasyPanel doesn't support subdirectory Dockerfiles, use `Dockerfile.backend` from root (we've created this for compatibility)

3. **Environment Variables**
   Add these in EasyPanel's environment variables section:

   ```env
   # Server
   NODE_ENV=production
   PORT=3005
   FRONTEND_URL=https://yourdomain.com

   # Database (from Step 1)
   DATABASE_URL=postgresql://vibe_user:your_password@vibecoding-db:5432/vibe_coding_academy?schema=public

   # JWT Secrets (generate with: openssl rand -base64 32)
   JWT_SECRET=your-generated-jwt-secret-here
   JWT_REFRESH_SECRET=your-generated-refresh-secret-here
   JWT_EXPIRES_IN=15m
   JWT_REFRESH_EXPIRES_IN=7d

   # SMTP (Email)
   SMTP_HOST=smtp.hostinger.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=your-email@yourdomain.com
   SMTP_PASS=your-smtp-password
   SMTP_FROM=your-email@yourdomain.com

   # Deywuro SMS
   DEYWURO_USERNAME=your-username
   DEYWURO_PASSWORD=your-password
   DEYWURO_SENDER=YOUR_SENDER_ID

   # Paystack (USE LIVE KEYS!)
   PAYSTACK_SECRET_KEY=sk_live_your-live-secret-key
   PAYSTACK_PUBLIC_KEY=pk_live_your-live-public-key
   PAYSTACK_WEBHOOK_SECRET=your-webhook-secret
   ```

4. **Port Configuration**
   - **Internal Port:** `3005`
   - **External Port:** `3005` (or let EasyPanel assign)
   - **Domain:** `api.yourdomain.com` (optional, for subdomain)

5. **Volumes (for file uploads)**
   - **Source:** `/app/uploads`
   - **Destination:** `/app/uploads`
   - This stores uploaded logos and images

6. **Deploy**
   - Click **"Deploy"** or **"Save"**
   - Wait for build to complete

7. **Run Database Migrations**
   After backend is running, open terminal/SSH and run:
   ```bash
   # Connect to backend container
   docker exec -it <backend-container-name> sh
   
   # Or use EasyPanel's terminal feature
   # Navigate to backend service → Terminal
   
   # Run migrations
   npx prisma migrate deploy
   
   # Generate Prisma client (if needed)
   npx prisma generate
   ```

---

### Step 3: Deploy Frontend

1. **Create New App in EasyPanel**
   - Click **"+ New"** or **"Add Service"**
   - Select **"Docker Compose"** or **"App"**

2. **Configure Repository**
   - **Source:** `GitHub`
   - **Repository:** `ViableSystemsGlobal/vibecodingacademy`
   - **Branch:** `main`
   - **Build Pack:** `Docker` or `Dockerfile`
   - **Dockerfile Path:** `frontend/Dockerfile` ⚠️ **IMPORTANT: Specify this path!**
   - **Root Directory:** Leave empty or set to root `/`
   - **Build Context:** Root directory (where docker-compose.yml is)
   
   **Note:** If EasyPanel doesn't support subdirectory Dockerfiles, use `Dockerfile.frontend` from root (we've created this for compatibility)

3. **Environment Variables**
   ```env
   NODE_ENV=production
   NEXT_PUBLIC_API_URL=https://api.yourdomain.com
   # OR if backend is on same domain:
   # NEXT_PUBLIC_API_URL=https://yourdomain.com/api
   ```

4. **Port Configuration**
   - **Internal Port:** `3000` (Next.js default)
   - **External Port:** `3000` (or let EasyPanel assign)
   - **Domain:** `yourdomain.com` (your main domain)

5. **Deploy**
   - Click **"Deploy"** or **"Save"**
   - Wait for build to complete

---

### Step 4: Configure Domain & SSL

1. **Add Domain in EasyPanel**
   - Go to your frontend service
   - Add domain: `yourdomain.com`
   - Add subdomain (optional): `api.yourdomain.com` for backend

2. **SSL Certificate**
   - EasyPanel usually handles SSL automatically with Let's Encrypt
   - Enable **"SSL"** or **"HTTPS"** in domain settings
   - Wait for certificate to be issued

3. **Update Environment Variables**
   - Update `FRONTEND_URL` in backend: `https://yourdomain.com`
   - Update `NEXT_PUBLIC_API_URL` in frontend: `https://api.yourdomain.com`

---

### Step 5: Configure Paystack Webhook

1. **Get Webhook URL**
   - Your webhook URL: `https://api.yourdomain.com/webhooks/paystack`
   - Or: `https://yourdomain.com/api/webhooks/paystack` (if using reverse proxy)

2. **Configure in Paystack Dashboard**
   - Login to Paystack
   - Go to **Settings → API Keys & Webhooks**
   - Add Webhook URL: `https://api.yourdomain.com/webhooks/paystack`
   - Subscribe to events:
     - `charge.success`
     - `charge.failed`
     - `transaction.success`
     - `transaction.failed`
   - Copy the webhook secret
   - Add to backend environment: `PAYSTACK_WEBHOOK_SECRET`

3. **Update Backend Environment**
   - Add `PAYSTACK_WEBHOOK_SECRET` to backend environment variables
   - Restart backend service

---

### Step 6: Verify Deployment

1. **Check Services Status**
   - All services should show **"Running"** or **"Healthy"**

2. **Test Backend**
   ```bash
   curl https://api.yourdomain.com/health
   # Should return: {"status":"ok","timestamp":"..."}
   ```

3. **Test Frontend**
   - Visit: `https://yourdomain.com`
   - Should load landing page

4. **Test Admin Login**
   - Visit: `https://yourdomain.com/admin/login`
   - Login with admin credentials
   - Verify dashboard loads

---

## 🔧 EasyPanel-Specific Configuration

### Using Docker Compose in EasyPanel

If EasyPanel supports Docker Compose directly:

1. **Create New App**
   - Select **"Docker Compose"**
   - **Compose File:** Use `docker-compose.prod.yml` from repository

2. **Update Environment Variables**
   - Add all environment variables in EasyPanel's UI
   - Update `DATABASE_URL` to use EasyPanel's PostgreSQL service name

3. **Deploy**
   - EasyPanel will build and deploy all services

### Database Connection in EasyPanel

When using EasyPanel's PostgreSQL service:
- **Host:** Use the service name (e.g., `vibecoding-db`)
- **Port:** `5432`
- **Connection String:**
  ```
  postgresql://username:password@service-name:5432/database_name?schema=public
  ```

---

## 📝 Environment Variables Checklist

### Backend Required Variables:
- [ ] `NODE_ENV=production`
- [ ] `PORT=3005`
- [ ] `FRONTEND_URL=https://yourdomain.com`
- [ ] `DATABASE_URL=postgresql://...`
- [ ] `JWT_SECRET=...`
- [ ] `JWT_REFRESH_SECRET=...`
- [ ] `SMTP_HOST=...`
- [ ] `SMTP_USER=...`
- [ ] `SMTP_PASS=...`
- [ ] `SMTP_FROM=...`
- [ ] `DEYWURO_USERNAME=...`
- [ ] `DEYWURO_PASSWORD=...`
- [ ] `DEYWURO_SENDER=...`
- [ ] `PAYSTACK_SECRET_KEY=...`
- [ ] `PAYSTACK_PUBLIC_KEY=...`
- [ ] `PAYSTACK_WEBHOOK_SECRET=...`

### Frontend Required Variables:
- [ ] `NODE_ENV=production`
- [ ] `NEXT_PUBLIC_API_URL=https://api.yourdomain.com`

---

## 🐛 Troubleshooting

### Issue: Backend can't connect to database
**Solution:**
- Verify database service name is correct
- Check `DATABASE_URL` uses service name (not `localhost`)
- Ensure database service is running
- Check network connectivity between services

### Issue: Frontend can't reach backend
**Solution:**
- Verify `NEXT_PUBLIC_API_URL` is correct
- Check CORS settings in backend
- Ensure backend is accessible
- Check firewall/security groups

### Issue: Build fails
**Solution:**
- Check Dockerfile paths are correct
- Verify repository access
- Check build logs in EasyPanel
- Ensure all dependencies are in package.json

### Issue: Migrations fail
**Solution:**
- Connect to backend container via terminal
- Run: `npx prisma migrate deploy`
- Check database connection
- Verify Prisma schema is correct

### Issue: SSL not working
**Solution:**
- Wait for Let's Encrypt certificate (can take a few minutes)
- Check domain DNS is pointing to server
- Verify domain is added in EasyPanel
- Check SSL certificate status in EasyPanel

---

## 🔄 Updates & Maintenance

### Update Application

1. **Push changes to GitHub**
   ```bash
   git push origin main
   ```

2. **Redeploy in EasyPanel**
   - Go to service
   - Click **"Redeploy"** or **"Rebuild"**
   - EasyPanel will pull latest code and rebuild

### Database Backups

1. **Set up automated backups**
   - Use EasyPanel's backup feature (if available)
   - Or use the backup script:
   ```bash
   # SSH into server
   # Run backup script
   ./scripts/backup-database.sh
   ```

2. **Manual backup via EasyPanel**
   - Go to PostgreSQL service
   - Use backup/export feature

---

## 📊 Monitoring

### Check Logs in EasyPanel
- Go to each service
- Click **"Logs"** tab
- Monitor for errors

### Health Checks
- Backend: `https://api.yourdomain.com/health`
- Frontend: `https://yourdomain.com`

---

## ✅ Post-Deployment Checklist

- [ ] All services running
- [ ] Database migrations completed
- [ ] SSL certificates active
- [ ] Frontend accessible
- [ ] Backend API accessible
- [ ] Admin login works
- [ ] Payment webhook configured
- [ ] Email/SMS tested
- [ ] File uploads working (logo upload)
- [ ] CMS working
- [ ] Mobile responsive

---

## 🎯 Quick Reference

### Service Names (Example)
- **Database:** `vibecoding-db`
- **Backend:** `vibecoding-backend`
- **Frontend:** `vibecoding-frontend`

### URLs (Example)
- **Frontend:** `https://yourdomain.com`
- **Backend API:** `https://api.yourdomain.com`
- **Webhook:** `https://api.yourdomain.com/webhooks/paystack`

### Database Connection
```
postgresql://vibe_user:password@vibecoding-db:5432/vibe_coding_academy?schema=public
```

---

## 💡 Pro Tips

1. **Use EasyPanel's built-in PostgreSQL** - It's easier than external services
2. **Set up automated backups** - Don't lose your data
3. **Monitor logs regularly** - Catch issues early
4. **Test webhooks** - Use Paystack's test mode first
5. **Use environment variables** - Never hardcode secrets
6. **Enable SSL** - Always use HTTPS in production

---

## 🆘 Need Help?

1. Check EasyPanel documentation
2. Review application logs
3. Test each service individually
4. Verify environment variables
5. Check database connectivity

---

**You're all set! Your application should now be live on EasyPanel! 🚀**

