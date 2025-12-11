# 🔍 Troubleshooting: Environment Variables Not Working

## The Problem

You've set `NEXT_PUBLIC_API_URL=https://api.vibecoding.africa` in EasyPanel, but the frontend is still using `http://localhost:3005`.

## Why This Happens

`NEXT_PUBLIC_API_URL` is a **build-time** variable. It gets baked into the JavaScript bundle when Next.js builds. Simply setting it in EasyPanel's environment variables isn't enough - you must **redeploy** to rebuild.

## Step-by-Step Fix

### ✅ Step 1: Verify You're Setting It in the RIGHT Service

**CRITICAL:** Make sure you're setting `NEXT_PUBLIC_API_URL` in the **FRONTEND** service, NOT the backend!

- ✅ **Frontend Service** (port 3000): Needs `NEXT_PUBLIC_API_URL`
- ❌ **Backend Service** (port 3005): Does NOT need `NEXT_PUBLIC_API_URL`

**How to tell which service is which:**
- Frontend: Usually named "frontend", "vibecoding-frontend", or shows port 3000
- Backend: Usually named "backend", "api", or shows port 3005

### ✅ Step 2: Set the Environment Variable

1. Go to EasyPanel → **Frontend Service** (the one on port 3000)
2. Click **"Environment Variables"** or **"Config"**
3. Add/Update:
   ```bash
   NEXT_PUBLIC_API_URL=https://api.vibecoding.africa
   ```
4. **Double-check:**
   - ✅ No typos
   - ✅ Uses `https://` (not `http://`)
   - ✅ No trailing slash
   - ✅ Exact value: `https://api.vibecoding.africa`
5. Click **"Save"**

### ✅ Step 3: REDEPLOY (This is Critical!)

⚠️ **YOU MUST REDEPLOY AFTER SETTING THE VARIABLE!**

1. In EasyPanel → Frontend Service
2. Click **"Deploy"** or **"Redeploy"** button
3. Wait for build to complete (2-5 minutes)
4. Watch the build logs - you should see:
   ```
   Building with NEXT_PUBLIC_API_URL=https://api.vibecoding.africa
   ```

**Why redeploy?** Next.js bakes `NEXT_PUBLIC_API_URL` into the JavaScript bundle at build time. Changing the env var alone won't work - you need to rebuild.

### ✅ Step 4: Verify It's Fixed

After redeploying:

1. Visit: `https://vibecoding.africa`
2. Open DevTools (F12) → **Console** tab
3. Look for API requests - they should now go to:
   ```
   https://api.vibecoding.africa/public/landing
   ```
   NOT `http://localhost:3005`

4. Check the **Network** tab:
   - Look for requests to `/public/landing`
   - The URL should be `https://api.vibecoding.africa/public/landing`
   - Status should be `200 OK` (not `CORS error` or `Failed to fetch`)

---

## Common Mistakes

### ❌ Mistake 1: Setting it in Backend Service
**Symptom:** Variable is set, but frontend still uses `localhost:3005`
**Fix:** Set it in the **Frontend** service, not backend

### ❌ Mistake 2: Not Redeploying
**Symptom:** Variable is set correctly, but frontend still uses old URL
**Fix:** You MUST redeploy after setting the variable

### ❌ Mistake 3: Typo in URL
**Symptom:** Variable set, but requests fail
**Fix:** Check for:
- `http://` instead of `https://`
- Trailing slash: `https://api.vibecoding.africa/` (remove the `/`)
- Wrong domain: `api.vibecoding.africa` vs `vibecoding.africa`

### ❌ Mistake 4: Setting Runtime Variable Instead of Build Variable
**Symptom:** Variable set, redeployed, but still not working
**Fix:** Make sure it's `NEXT_PUBLIC_API_URL` (with `NEXT_PUBLIC_` prefix), not `API_URL`

---

## How to Check What Value Is Being Used

### Option 1: Check Build Logs
In EasyPanel → Frontend Service → Build Logs, look for:
```
Building with NEXT_PUBLIC_API_URL=https://api.vibecoding.africa
```

### Option 2: Check Browser Console
1. Open `https://vibecoding.africa`
2. Press F12 → Console
3. Look for error messages - they'll show the URL being used
4. Or check Network tab → see actual request URLs

### Option 3: Check EasyPanel Environment Variables
1. Go to Frontend Service → Environment Variables
2. Verify `NEXT_PUBLIC_API_URL` is listed and has correct value
3. Make sure there are no duplicate entries with wrong values

---

## Still Not Working?

If you've done all the above and it's still not working:

1. **Check EasyPanel Build Logs:**
   - Look for the line: `Building with NEXT_PUBLIC_API_URL=...`
   - What value does it show?

2. **Verify Backend is Accessible:**
   - Visit: `https://api.vibecoding.africa/health`
   - Should return: `{"status":"ok"}`
   - If not, backend isn't running or domain isn't configured

3. **Check CORS:**
   - Backend should have: `FRONTEND_URL=https://vibecoding.africa`
   - Restart backend after setting this

4. **Clear Browser Cache:**
   - Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - Or open in incognito/private window

5. **Check for Multiple Frontend Services:**
   - Make sure you're setting the variable in the service that's actually serving `vibecoding.africa`

---

## Summary Checklist

- [ ] Set `NEXT_PUBLIC_API_URL=https://api.vibecoding.africa` in **Frontend** service
- [ ] Verified no typos in the URL
- [ ] Saved the environment variables
- [ ] **Redeployed** the frontend service
- [ ] Waited for build to complete
- [ ] Checked build logs show correct URL
- [ ] Verified in browser console/network tab
- [ ] Backend has `FRONTEND_URL=https://vibecoding.africa`
- [ ] Backend is accessible at `https://api.vibecoding.africa/health`

If all checked, it should work! ✅
