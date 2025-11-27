-- Ensure ecommerce_category_configs table exists (needed when migrating from scratch)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'ecommerce_category_configs'
    ) THEN
        CREATE TABLE "ecommerce_category_configs" (
            "id" TEXT PRIMARY KEY,
            "categoryId" TEXT NOT NULL UNIQUE,
            "isFeatured" BOOLEAN NOT NULL DEFAULT FALSE,
            "displayOrder" INTEGER NOT NULL DEFAULT 0,
            "heroImageUrl" TEXT,
            "tileImageUrl" TEXT,
            "marketingTagline" TEXT,
            "merchandisingNotes" TEXT,
            "opsNotes" TEXT,
            "aiPrompt" TEXT,
            "updatedBy" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "ecommerce_category_configs_categoryId_fkey"
                FOREIGN KEY ("categoryId") REFERENCES "categories"("id")
                ON DELETE CASCADE ON UPDATE CASCADE
        );
    END IF;
END$$;

-- Add the tileImageUrl column when migrating from earlier SQLite schema
ALTER TABLE "ecommerce_category_configs"
    ADD COLUMN IF NOT EXISTS "tileImageUrl" TEXT;
