-- AlterTable
ALTER TABLE "quotations" ADD COLUMN "priceListId" TEXT;

-- AddForeignKey (if quotations table doesn't already have this FK)
-- Check if foreign key exists first to avoid errors
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'quotations_priceListId_fkey'
        AND table_name = 'quotations'
    ) THEN
        ALTER TABLE "quotations" ADD CONSTRAINT "quotations_priceListId_fkey" 
        FOREIGN KEY ("priceListId") REFERENCES "price_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END$$;

