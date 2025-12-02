# Customer Account Linking Implementation

## Overview
This implementation links the `Customer` (ecommerce) table to the `Account` (CRM/B2B) table, simplifying customer management and eliminating the complex lookup logic.

## Changes Made

### 1. Database Schema
- Added `accountId` field to `Customer` model
- Added relation: `Customer.account` → `Account`
- Added index on `accountId` for faster lookups

### 2. Checkout Flow
- Updated `/api/public/shop/checkout/route.ts` to automatically link Customer to Account during checkout
- When a customer checks out, if they have an account, it's automatically linked

### 3. Password Management
- Created `/api/public/shop/account/change-password/route.ts` for password changes
- Updated customer profile page to use the new password change endpoint
- Customers can now change their password from their account settings

### 4. Google reCAPTCHA
- Added reCAPTCHA verification to customer login
- Added reCAPTCHA verification to customer signup
- Created `/lib/recaptcha.ts` utility for server-side verification

## Environment Variables Required

Add these to your `.env` file:

```env
# Google reCAPTCHA v3
NEXT_PUBLIC_GOOGLE_RECAPTCHA_SITE_KEY=your_site_key_here
GOOGLE_RECAPTCHA_SECRET_KEY=your_secret_key_here
```

## Setup Instructions

### 1. Get Google reCAPTCHA Keys
1. Go to https://www.google.com/recaptcha/admin
2. Create a new site (reCAPTCHA v3)
3. Add your domain
4. Copy the Site Key and Secret Key
5. Add them to your `.env` file

### 2. Run Database Migration
```bash
# Generate Prisma client
npx prisma generate

# Create and apply migration
npx prisma migrate dev --name add_customer_account_id

# Or if using production database
npx prisma migrate deploy
```

### 3. Link Existing Customers (Optional)
If you have existing customers, you may want to link them to accounts based on email matching:

```sql
UPDATE customers c
SET "accountId" = a.id
FROM accounts a
WHERE c.email = a.email
AND c."accountId" IS NULL;
```

## How It Works

### Customer Registration/Login Flow
1. Customer registers/logs in → `Customer` record created/accessed
2. Customer places order → System creates/finds `Account` by email
3. System automatically links: `Customer.accountId = Account.id`

### Finding Ecommerce Customers (Simplified)
Instead of the complex multi-table lookup, you can now simply:

```typescript
// Get all ecommerce customers
const customers = await prisma.customer.findMany({
  where: {
    accountId: { not: null }
  },
  include: {
    account: true
  }
});

// Or get account from customer
const customer = await prisma.customer.findUnique({
  where: { email: "customer@example.com" },
  include: { account: true }
});
```

## Benefits

1. **Simplified Queries**: Direct relationship instead of email matching
2. **Better Performance**: Indexed foreign key relationship
3. **Data Integrity**: Foreign key constraint ensures valid links
4. **Easier Management**: One source of truth for customer-account relationship

## Testing

1. Register a new customer → Check that `Customer.accountId` is set after first order
2. Login with existing customer → Should work normally
3. Change password → Should update successfully
4. reCAPTCHA → Should verify on login/signup (if keys are configured)

## Notes

- In development, if reCAPTCHA keys are not set, the system will skip verification
- In production, reCAPTCHA verification is required if `GOOGLE_RECAPTCHA_SECRET_KEY` is set
- Existing customers without accounts will have `accountId = null` until they place an order

