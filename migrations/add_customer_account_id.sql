-- Migration: Add accountId to Customer table
-- This links Customer (ecommerce) to Account (CRM/B2B) for simplified customer management

-- Add accountId column to customers table
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "accountId" TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS "customers_accountId_idx" ON "customers"("accountId");

-- Add foreign key constraint
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'customers_accountId_fkey'
    ) THEN
        ALTER TABLE "customers" 
        ADD CONSTRAINT "customers_accountId_fkey" 
        FOREIGN KEY ("accountId") 
        REFERENCES "accounts"("id") 
        ON DELETE SET NULL;
    END IF;
END $$;

-- Note: Existing customers will have accountId = NULL
-- The checkout flow will automatically link new customers to accounts
-- For existing customers, you may want to run a script to link them based on email matching

