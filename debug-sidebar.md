# Debug Steps for Sidebar Issue

## Quick Check

Please open your browser console (F12) and paste this:

```javascript
// Check your user role and session
fetch('/api/auth/session').then(r => r.json()).then(console.log)

// Check your abilities
fetch('/api/user/abilities').then(r => r.json()).then(console.log)

// Clear menu cache manually
localStorage.clear()
sessionStorage.clear()
```

## What to look for:

1. **Your role** - should be `SUPER_ADMIN` or `ADMIN` to see System Settings children
2. **Your abilities** - should include:
   - `audit-trail.view`
   - `cron-settings.view`
   - `system-settings.view`

## If your role is not SUPER_ADMIN or ADMIN:

The children (Audit Trail and Cron Jobs) are restricted to admin users only. You'll need to either:
1. Update your user role in the database to `SUPER_ADMIN` or `ADMIN`
2. Or ask an admin to grant you access

## To update your role (if you have database access):

```sql
-- Check current role
SELECT id, name, email, role FROM users WHERE email = 'your-email@example.com';

-- Update to SUPER_ADMIN
UPDATE users SET role = 'SUPER_ADMIN' WHERE email = 'your-email@example.com';
```

After updating, log out and log back in.

