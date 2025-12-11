# Deployment Status & Next Steps

## Current Status

✅ **Frontend Deployed**: The Next.js frontend is successfully built and deployed on EasyPanel
- Domain: `https://vibecoding.africa`
- Port: 3000
- Status: Running

❌ **Backend API Not Deployed**: The backend API is not yet deployed
- Expected URL: `https://api.vibecoding.africa` (or configured in `NEXT_PUBLIC_API_URL`)
- Current Issue: Frontend cannot connect to backend API

## The Problem

When you visit `https://vibecoding.africa`, you see "Error loading page data" because:

1. The frontend is trying to fetch data from `/public/landing` endpoint
2. The API client is configured to use `NEXT_PUBLIC_API_URL` (set to `https://api.vibecoding.africa`)
3. The backend API is not deployed or not accessible at that URL
4. The API call fails, showing the error message

## Solution: Deploy Backend API

You need to deploy the backend API separately in EasyPanel:

### Step 1: Create Backend Service in EasyPanel

1. **Create New App** in EasyPanel
   - Click **"+ New"** or **"Add Service"**
   - Select **"App"** or **"Docker"**

2. **Configure Repository**
   - **Source**: `GitHub`
   - **Repository**: `ViableSystemsGlobal/vibecodingacademy`
   - **Branch**: `main`
   - **Build Pack**: `Docker` or `Dockerfile`
   - **Dockerfile Path**: `backend/Dockerfile` ⚠️ **IMPORTANT: Specify this path!**
   - **Root Directory**: `/` (root)

3. **Environment Variables**
   ```bash
   # Server
   NODE_ENV=production
   PORT=3005
   FRONTEND_URL=https://vibecoding.africa

   # Database (from your PostgreSQL service)
   DATABASE_URL=postgresql://vibedb:vibedb25@viable_vibedb:5432/vibedb?sslmode=disable

   # JWT Secrets (use the same ones from frontend deployment)
   JWT_SECRET=dev-secret-key-change-in-production
   JWT_REFRESH_SECRET=dev-refresh-secret-key-change-in-production
   JWT_EXPIRES_IN=15m
   JWT_REFRESH_EXPIRES_IN=7d

   # SMTP (Email) - Optional
   SMTP_HOST=
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=
   SMTP_PASS=
   SMTP_FROM=

   # Deywuro SMS - Optional
   DEYWURO_USERNAME=
   DEYWURO_PASSWORD=
   DEYWURO_SENDER=

   # Paystack - Optional
   PAYSTACK_SECRET_KEY=
   PAYSTACK_PUBLIC_KEY=
   PAYSTACK_WEBHOOK_SECRET=
   ```

4. **Port Configuration**
   - **Internal Port**: `3005`
   - **External Port**: `3005` (or let EasyPanel assign)
   - **Domain**: `api.vibecoding.africa` (create subdomain)

5. **Deploy**
   - Click **"Deploy"**
   - Wait for build to complete

### Step 2: Run Database Migrations

After backend is running, open EasyPanel terminal and run:

```bash
# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Seed database (optional)
npx tsx scripts/deploy-seed.ts
```

### Step 3: Verify Backend is Running

Test the backend API:

```bash
curl https://api.vibecoding.africa/public/landing
# Should return JSON with landing page data
```

### Step 4: Update Frontend Environment Variable (if needed)

If your backend is on a different URL, update the frontend environment variable:

```bash
NEXT_PUBLIC_API_URL=https://api.vibecoding.africa
```

Then **redeploy the frontend** so it picks up the new API URL.

## Alternative: Use Same Domain with Different Ports

If you prefer not to use a subdomain:

1. **Backend**: Deploy on port `3005` (internal)
2. **Frontend**: Update `NEXT_PUBLIC_API_URL` to use the same domain:
   ```bash
   NEXT_PUBLIC_API_URL=https://vibecoding.africa:3005
   ```
3. Configure EasyPanel reverse proxy to route `/api/*` to backend port 3005

## Quick Test

Once backend is deployed, test:

1. **Backend Health**: `https://api.vibecoding.africa/health` (if you have a health endpoint)
2. **Landing Data**: `https://api.vibecoding.africa/public/landing`
3. **Frontend**: `https://vibecoding.africa` should now load properly

## Troubleshooting

### "Error loading page data" still showing

1. **Check Backend Status**: Is the backend service running in EasyPanel?
2. **Check API URL**: Verify `NEXT_PUBLIC_API_URL` matches your backend URL
3. **Check CORS**: Backend needs to allow requests from `https://vibecoding.africa`
4. **Check Network**: Open browser DevTools → Network tab → See if API calls are failing
5. **Check Backend Logs**: In EasyPanel, check backend service logs for errors

### CORS Errors

If you see CORS errors in browser console, add CORS configuration to backend:

```typescript
// In backend/src/server.ts
import cors from 'cors';

app.use(cors({
  origin: ['https://vibecoding.africa', 'http://localhost:3000'],
  credentials: true,
}));
```

### Database Connection Errors

If backend can't connect to database:
1. Verify `DATABASE_URL` is correct
2. Check PostgreSQL service is running
3. Verify network connectivity between services in EasyPanel

## Summary

**What's Working:**
- ✅ Frontend builds successfully
- ✅ Frontend is deployed and accessible
- ✅ Dockerfile is configured correctly

**What's Missing:**
- ❌ Backend API deployment
- ❌ Database migrations
- ❌ API connectivity

**Next Action:**
Deploy the backend API service in EasyPanel using `backend/Dockerfile` and configure it to run on port 3005.
