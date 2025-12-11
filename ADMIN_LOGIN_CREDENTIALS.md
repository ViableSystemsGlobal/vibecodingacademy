# 🔐 Admin Login Credentials

## Default Admin Credentials

If the database has been seeded, you can login with:

**Email:** `admin@vibecoding.com`  
**Password:** `admin123`

---

## How to Access Admin Panel

1. **Visit the admin login page:**
   - `https://vibecoding.africa/admin/login`
   - Or: `https://vibecoding.africa/login` (then select "Admin" tab)

2. **Enter credentials:**
   - Email: `admin@vibecoding.com`
   - Password: `admin123`

3. **Click "Login"**

---

## ⚠️ If Login Doesn't Work

If the default credentials don't work, the admin user hasn't been created yet. You need to **run the seed script** to create it.

### Option 1: Run Seed Script in EasyPanel Terminal (Recommended)

1. Go to EasyPanel → **Backend Service**
2. Click **"Terminal"** or **"Console"** button
3. Run this command:
   ```bash
   npm run prisma:seed
   ```
   Or:
   ```bash
   npx tsx prisma/seed.ts
   ```

4. You should see:
   ```
   🌱 Starting database seed...
   ✅ Created admin user: admin@vibecoding.com
   🎉 Database seed completed successfully!
   📝 Login credentials:
      Admin: admin@vibecoding.com / admin123
   ```

5. **Try logging in again** with the credentials above

### Option 2: Run Seed via SSH (If Available)

If you have SSH access:

```bash
# SSH into your server
ssh user@your-server-ip

# Find your backend container
docker ps

# Enter the backend container
docker exec -it <container-name> sh

# Run seed script
npm run prisma:seed
```

---

## What the Seed Script Does

The seed script (`backend/prisma/seed.ts`) creates:

1. **Admin User:**
   - Email: `admin@vibecoding.com`
   - Password: `admin123`
   - Role: `ADMIN`

2. **Test Parent User:**
   - Email: `parent@example.com`
   - Password: `parent123`
   - Role: `PARENT`

3. **Sample Data:**
   - Test students
   - Sample classes
   - Email templates
   - Other demo data

**Note:** The seed script uses `upsert`, so it's **safe to run multiple times**. It won't create duplicates - it will update existing records if they already exist.

---

## 🔒 Security: Change Default Password!

⚠️ **IMPORTANT:** The default password `admin123` is **NOT secure** for production!

After logging in for the first time:

1. Go to **Admin Settings** (if available)
2. Change your password to something strong
3. Or use the "Forgot Password" feature to reset it

---

## Creating Additional Admin Users

If you need to create more admin users, you can:

### Option 1: Use the API (If Available)

```bash
POST https://api.vibecoding.africa/auth/register-admin
Content-Type: application/json

{
  "name": "New Admin",
  "email": "newadmin@vibecoding.com",
  "password": "secure-password-here"
}
```

### Option 2: Modify Seed Script

Edit `backend/prisma/seed.ts` and add more admin users, then run the seed script again.

### Option 3: Direct Database Access

If you have database access, you can create admin users directly using Prisma Studio or SQL:

```bash
# In EasyPanel Terminal (Backend Service)
npx prisma studio
```

Then navigate to the `users` table and create a new user with `role: ADMIN`.

---

## Troubleshooting

### "Invalid credentials" Error

**Possible causes:**
1. Admin user doesn't exist (run seed script)
2. Wrong email/password
3. Database connection issue

**Fix:**
1. Run the seed script (see above)
2. Double-check email: `admin@vibecoding.com` (not `admin@vibecoding.africa`)
3. Check backend logs for errors

### "User not found" Error

**Cause:** Admin user hasn't been created yet

**Fix:** Run the seed script (see Option 1 above)

### Seed Script Fails

**Common errors:**

1. **"Cannot find module 'tsx'"**
   ```bash
   npm install
   npm run prisma:seed
   ```

2. **"Database connection failed"**
   - Check `DATABASE_URL` environment variable in EasyPanel
   - Verify PostgreSQL service is running

3. **"Prisma Client not generated"**
   ```bash
   npx prisma generate
   npm run prisma:seed
   ```

---

## Quick Reference

| Item | Value |
|------|-------|
| **Admin Email** | `admin@vibecoding.com` |
| **Admin Password** | `admin123` |
| **Login URL** | `https://vibecoding.africa/admin/login` |
| **Seed Command** | `npm run prisma:seed` |
| **Seed Script** | `backend/prisma/seed.ts` |

---

## Summary

1. **Try logging in first** with: `admin@vibecoding.com` / `admin123`
2. **If it doesn't work**, run the seed script in EasyPanel Terminal:
   ```bash
   npm run prisma:seed
   ```
3. **Change the password** after first login for security
4. **Done!** ✅
