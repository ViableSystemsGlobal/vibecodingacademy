-- CreateTable
CREATE TABLE "storefront_sections" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "key" TEXT NOT NULL UNIQUE,
  "title" TEXT,
  "subtitle" TEXT,
  "description" TEXT,
  "ctaText" TEXT,
  "ctaLink" TEXT,
  "gradient" TEXT,
  "media" JSON,
  "content" JSON,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Update timestamp on change
CREATE OR REPLACE FUNCTION update_storefront_sections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "storefront_sections_updatedAt"
BEFORE UPDATE ON "storefront_sections"
FOR EACH ROW
EXECUTE FUNCTION update_storefront_sections_updated_at();
