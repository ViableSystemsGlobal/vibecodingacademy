ALTER TABLE "categories"
    ADD COLUMN "slug" TEXT,
    ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN "marketingTagline" TEXT,
    ADD COLUMN "heroImageUrl" TEXT,
    ADD COLUMN "merchandisingNotes" TEXT,
    ADD COLUMN "operationsNotes" TEXT,
    ADD COLUMN "aiPrompt" TEXT,
    ADD COLUMN "ecommercePriority" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS "categories_slug_key" ON "categories"("slug") WHERE "slug" IS NOT NULL;
