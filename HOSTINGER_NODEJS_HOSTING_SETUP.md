# Hostinger Node.js Web Apps Hosting - Setup Guide

## ✅ Hostinger DOES Support Node.js!

Hostinger offers **Node.js web apps hosting** - a fully managed service for deploying Node.js applications. This is different from their regular managed hosting.

**Service:** [Node.js web apps hosting](https://www.hostinger.com/web-apps-hosting)

## 📋 What You Get

- **Auto-detection** of frameworks (React, Next.js, Vite, Vue.js, etc.)
- **Deploy from GitHub** - Connect your repository
- **Fully managed** - Servers, security, scaling handled
- **Free domain** for 1 year
- **Free SSL** certificates
- **Free business email** for 1 year
- **No traffic limits** - Unlimited bandwidth
- **CDN included** - Fast global delivery

## 💰 Pricing

- **Business Plan:** $2.99/mo - **5 Node.js web apps**
- **Cloud Startup:** $6.99/mo - **10 Node.js web apps**

## 🚀 Deployment Steps

### Step 1: Sign Up for Node.js Web Apps Hosting

1. Go to https://www.hostinger.com/web-apps-hosting
2. Choose a plan (Business or Cloud Startup)
3. Sign up or log in to your Hostinger account

### Step 2: Connect Your GitHub Repository

1. In Hostinger dashboard, go to **Node.js web apps**
2. Click **"New App"** or **"Deploy"**
3. Select **"Connect GitHub"**
4. Authorize Hostinger to access your repositories
5. Select repository: `ViableSystemsGlobal/vibecodingacademy`
6. Select branch: `main`

### Step 3: Configure Your App

Hostinger will auto-detect your framework, but you may need to configure:

#### For Frontend (Next.js):

**App Settings:**
- **Framework:** Next.js (auto-detected)
- **Root Directory:** `frontend`
- **Build Command:** `npm run build` (auto-detected)
- **Start Command:** `npm start` (auto-detected)
- **Node Version:** 18.x (auto-detected from `.node-version`)

**Environment Variables:**
```
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://your-backend-url.com
```

#### For Backend (Express.js):

**App Settings:**
- **Framework:** Node.js (auto-detected)
- **Root Directory:** `backend`
- **Build Command:** `npm run build` (auto-detected)
- **Start Command:** `npm start` (auto-detected)
- **Node Version:** 18.x (auto-detected from `.node-version`)

**Environment Variables:**
```
NODE_ENV=production
PORT=3005
DATABASE_URL=postgresql://user:pass@host:5432/dbname
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
FRONTEND_URL=https://your-frontend-url.com
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@domain.com
SMTP_PASS=your-smtp-password
DEYWURO_USERNAME=your-username
DEYWURO_PASSWORD=your-password
DEYWURO_SENDER=YOUR_SENDER_ID
PAYSTACK_SECRET_KEY=your-secret-key
PAYSTACK_PUBLIC_KEY=your-public-key
PAYSTACK_WEBHOOK_SECRET=your-webhook-secret
```

### Step 4: Deploy

1. Click **"Deploy"** or **"Launch"**
2. Hostinger will:
   - Clone your repository
   - Install dependencies (`npm install`)
   - Build your app (`npm run build`)
   - Start your app (`npm start`)
3. Wait for deployment to complete (usually 2-5 minutes)

### Step 5: Configure Domain

1. After deployment, go to app settings
2. Click **"Add Domain"**
3. Enter your domain or use Hostinger's free subdomain
4. SSL certificate will be automatically configured

### Step 6: Run Database Migrations (Backend Only)

After backend is deployed:

1. Go to your backend app in Hostinger dashboard
2. Open **"Terminal"** or **"SSH"** (if available)
3. Run:
   ```bash
   cd backend
   npx prisma generate
   npx prisma migrate deploy
   ```

**OR** if terminal is not available, you may need to:
- Add a build script that runs migrations
- Or use a deployment hook/script

## 🔧 Project Configuration

Your project is already configured with:

✅ **Root `package.json`** - Identifies as Node.js project  
✅ **`.node-version`** - Specifies Node.js 18  
✅ **`.nvmrc`** - Node version manager config  
✅ **Backend `package.json`** - Has build and start scripts  
✅ **Frontend `package.json`** - Has build and start scripts  

## 📝 Important Notes

### Separate Deployments

Since you have a **full-stack app** (frontend + backend), you'll need to deploy them as **two separate apps**:

1. **App 1: Frontend**
   - Root Directory: `frontend`
   - Framework: Next.js
   - URL: `https://yourdomain.com` or `https://your-app-1.hostinger.app`

2. **App 2: Backend**
   - Root Directory: `backend`
   - Framework: Node.js
   - URL: `https://api.yourdomain.com` or `https://your-app-2.hostinger.app`

### Database

Hostinger Node.js hosting may not include PostgreSQL. You may need:

- **External PostgreSQL** (Supabase, Neon, Railway, etc.)
- **Or** use Hostinger's database service (if available)
- **Or** upgrade to a plan that includes database

### Environment Variables

Make sure to set all environment variables in Hostinger's dashboard before deploying.

## 🐛 Troubleshooting

### Issue: Auto-detection fails

**Solution:**
- Manually set framework in app settings
- Specify root directory (`frontend` or `backend`)
- Set build and start commands manually

### Issue: Build fails

**Solution:**
- Check Node.js version (should be 18+)
- Verify all dependencies are in `package.json`
- Check build logs in Hostinger dashboard
- Ensure `package.json` has correct scripts

### Issue: App doesn't start

**Solution:**
- Check start command in app settings
- Verify environment variables are set
- Check app logs in Hostinger dashboard
- Ensure port is correctly configured (backend uses 3005)

### Issue: Can't connect to database

**Solution:**
- Verify `DATABASE_URL` is correct
- Check if database is accessible from Hostinger's servers
- Use external database service if needed

## 📚 Resources

- **Hostinger Node.js Hosting:** https://www.hostinger.com/web-apps-hosting
- **Supported Frameworks:** React, Next.js, Vite, Vue.js, and others
- **Documentation:** Check Hostinger's knowledge base for Node.js hosting

## ✅ Deployment Checklist

- [ ] Signed up for Node.js web apps hosting
- [ ] Connected GitHub repository
- [ ] Created frontend app (root: `frontend`)
- [ ] Created backend app (root: `backend`)
- [ ] Set environment variables for both apps
- [ ] Configured domains
- [ ] Deployed both apps
- [ ] Ran database migrations (backend)
- [ ] Tested frontend URL
- [ ] Tested backend API
- [ ] Verified frontend can connect to backend

---

**You're all set! Your Node.js app should deploy successfully on Hostinger! 🚀**
