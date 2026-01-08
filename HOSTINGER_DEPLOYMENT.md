# Hostinger Managed Hosting Deployment Guide

## ⚠️ Important Note

**Hostinger's managed hosting** typically supports:
- PHP applications (Composer-based)
- Static websites
- Simple Node.js applications (single app, not full-stack)

Your project is a **full-stack Node.js application** with:
- **Backend**: Express.js API (Node.js)
- **Frontend**: Next.js (Node.js)
- **Database**: PostgreSQL

## 🎯 Deployment Options

### Option 1: Hostinger VPS (Recommended) ✅

If you have **Hostinger VPS**, you can use **EasyPanel** or **Docker**:
- See `EASYPANEL_DEPLOYMENT.md` for complete instructions
- This is the recommended approach for full-stack apps

### Option 2: Separate Deployments

Deploy frontend and backend separately:

#### Frontend (Static Export)
1. Build Next.js as static site
2. Deploy to Hostinger's static hosting
3. See "Frontend Static Deployment" below

#### Backend (Separate Service)
1. Deploy backend to a Node.js hosting service (Railway, Render, etc.)
2. Or use Hostinger VPS for backend

### Option 3: Configure for Managed Hosting

If you want to try deploying on managed hosting, follow the steps below.

---

## 📋 Configuration Files Created

I've created these files to help Hostinger recognize this as a Node.js project:

1. **`.htaccess`** - Apache configuration (if Hostinger uses Apache)
2. **`package.json`** (root) - Tells Hostinger this is Node.js
3. **`.node-version`** - Specifies Node.js version
4. **`ecosystem.config.js`** - PM2 configuration (if using PM2)

---

## 🚀 Step-by-Step: Deploying on Managed Hosting

### Step 1: Choose Deployment Strategy

**For Managed Hosting, you have two options:**

#### A. Deploy Frontend Only (Static Export)

1. **Build Next.js as Static Site**
   ```bash
   cd frontend
   npm run build
   npm run export  # If configured
   ```

2. **Upload to Hostinger**
   - Upload the `frontend/out` or `frontend/.next` directory
   - Point your domain to this directory

3. **Backend Separate**
   - Deploy backend to a Node.js service (Railway, Render, etc.)
   - Update `NEXT_PUBLIC_API_URL` to point to backend

#### B. Deploy Full Stack (If Supported)

If Hostinger supports Node.js apps:

1. **Upload Project**
   - Upload entire project to Hostinger
   - Or connect via Git (as you're doing)

2. **Configure Build**
   - Hostinger should detect `package.json` at root
   - It should run `npm install` and `npm start`

3. **Set Environment Variables**
   - Add all required environment variables in Hostinger panel
   - See `ENV_SETUP.md` for complete list

4. **Configure Start Script**
   - Hostinger will look for `start` script in root `package.json`
   - I've created a root `package.json` with start scripts

---

## 🔧 Configuration Files

### Root `package.json`

This file tells Hostinger this is a Node.js project and how to start it.

### `.htaccess`

Apache configuration for routing (if Hostinger uses Apache).

### `.node-version`

Specifies Node.js version (18.x).

---

## 📝 Environment Variables

Set these in Hostinger's environment variables panel:

### Backend Variables
```
NODE_ENV=production
PORT=3005
DATABASE_URL=postgresql://user:pass@host:5432/dbname
JWT_SECRET=your-secret
JWT_REFRESH_SECRET=your-refresh-secret
FRONTEND_URL=https://yourdomain.com
```

### Frontend Variables
```
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

---

## 🐛 Troubleshooting

### Issue: "Looking for composer.lock file"

**Solution**: This means Hostinger is detecting this as PHP. 

1. **Check if you have root `package.json`** ✅ (I've created this)
2. **Check if Hostinger supports Node.js** - Contact Hostinger support
3. **Consider using VPS instead** - Managed hosting may not support full-stack Node.js

### Issue: Build fails

**Solution**:
1. Check Node.js version (should be 18+)
2. Check if all dependencies are in `package.json`
3. Check build logs in Hostinger panel

### Issue: App doesn't start

**Solution**:
1. Check `start` script in root `package.json`
2. Check environment variables are set
3. Check port configuration
4. Check logs in Hostinger panel

---

## ✅ Recommended Solution

**For a full-stack Node.js application like yours, I recommend:**

1. **Use Hostinger VPS** (not managed hosting)
2. **Install EasyPanel** on VPS
3. **Follow `EASYPANEL_DEPLOYMENT.md`** for deployment

This gives you:
- Full control over the environment
- Docker support
- Separate services (frontend, backend, database)
- Better performance
- Easier scaling

---

## 📞 Next Steps

1. **Check Hostinger Support**
   - Contact Hostinger support
   - Ask: "Do you support full-stack Node.js applications with separate frontend and backend?"
   - Ask: "Can I deploy a Next.js frontend and Express.js backend?"

2. **If Not Supported**
   - Upgrade to Hostinger VPS
   - Or use separate services:
     - Frontend: Vercel, Netlify (free for Next.js)
     - Backend: Railway, Render, Fly.io
     - Database: Hostinger PostgreSQL or external

3. **If Supported**
   - Follow the configuration files I've created
   - Set environment variables
   - Deploy and test

---

## 🔗 Alternative Hosting Options

If Hostinger managed hosting doesn't work:

### Free Options
- **Vercel** (Next.js frontend) - Free tier
- **Railway** (Backend) - Free tier with limits
- **Render** (Backend) - Free tier with limits

### Paid Options
- **Hostinger VPS** - Full control
- **DigitalOcean** - VPS or App Platform
- **AWS/Azure/GCP** - Cloud platforms

---

**Need help?** Check the other deployment guides:
- `EASYPANEL_DEPLOYMENT.md` - For VPS deployment
- `PRODUCTION_SETUP_GUIDE.md` - General production setup
