-- Add missing currency and price list fields to quotation_lines table

-- Step 1: Add unitPriceCurrency column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'quotation_lines' 
        AND column_name = 'unitPriceCurrency'
    ) THEN
        ALTER TABLE "quotation_lines" ADD COLUMN "unitPriceCurrency" TEXT;
    END IF;
END$$;

-- Step 2: Add fxRateUsed column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'quotation_lines' 
        AND column_name = 'fxRateUsed'
    ) THEN
        ALTER TABLE "quotation_lines" ADD COLUMN "fxRateUsed" DOUBLE PRECISION;
    END IF;
END$$;

-- Step 3: Add priceListIdUsed column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'quotation_lines' 
        AND column_name = 'priceListIdUsed'
    ) THEN
        ALTER TABLE "quotation_lines" ADD COLUMN "priceListIdUsed" TEXT;
    END IF;
END$$;

