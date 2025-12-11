# 🌱 How to Run Database Seed Script

## Quick Fix: Install tsx Temporarily

Since `tsx` is not installed in the production container, install it first:

```bash
npm install tsx
```

Then run the seed script:

```bash
npm run prisma:seed
```

---

## Alternative: Use npx (No Installation Needed)

`npx` will download `tsx` temporarily:

```bash
npx tsx prisma/seed.ts
```

---

## Alternative: Install tsx Globally

```bash
npm install -g tsx
npm run prisma:seed
```

---

## What the Seed Script Creates

After running successfully, you'll see:

```
🌱 Starting database seed...
✅ Created admin user: admin@vibecoding.com
✅ Created parent user: parent@example.com
✅ Created students
✅ Created classes
✅ Created email templates
🎉 Database seed completed successfully!

📝 Login credentials:
   Admin: admin@vibecoding.com / admin123
   Parent: parent@example.com / parent123
```

---

## Full Command Sequence

In EasyPanel Terminal (Backend Service), run:

```bash
# Install tsx
npm install tsx

# Run seed script
npm run prisma:seed
```

Or in one line:

```bash
npm install tsx && npm run prisma:seed
```

---

## Troubleshooting

### "Cannot find module '@prisma/client'"

Generate Prisma client first:

```bash
npx prisma generate
npm install tsx
npm run prisma:seed
```

### "Database connection failed"

Check your `DATABASE_URL` environment variable is set correctly in EasyPanel.

### "Permission denied"

Make sure you're in the `/app` directory:

```bash
cd /app
npm install tsx
npm run prisma:seed
```

---

## Summary

**Quickest way:**
```bash
npm install tsx && npm run prisma:seed
```

**Or use npx (no install):**
```bash
npx tsx prisma/seed.ts
```

After running, login with:
- **Email:** `admin@vibecoding.com`
- **Password:** `admin123`
