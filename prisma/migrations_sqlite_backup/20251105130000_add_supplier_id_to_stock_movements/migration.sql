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

-- Step 3: Add supplierId column to stock_movements if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stock_movements' 
        AND column_name = 'supplierId'
    ) THEN
        ALTER TABLE "stock_movements" ADD COLUMN "supplierId" TEXT;
    END IF;
END$$;

-- Step 4: Add foreign key only if suppliers table exists and constraint doesn't exist
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'suppliers'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'stock_movements_supplierId_fkey'
        AND table_name = 'stock_movements'
    ) THEN
        ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_supplierId_fkey" 
        FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END$$;

