# 📦 Setting Up Volumes in EasyPanel

## Why You Need a Volume

Your application stores uploaded files (logos, images, etc.) in the `/app/uploads` directory inside the container.

**Without a volume:**
- ❌ Files are lost when the container is recreated/redeployed
- ❌ Files are stored inside the container's filesystem (ephemeral)
- ❌ No persistence across deployments

**With a volume:**
- ✅ Files persist across container restarts/redeployments
- ✅ Files are stored on the host filesystem (persistent)
- ✅ Safe for production use

---

## What Gets Stored

The application uploads:
- **Site logos** (from admin settings)
- **Other images** uploaded through the admin panel
- Files are stored in `/app/uploads` inside the container

---

## How to Set Up Volume in EasyPanel

### Step 1: Go to Backend Service

1. Open EasyPanel
2. Navigate to your **Backend Service** (the one on port 3005)
3. Click on the service to open its configuration

### Step 2: Add Volume

1. Look for **"Volumes"** or **"Storage"** section
2. Click **"Add Volume"** or **"Mount Volume"**

### Step 3: Configure Volume

**Volume Configuration:**
- **Source/Path on Host:** `/var/lib/easypanel/data/vibecoding-uploads` (or any path you prefer)
- **Destination/Mount Point:** `/app/uploads`
- **Type:** `bind` or `volume` (depends on EasyPanel)

**Alternative (if EasyPanel uses named volumes):**
- **Volume Name:** `vibecoding-uploads`
- **Mount Point:** `/app/uploads`

### Step 4: Save and Redeploy

1. **Save** the volume configuration
2. **Redeploy** the backend service (volume mounts apply on container start)

---

## EasyPanel-Specific Instructions

EasyPanel's interface may vary. Look for:

- **"Volumes"** tab
- **"Storage"** section
- **"Mount Points"** option
- **"Persistent Storage"** setting

If you can't find volumes option:
1. Check EasyPanel documentation
2. Contact EasyPanel support
3. Use the terminal method below (if you have SSH access)

---

## Alternative: Manual Volume Setup (If You Have SSH Access)

If EasyPanel doesn't support volumes through the UI, you can set it up manually:

### Step 1: Create Directory on Host

```bash
# SSH into your server
ssh user@your-server-ip

# Create uploads directory
sudo mkdir -p /var/lib/easypanel/data/vibecoding-uploads
sudo chown -R 1000:1000 /var/lib/easypanel/data/vibecoding-uploads
```

### Step 2: Update Docker Compose or Container

If EasyPanel uses Docker Compose, you might need to edit the compose file or use EasyPanel's advanced settings to add:

```yaml
volumes:
  - /var/lib/easypanel/data/vibecoding-uploads:/app/uploads
```

---

## Verify Volume is Working

After setting up the volume:

1. **Upload a file** through the admin panel (e.g., upload a logo in settings)
2. **Check if file exists** on the host:
   ```bash
   ls -la /var/lib/easypanel/data/vibecoding-uploads
   ```
3. **Redeploy the container** and verify the file still exists after redeployment

---

## Volume Path Recommendations

### Option 1: EasyPanel Data Directory (Recommended)
```
/var/lib/easypanel/data/vibecoding-uploads
```

### Option 2: Custom Location
```
/opt/vibecoding/uploads
```

### Option 3: User Home Directory
```
~/vibecoding-uploads
```

**Important:** Make sure the directory:
- ✅ Exists before mounting
- ✅ Has correct permissions (readable/writable by container user)
- ✅ Is in a location that won't be deleted

---

## Permissions Fix (If Needed)

If the container can't write to the volume:

```bash
# SSH into server
ssh user@your-server-ip

# Fix permissions
sudo chown -R 1000:1000 /var/lib/easypanel/data/vibecoding-uploads
sudo chmod -R 755 /var/lib/easypanel/data/vibecoding-uploads
```

Or if your container runs as root:
```bash
sudo chown -R root:root /var/lib/easypanel/data/vibecoding-uploads
sudo chmod -R 755 /var/lib/easypanel/data/vibecoding-uploads
```

---

## Backup Strategy

Since files are now on the host, include them in your backup strategy:

```bash
# Backup uploads directory
tar -czf backups/uploads-$(date +%Y%m%d).tar.gz /var/lib/easypanel/data/vibecoding-uploads
```

---

## Troubleshooting

### "Permission denied" when uploading

**Fix:** Check volume permissions (see above)

### Files still disappear after redeploy

**Cause:** Volume not mounted correctly

**Fix:**
1. Verify volume is listed in EasyPanel
2. Check mount point is `/app/uploads`
3. Verify container can access the directory

### "No space left on device"

**Cause:** Volume is on the same disk as system files

**Fix:** Move volume to a different disk or increase disk space

---

## Summary

**Yes, you should create a volume!** Here's why:

1. ✅ **Prevents data loss** - Files persist across deployments
2. ✅ **Production-ready** - Standard practice for file storage
3. ✅ **Easy backups** - Files are on host filesystem
4. ✅ **Better performance** - Direct host filesystem access

**Quick Setup:**
1. Go to EasyPanel → Backend Service
2. Add Volume: `/app/uploads` → `/var/lib/easypanel/data/vibecoding-uploads`
3. Save and redeploy
4. Done! ✅

---

## Current Status

**Without volume:** Files are stored in container (will be lost on redeploy)  
**With volume:** Files are stored on host (persistent)

**Recommendation:** Set up the volume before uploading important files!
