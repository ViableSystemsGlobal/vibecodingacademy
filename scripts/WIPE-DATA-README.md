# 🗑️ Wipe Database Data (Keep Settings)

This script will **permanently delete all business data** while preserving:
- ✅ System Settings
- ✅ Users
- ✅ Roles
- ✅ Abilities
- ✅ Role Abilities
- ✅ User Role Assignments
- ✅ Modules
- ✅ Module Activations

## ⚠️ WARNING

**This action cannot be undone!** Make sure you have a backup before running this script.

## 📋 What Gets Deleted

- All leads, accounts, contacts, opportunities
- All products, categories, price lists
- All invoices, quotations, orders, payments
- All inventory, warehouses, stock items
- All tasks, projects, incidents
- All ecommerce data (orders, customers, carts)
- All communication logs, emails, SMS
- All distributors, agents, commissions
- All other business data

## 🚀 How to Run on Production Server

### Option 1: Using Node.js directly (Recommended)

```bash
# 1. SSH into your production server
ssh your-server

# 2. Navigate to your project directory
cd /path/to/your/project

# 3. Make sure you have the latest code
git pull

# 4. Install dependencies (if needed)
npm install

# 5. Set your DATABASE_URL environment variable
export DATABASE_URL="postgresql://user:password@host:5432/database"

# 6. Run the script
npx tsx scripts/wipe-data-keep-settings.ts
```

### Option 2: Using Docker (if your app runs in Docker)

```bash
# 1. SSH into your server
ssh your-server

# 2. Navigate to your project
cd /path/to/your/project

# 3. Run the script inside your Docker container
docker-compose exec app npx tsx scripts/wipe-data-keep-settings.ts

# OR if using a different container name:
docker exec -it your-container-name npx tsx scripts/wipe-data-keep-settings.ts
```

### Option 3: Using EasyPanel/Managed Hosting

If you're using EasyPanel or similar managed hosting:

1. **Connect via SSH** (if available)
2. **Or use the terminal/console** in your hosting panel
3. Run the commands from Option 1

## 📝 Step-by-Step Instructions

### Before Running:

1. **Create a backup first!**
   ```bash
   # If using PostgreSQL
   pg_dump -h your-host -U your-user -d your-database > backup-$(date +%Y%m%d-%H%M%S).sql
   
   # Or use your hosting panel's backup feature
   ```

2. **Verify your DATABASE_URL** is correct
   ```bash
   echo $DATABASE_URL
   ```

3. **Test the connection** (optional)
   ```bash
   npx prisma db pull
   ```

### Running the Script:

```bash
# Run the script
npx tsx scripts/wipe-data-keep-settings.ts
```

The script will:
- Show warnings about what will be deleted
- Delete all business data in the correct order
- Preserve settings, users, roles, and abilities
- Show a summary of what was preserved

### After Running:

1. **Verify the data was wiped:**
   ```bash
   # Check that business data is gone
   npx prisma studio
   # Or query directly:
   npx tsx -e "import { PrismaClient } from '@prisma/client'; const p = new PrismaClient(); p.lead.count().then(c => console.log('Leads:', c)); p.product.count().then(c => console.log('Products:', c));"
   ```

2. **Verify settings are preserved:**
   ```bash
   npx tsx -e "import { PrismaClient } from '@prisma/client'; const p = new PrismaClient(); p.systemSettings.count().then(c => console.log('Settings:', c)); p.user.count().then(c => console.log('Users:', c));"
   ```

3. **Restart your application** (if needed)
   ```bash
   # If using PM2
   pm2 restart your-app
   
   # If using Docker
   docker-compose restart
   
   # If using systemd
   sudo systemctl restart your-app
   ```

## 🔒 Security Notes

- The script does NOT require authentication - it uses your DATABASE_URL
- Make sure your DATABASE_URL is secure and not exposed
- Only run this script if you have proper access to the production database
- Consider running it during off-peak hours

## 🐛 Troubleshooting

### Error: "Cannot find module '@prisma/client'"
```bash
npm install
npx prisma generate
```

### Error: "Connection refused" or "Database connection failed"
- Check your DATABASE_URL is correct
- Verify database is accessible from your server
- Check firewall rules

### Error: "Foreign key constraint violation"
- The script deletes in the correct order, but if you get this error:
- Check if there are custom tables or relationships not in the script
- You may need to manually delete problematic records first

## 📞 Need Help?

If something goes wrong:
1. **DO NOT PANIC** - you have a backup (right?)
2. Restore from your backup
3. Check the error message
4. Review the script to see what might have failed

## ✅ Verification Checklist

After running, verify:
- [ ] System settings are still there
- [ ] Users can still log in
- [ ] Roles and permissions are intact
- [ ] Modules are still configured
- [ ] Business data is gone (leads, products, invoices, etc.)
- [ ] Application starts without errors

