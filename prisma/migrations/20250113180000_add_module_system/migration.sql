-- CreateModuleSystem
-- CreateModuleSystem

-- CreateTable
CREATE TABLE IF NOT EXISTS "modules" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "alias" TEXT,
    "description" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "priority" INTEGER NOT NULL DEFAULT 1000,
    "category" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "monthlyPrice" DECIMAL(65,30),
    "yearlyPrice" DECIMAL(65,30),
    "packageName" TEXT,
    "image" TEXT,
    "featureFlags" TEXT[],
    "parentModuleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "user_module_activations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedBy" TEXT,

    CONSTRAINT "user_module_activations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "modules_slug_key" ON "modules"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "modules_slug_idx" ON "modules"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "modules_isEnabled_idx" ON "modules"("isEnabled");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "modules_category_idx" ON "modules"("category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "modules_priority_idx" ON "modules"("priority");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "user_module_activations_userId_moduleId_key" ON "user_module_activations"("userId", "moduleId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "user_module_activations_userId_idx" ON "user_module_activations"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "user_module_activations_moduleId_idx" ON "user_module_activations"("moduleId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'modules_parentModuleId_fkey'
        AND table_name = 'modules'
    ) THEN
        ALTER TABLE "modules" ADD CONSTRAINT "modules_parentModuleId_fkey" FOREIGN KEY ("parentModuleId") REFERENCES "modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END$$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'user_module_activations_userId_fkey'
        AND table_name = 'user_module_activations'
    ) THEN
        ALTER TABLE "user_module_activations" ADD CONSTRAINT "user_module_activations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'user_module_activations_moduleId_fkey'
        AND table_name = 'user_module_activations'
    ) THEN
        ALTER TABLE "user_module_activations" ADD CONSTRAINT "user_module_activations_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;

