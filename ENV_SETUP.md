# Environment Variables Setup

## Backend Environment Variables

Create a `.env` file in the `backend/` directory with the following variables:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/vibe_coding_academy?schema=public

# Server
PORT=3005
NODE_ENV=development
FRONTEND_URL=http://localhost:3004

# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Email Configuration (SMTP)
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@yourdomain.com
SMTP_PASS=your-email-password
SMTP_FROM=noreply@yourdomain.com

# SMS Configuration (Deywuro)
DEYWURO_USERNAME=your-deywuro-username
DEYWURO_PASSWORD=your-deywuro-password
DEYWURO_SENDER=your-sender-name

# Payment Gateway (Paystack)
PAYSTACK_SECRET_KEY=sk_test_your_paystack_secret_key
PAYSTACK_PUBLIC_KEY=pk_test_your_paystack_public_key
PAYSTACK_WEBHOOK_SECRET=your_webhook_secret
```

## Frontend Environment Variables

Create a `.env.local` file in the `frontend/` directory with the following variables:

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3005
```

## Production Configuration

### Important Notes for Production:

1. **JWT Secrets**: Must be strong, random strings (at least 32 characters)
   - Generate using: `openssl rand -base64 32`
   - Never commit these to version control

2. **NODE_ENV**: Set to `production` in production

3. **FRONTEND_URL**: Set to your production frontend URL (e.g., `https://yourdomain.com`)

4. **CORS**: The backend automatically allows the FRONTEND_URL in production

5. **Database**: Use a production PostgreSQL database, not localhost

6. **Payment Keys**: Use production Paystack keys (not test keys)

## Security Checklist

- [ ] All secrets are in environment variables (not hardcoded)
- [ ] JWT secrets are strong and unique
- [ ] Database credentials are secure
- [ ] Payment keys are production keys
- [ ] Email/SMS credentials are configured
- [ ] FRONTEND_URL matches your production domain
- [ ] NODE_ENV is set to `production`

