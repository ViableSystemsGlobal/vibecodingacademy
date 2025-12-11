# Fix: Frontend Can't Connect to Backend API

## The Problem

- ✅ Backend API is working (test endpoints return data)
- ❌ Frontend shows "Error loading page data"
- ❌ Frontend can't fetch data from backend

## Most Likely Causes

### 1. Frontend Built with Wrong API URL ⚠️ **MOST COMMON**

**Problem:** `NEXT_PUBLIC_API_URL` is a **build-time** variable in Next.js. If it wasn't set when building, it defaults to `http://localhost:3005`, which won't work in production.

**Check:**
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for error messages - they'll show what API URL is being used
4. Check Network tab - see what URL requests are going to

**Fix:**
1. In EasyPanel, go to your **frontend service**
2. Check Environment Variables:
   - `NEXT_PUBLIC_API_URL` should be: `https://api.vibecoding.africa`
3. **Redeploy the frontend** (this rebuilds with the correct API URL)

---

### 2. CORS Blocking Requests

**Problem:** Backend is blocking requests from frontend domain.

**Check:**
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for CORS errors like: "Access to fetch at '...' from origin '...' has been blocked by CORS policy"

**Fix:**
1. In EasyPanel, go to your **backend service**
2. Check Environment Variables:
   - `FRONTEND_URL` should be: `https://vibecoding.africa`
3. **Restart the backend** service

The backend CORS config checks `config.frontendUrl`, which comes from `FRONTEND_URL` env var.

---

### 3. Network/Connection Issue

**Problem:** Frontend can't reach backend at all.

**Check:**
1. Open browser DevTools (F12)
2. Go to Network tab
3. Refresh the page
4. Look for failed requests to `/public/landing`
5. Check the error message

**Common Errors:**
- `Failed to fetch` = Network error (CORS or connection)
- `Network Error` = Can't reach server
- `404 Not Found` = Wrong URL
- `500 Internal Server Error` = Backend error (check backend logs)

---

## Step-by-Step Fix

### Step 1: Verify Backend is Accessible

Test in browser:
```
https://api.vibecoding.africa/health
```

Should return:
```json
{"status":"ok","timestamp":"..."}
```

If this doesn't work → Backend isn't deployed or not accessible.

---

### Step 2: Check Frontend Environment Variables

In EasyPanel → Frontend Service → Environment Variables:

**Required:**
```bash
NEXT_PUBLIC_API_URL=https://api.vibecoding.africa
```

⚠️ **Important:** If this wasn't set when you deployed, you need to **redeploy** the frontend!

---

### Step 3: Check Backend Environment Variables

In EasyPanel → Backend Service → Environment Variables:

**Required:**
```bash
FRONTEND_URL=https://vibecoding.africa
```

This is used for CORS - backend needs to know which frontend to allow.

---

### Step 4: Redeploy Frontend

**Why:** `NEXT_PUBLIC_API_URL` is baked into the build. If it was wrong, you need to rebuild.

1. In EasyPanel → Frontend Service
2. Make sure `NEXT_PUBLIC_API_URL=https://api.vibecoding.africa` is set
3. Click **"Deploy"** or **"Redeploy"**
4. Wait for build to complete

---

### Step 5: Restart Backend

**Why:** CORS config reads `FRONTEND_URL` at startup.

1. In EasyPanel → Backend Service
2. Make sure `FRONTEND_URL=https://vibecoding.africa` is set
3. Click **"Restart"** or **"Redeploy"**

---

### Step 6: Test Again

1. Visit: `https://vibecoding.africa`
2. Open DevTools (F12) → Console tab
3. Look for:
   - ✅ Success: No errors, page loads
   - ❌ Still errors: Check the error message

---

## Debugging in Browser

### Check What API URL Frontend is Using:

1. Open `https://vibecoding.africa`
2. Press F12 (DevTools)
3. Go to Console tab
4. Type: `process.env.NEXT_PUBLIC_API_URL`
5. Or check the error message - it shows the API URL

### Check Network Requests:

1. Open DevTools (F12)
2. Go to Network tab
3. Refresh page
4. Look for request to `/public/landing`
5. Click on it → See:
   - Request URL (what URL it's trying)
   - Status code (200 = success, 4xx/5xx = error)
   - Response (what backend returned)

### Check for CORS Errors:

In Console tab, look for:
```
Access to fetch at 'https://api.vibecoding.africa/public/landing' 
from origin 'https://vibecoding.africa' has been blocked by CORS policy
```

**Fix:** Set `FRONTEND_URL=https://vibecoding.africa` in backend and restart.

---

## Quick Checklist

- [ ] Backend `/health` endpoint works: `https://api.vibecoding.africa/health`
- [ ] Backend `/public/landing` endpoint works: `https://api.vibecoding.africa/public/landing`
- [ ] Frontend env var: `NEXT_PUBLIC_API_URL=https://api.vibecoding.africa`
- [ ] Backend env var: `FRONTEND_URL=https://vibecoding.africa`
- [ ] Frontend has been **redeployed** after setting `NEXT_PUBLIC_API_URL`
- [ ] Backend has been **restarted** after setting `FRONTEND_URL`
- [ ] No CORS errors in browser console
- [ ] Network requests show correct API URL

---

## Common Error Messages & Fixes

### "Network Error: Unable to connect to API at http://localhost:3005"

**Cause:** Frontend was built with wrong API URL

**Fix:** 
1. Set `NEXT_PUBLIC_API_URL=https://api.vibecoding.africa` in EasyPanel
2. Redeploy frontend

---

### "CORS policy: No 'Access-Control-Allow-Origin' header"

**Cause:** Backend not allowing frontend origin

**Fix:**
1. Set `FRONTEND_URL=https://vibecoding.africa` in backend
2. Restart backend

---

### "Route /public/landing not found"

**Cause:** Backend route not registered or wrong URL

**Fix:** Check backend logs, verify route exists

---

### "500 Internal Server Error"

**Cause:** Backend error (database, etc.)

**Fix:** Check backend logs in EasyPanel

---

## Still Not Working?

1. **Check Browser Console** (F12) - Shows exact error
2. **Check Network Tab** (F12) - Shows what requests are made
3. **Check Backend Logs** (EasyPanel) - Shows backend errors
4. **Verify URLs** - Make sure domains are correct
5. **Test API directly** - Use browser/curl to test endpoints

---

## Summary

**Most Common Fix:**
1. Set `NEXT_PUBLIC_API_URL=https://api.vibecoding.africa` in frontend
2. **Redeploy frontend** (rebuilds with correct URL)
3. Set `FRONTEND_URL=https://vibecoding.africa` in backend
4. **Restart backend** (applies CORS config)

That's usually it! 🎉
