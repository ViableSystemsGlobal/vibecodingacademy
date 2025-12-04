# EasyPanel Quick Fix - Dockerfile Path Issue

## Problem
EasyPanel is looking for Dockerfile in root, but it's in `backend/` and `frontend/` subdirectories.

## Solution Options

### Option 1: Specify Dockerfile Path in EasyPanel (Recommended)

When creating the service in EasyPanel:

**For Backend:**
- **Dockerfile Path:** `backend/Dockerfile`
- **Build Context:** Root directory (where repo is cloned)

**For Frontend:**
- **Dockerfile Path:** `frontend/Dockerfile`
- **Build Context:** Root directory (where repo is cloned)

### Option 2: Use Root-Level Dockerfiles (If Option 1 Doesn't Work)

We've created `Dockerfile.backend` and `Dockerfile.frontend` in the root directory.

**For Backend:**
- **Dockerfile Path:** `Dockerfile.backend`
- **Build Context:** Root directory

**For Frontend:**
- **Dockerfile Path:** `Dockerfile.frontend`
- **Build Context:** Root directory

### Option 3: Use Docker Compose (Best for EasyPanel)

If EasyPanel supports Docker Compose:

1. **Create Docker Compose Service**
   - **Type:** Docker Compose
   - **Compose File:** `docker-compose.prod.yml`
   - **Environment Variables:** Add all variables in EasyPanel UI

2. **Update docker-compose.prod.yml for EasyPanel**

   The compose file will handle everything automatically, but you may need to update the build context:

   ```yaml
   backend:
     build:
       context: .
       dockerfile: backend/Dockerfile
     # ... rest of config
   
   frontend:
     build:
       context: .
       dockerfile: frontend/Dockerfile
     # ... rest of config
   ```

## Current Error Fix

Based on your error, EasyPanel is trying to use root-level Dockerfile. 

**Quick Fix:**
1. In EasyPanel, find the "Dockerfile Path" or "Dockerfile" setting
2. Change it to: `backend/Dockerfile` (for backend service)
3. Or use: `Dockerfile.backend` (we just created this)
4. Make sure "Build Context" is set to root directory

## Step-by-Step Fix

1. **Go to your backend service in EasyPanel**
2. **Edit/Configure the service**
3. **Find "Dockerfile" or "Dockerfile Path" setting**
4. **Set to:** `backend/Dockerfile`
5. **Set "Build Context" or "Root Directory" to:** `/` or root
6. **Save and Redeploy**

## Alternative: Update docker-compose.prod.yml

If using Docker Compose, update the build context:

```yaml
backend:
  build:
    context: .  # Root directory
    dockerfile: backend/Dockerfile
```

This tells Docker to build from root but use the Dockerfile in backend folder.

## Verify Fix

After updating:
1. Save configuration
2. Trigger rebuild/redeploy
3. Check build logs - should now find Dockerfile
4. Build should complete successfully

---

**The root-level Dockerfiles (`Dockerfile.backend` and `Dockerfile.frontend`) are now in the repo as backup options if EasyPanel can't handle subdirectory paths.**

