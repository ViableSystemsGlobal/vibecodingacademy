-- Step 1: Create SupplierStatus enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SupplierStatus') THEN
        CREATE TYPE "public"."SupplierStatus" AS ENUM ('ACTIVE', 'INACTIVE');
    END IF;
END$$;

-- Step 2: Create suppliers table if it doesn't exist
CREATE TABLE IF NOT EXISTS "public"."suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT DEFAULT 'Ghana',
    "taxId" TEXT,
    "paymentTerms" TEXT,
    "status" "public"."SupplierStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- Step 3: Create index on suppliers name if it doesn't exist (for faster lookups)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'suppliers' 
        AND indexname = 'suppliers_name_idx'
    ) THEN
        CREATE INDEX "suppliers_name_idx" ON "public"."suppliers"("name");
    END IF;
END$$;

