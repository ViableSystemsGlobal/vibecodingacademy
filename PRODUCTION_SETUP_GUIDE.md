# Production Setup Guide

Complete step-by-step guide to deploy Vibe Coding Academy to production.

## Prerequisites

- Server with Docker and Docker Compose installed
- Domain name configured
- SSL certificate (Let's Encrypt recommended)
- Access to production database (PostgreSQL)

---

## Step 1: Generate Security Secrets

```bash
# Generate JWT secrets
openssl rand -base64 32  # Use for JWT_SECRET
openssl rand -base64 32  # Use for JWT_REFRESH_SECRET

# Save these securely - you'll need them for .env file
```

---

## Step 2: Configure Environment Variables

### Backend Environment Variables

1. Copy the example file:
```bash
cd backend
cp .env.production.example .env
```

2. Edit `.env` with your production values:

```env
# Server
NODE_ENV=production
PORT=3005
FRONTEND_URL=https://yourdomain.com

# Database
DATABASE_URL=postgresql://user:password@host:5432/vibe_coding_academy?schema=public

# JWT (use the secrets you generated)
JWT_SECRET=your-generated-secret-here
JWT_REFRESH_SECRET=your-generated-refresh-secret-here

# SMTP (Email)
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@yourdomain.com
SMTP_PASS=your-smtp-password
SMTP_FROM=your-email@yourdomain.com

# Deywuro SMS
DEYWURO_USERNAME=your-username
DEYWURO_PASSWORD=your-password
DEYWURO_SENDER=YOUR_SENDER_ID

# Paystack (USE LIVE KEYS!)
PAYSTACK_SECRET_KEY=sk_live_your-live-secret-key
PAYSTACK_PUBLIC_KEY=pk_live_your-live-public-key
PAYSTACK_WEBHOOK_SECRET=your-webhook-secret
```

### Frontend Environment Variables

1. Create `.env.production.local`:
```bash
cd frontend
cat > .env.production.local << EOF
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
EOF
```

---

## Step 3: Configure Paystack Webhook

1. Log in to your Paystack dashboard
2. Go to Settings → API Keys & Webhooks
3. Add Webhook URL: `https://yourdomain.com/webhooks/paystack`
4. Subscribe to events:
   - `charge.success`
   - `charge.failed`
   - `transaction.success`
   - `transaction.failed`
5. Copy the webhook secret and add to `PAYSTACK_WEBHOOK_SECRET` in `.env`

---

## Step 4: Set Up Database

### Option A: Using Docker (Recommended for EasyPanel)

The database will be created automatically by Docker Compose.

### Option B: External Database

1. Create production database:
```sql
CREATE DATABASE vibe_coding_academy;
CREATE USER vibe_user WITH PASSWORD 'strong-password';
GRANT ALL PRIVILEGES ON DATABASE vibe_coding_academy TO vibe_user;
```

2. Update `DATABASE_URL` in `.env`

---

## Step 5: Deploy Application

### Using the Deployment Script

```bash
# Make scripts executable
chmod +x scripts/*.sh

# Run deployment
./scripts/deploy.sh
```

### Manual Deployment

```bash
# Build and start services
docker-compose -f docker-compose.prod.yml up -d --build

# Run migrations
docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy

# Generate Prisma client
docker-compose -f docker-compose.prod.yml exec backend npx prisma generate
```

---

## Step 6: Set Up Reverse Proxy (Nginx)

Create `/etc/nginx/sites-available/vibecodingacademy`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3005;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Webhooks (Paystack)
    location /webhooks {
        proxy_pass http://localhost:3005;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static files (uploads)
    location /uploads {
        proxy_pass http://localhost:3005;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/vibecodingacademy /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Step 7: Set Up SSL Certificate

### Using Let's Encrypt (Free)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Certbot will automatically configure Nginx and set up auto-renewal.

---

## Step 8: Set Up Automated Backups

### Option 1: Cron Job

Add to crontab (`crontab -e`):

```bash
# Daily backup at 2 AM
0 2 * * * cd /path/to/vibecodingacademy && ./scripts/backup-database.sh
```

### Option 2: Systemd Timer (Recommended)

Create `/etc/systemd/system/vibecoding-backup.service`:

```ini
[Unit]
Description=Vibe Coding Academy Database Backup
After=network.target

[Service]
Type=oneshot
User=your-user
WorkingDirectory=/path/to/vibecodingacademy
ExecStart=/path/to/vibecodingacademy/scripts/backup-database.sh
```

Create `/etc/systemd/system/vibecoding-backup.timer`:

```ini
[Unit]
Description=Daily backup for Vibe Coding Academy
Requires=vibecoding-backup.service

[Timer]
OnCalendar=daily
OnCalendar=02:00
Persistent=true

[Install]
WantedBy=timers.target
```

Enable:
```bash
sudo systemctl enable vibecoding-backup.timer
sudo systemctl start vibecoding-backup.timer
```

---

## Step 9: Verify Deployment

1. **Check Services:**
```bash
docker-compose -f docker-compose.prod.yml ps
```

2. **Check Health:**
```bash
curl https://yourdomain.com/api/health
```

3. **Test Frontend:**
- Visit `https://yourdomain.com`
- Verify logo displays
- Test registration form

4. **Test Backend:**
- Visit `https://yourdomain.com/admin/login`
- Log in with admin credentials
- Verify dashboard loads

5. **Test Payment:**
- Create a test registration
- Complete payment flow
- Verify webhook receives payment

6. **Test Email/SMS:**
- Use admin settings to send test email
- Use admin settings to send test SMS
- Verify delivery

---

## Step 10: Post-Deployment Checklist

- [ ] All services running
- [ ] SSL certificate active
- [ ] Frontend accessible
- [ ] Admin login works
- [ ] Payment webhook configured
- [ ] Email delivery working
- [ ] SMS delivery working
- [ ] Backups configured
- [ ] Monitoring set up (optional)
- [ ] Default admin password changed

---

## Troubleshooting

### Services Not Starting

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs

# Restart services
docker-compose -f docker-compose.prod.yml restart
```

### Database Connection Issues

```bash
# Test database connection
docker-compose -f docker-compose.prod.yml exec backend npx prisma db pull

# Check database URL in .env
```

### Migration Issues

```bash
# Reset migrations (CAUTION: Only in development)
docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate reset

# Deploy migrations
docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

### CORS Errors

- Verify `FRONTEND_URL` in `.env` matches your domain
- Check Nginx proxy headers
- Review browser console for specific errors

---

## Maintenance

### Update Application

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose -f docker-compose.prod.yml up -d --build

# Run migrations if needed
docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

### View Logs

```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f backend
```

### Restore from Backup

```bash
./scripts/restore-database.sh ./backups/db_backup_YYYYMMDD_HHMMSS.sql.gz
```

---

## Support

For issues or questions:
1. Check logs: `docker-compose -f docker-compose.prod.yml logs`
2. Review PRODUCTION_READINESS_REPORT.md
3. Check PRODUCTION_CHECKLIST.md

---

**You're now ready for production! 🚀**

