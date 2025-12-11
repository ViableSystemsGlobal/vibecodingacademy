# 🚨 QUICK FIX: Frontend Using Wrong API URL

## The Problem

Your frontend is trying to connect to:
```
http://localhost:3005/public/landing
```

But it should be connecting to:
```
https://api.vibecoding.africa/public/landing
```

## Why This Happened

`NEXT_PUBLIC_API_URL` is a **build-time** environment variable. If it wasn't set when EasyPanel built your frontend, it defaults to `http://localhost:3005`.

## The Fix (2 Steps)

### Step 1: Set Environment Variable in EasyPanel

1. Go to EasyPanel → Your **Frontend Service**
2. Click **"Environment Variables"** or **"Config"**
3. Add/Update:
   ```bash
   NEXT_PUBLIC_API_URL=https://api.vibecoding.africa
   ```
4. **Save** the environment variables

### Step 2: Redeploy Frontend

⚠️ **CRITICAL:** You MUST redeploy after setting the environment variable!

1. In EasyPanel → Frontend Service
2. Click **"Deploy"** or **"Redeploy"**
3. Wait for build to complete (2-5 minutes)

**Why redeploy?** Next.js bakes `NEXT_PUBLIC_API_URL` into the JavaScript bundle at build time. Changing the env var alone won't work - you need to rebuild.

---

## Verify It's Fixed

After redeploying:

1. Visit: `https://vibecoding.africa`
2. Open DevTools (F12) → Console tab
3. Look for requests - they should now go to:
   ```
   https://api.vibecoding.africa/public/landing
   ```
   NOT `http://localhost:3005`

---

## Also Check Backend CORS

While you're at it, make sure backend allows your frontend:

1. Go to EasyPanel → **Backend Service**
2. Check Environment Variables:
   ```bash
   FRONTEND_URL=https://vibecoding.africa
   ```
3. If you changed it, **Restart** the backend

---

## Summary

**The Issue:**
- Frontend built with `NEXT_PUBLIC_API_URL` = `http://localhost:3005` (default)
- Needs to be `https://api.vibecoding.africa`

**The Fix:**
1. Set `NEXT_PUBLIC_API_URL=https://api.vibecoding.africa` in EasyPanel
2. **Redeploy frontend** (rebuilds with correct URL)
3. Done! ✅

That's it! The frontend will now connect to the correct API URL.
