# How to Test Your Backend API

## ✅ Good News: Your Backend IS Running!

The "Route / not found" error is **normal** - APIs don't usually have a root route. Your backend is working correctly!

---

## Test These Endpoints

### 1. Health Check (Test if backend is running)

**URL:** `https://api.vibecoding.africa/health`

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-11T16:05:37.000Z"
}
```

**If this works:** ✅ Backend is running!

---

### 2. Landing Page Data (What your frontend needs)

**URL:** `https://api.vibecoding.africa/public/landing`

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "hero": { ... },
    "faq": { ... },
    "testimonials": { ... },
    "featuredClasses": [ ... ],
    "settings": {
      "logo_url": "...",
      "site_name": "..."
    }
  }
}
```

**If this works:** ✅ Frontend can now load!

---

### 3. Public Settings

**URL:** `https://api.vibecoding.africa/public/settings`

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "logo_url": "...",
    "site_name": "..."
  }
}
```

---

### 4. List Classes

**URL:** `https://api.vibecoding.africa/public/classes`

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "classes": [ ... ],
    "pagination": { ... }
  }
}
```

---

## Quick Test Commands

### Using Browser:
1. Visit: `https://api.vibecoding.africa/health`
   - Should show: `{"status":"ok","timestamp":"..."}`

2. Visit: `https://api.vibecoding.africa/public/landing`
   - Should show JSON with landing page data

### Using curl (Terminal):
```bash
# Test health endpoint
curl https://api.vibecoding.africa/health

# Test landing endpoint
curl https://api.vibecoding.africa/public/landing
```

---

## Why "/" Shows "Route not found"

**This is normal!** APIs typically don't serve content at the root path. Your routes are:

- `/health` ✅
- `/public/*` ✅
- `/admin/*` ✅
- `/auth/*` ✅

**Not:**
- `/` ❌ (No root route - this is correct!)

---

## If Health Check Works But Landing Doesn't

This means:
- ✅ Backend is running
- ✅ API is accessible
- ❌ Database might not be set up
- ❌ Migrations might not have run

**Solution:** Run migrations (see `HOW_TO_RUN_MIGRATIONS.md`)

---

## Common Issues

### Issue: CORS Error in Browser

**Symptom:** Browser shows CORS error when frontend tries to call API

**Fix:** Check backend CORS configuration allows `https://vibecoding.africa`

### Issue: 500 Internal Server Error

**Symptom:** API returns 500 error

**Fix:** 
1. Check backend logs in EasyPanel
2. Likely database connection issue
3. Run migrations: `npx prisma migrate deploy`

### Issue: 404 on /public/landing

**Symptom:** Route not found even on correct path

**Fix:** Check backend logs - route might not be registered

---

## Summary

**What you're seeing is GOOD:**
- ✅ Backend is deployed
- ✅ API is responding
- ✅ Routes are working (just not at `/`)

**Test the actual endpoints:**
- `/health` - Should work immediately
- `/public/landing` - Should work after migrations

**Next step:** Test `/health` endpoint to confirm backend is running!
