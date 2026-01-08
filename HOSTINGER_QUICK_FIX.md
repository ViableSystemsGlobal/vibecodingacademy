# Hostinger Deployment - Quick Fix Guide

## 🚨 Current Issue

Hostinger is looking for `composer.json` and `composer.lock` because it's detecting your project as PHP, but this is a **Node.js project**.

## ✅ What I've Done

I've created configuration files to help Hostinger recognize this as a Node.js project:

1. ✅ **`package.json`** (root) - Tells Hostinger this is Node.js
2. ✅ **`.node-version`** - Specifies Node.js 18
3. ✅ **`.nvmrc`** - Node version manager config
4. ✅ **`.htaccess`** - Apache configuration
5. ✅ **`ecosystem.config.js`** - PM2 process manager config
6. ✅ **`HOSTINGER_DEPLOYMENT.md`** - Complete deployment guide

## 🎯 Next Steps

### Step 1: Commit and Push Changes

```bash
git add .
git commit -m "Add Hostinger deployment configuration files"
git push origin main
```

### Step 2: Check Hostinger Panel

1. **Go to Hostinger Control Panel**
2. **Check if Node.js is enabled** for your domain
3. **Look for "Node.js" or "Application" settings**

### Step 3: Configure in Hostinger

If Hostinger supports Node.js:

1. **Enable Node.js** in your domain settings
2. **Set Node.js version** to 18.x
3. **Set Start Command**: `npm start` (or `npm run start:backend` for backend only)
4. **Set Build Command**: `npm run build:backend` (for backend)
5. **Set Root Directory**: `/` (root) or `/backend` (if deploying backend only)

### Step 4: Set Environment Variables

In Hostinger's environment variables panel, add:

**Backend:**
```
NODE_ENV=production
PORT=3005
DATABASE_URL=your-database-url
JWT_SECRET=your-secret
JWT_REFRESH_SECRET=your-refresh-secret
FRONTEND_URL=https://yourdomain.com
```

**Frontend (if deploying separately):**
```
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

## ⚠️ Important: Hostinger Managed Hosting Limitations

**Hostinger's managed hosting** may **NOT support**:
- Full-stack Node.js applications
- Separate frontend and backend services
- Docker containers
- PostgreSQL databases (may only support MySQL)

## 🔄 Alternative Solutions

### Option 1: Use Hostinger VPS (Recommended) ✅

1. **Upgrade to Hostinger VPS**
2. **Install EasyPanel** (one-click Docker management)
3. **Follow `EASYPANEL_DEPLOYMENT.md`**

This gives you full control and supports your full-stack app.

### Option 2: Deploy Separately

**Frontend:**
- Deploy to **Vercel** (free, perfect for Next.js)
- Or **Netlify** (free tier)

**Backend:**
- Deploy to **Railway** (free tier)
- Or **Render** (free tier)
- Or **Fly.io** (free tier)

**Database:**
- Use Hostinger PostgreSQL (if available)
- Or external database (Supabase, Neon, etc.)

### Option 3: Contact Hostinger Support

Ask them:
1. "Do you support Node.js applications?"
2. "Can I deploy a Next.js frontend and Express.js backend?"
3. "Do you support PostgreSQL databases?"
4. "What's the process to enable Node.js for my domain?"

## 📋 Deployment Checklist

- [ ] Committed and pushed configuration files
- [ ] Checked Hostinger panel for Node.js support
- [ ] Enabled Node.js (if available)
- [ ] Set environment variables
- [ ] Configured start/build commands
- [ ] Tested deployment
- [ ] Verified backend is running
- [ ] Verified frontend is running (if deployed)
- [ ] Tested API connectivity

## 🐛 If It Still Doesn't Work

If Hostinger still looks for `composer.json`:

1. **Contact Hostinger Support** - Ask about Node.js support
2. **Consider VPS** - Managed hosting may not work for your app
3. **Use Alternative Hosting** - See Option 2 above

## 📞 Need Help?

- Check `HOSTINGER_DEPLOYMENT.md` for detailed guide
- Check `EASYPANEL_DEPLOYMENT.md` for VPS deployment
- Contact Hostinger support for Node.js availability

---

**Remember**: Managed hosting is designed for simple apps. Full-stack Node.js apps usually need VPS or cloud platforms.
