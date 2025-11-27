const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addEnums() {
  try {
    console.log('Creating EcommerceOrderStatus enum...');
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EcommerceOrderStatus') THEN
              CREATE TYPE "EcommerceOrderStatus" AS ENUM (
                  'PENDING',
                  'CONFIRMED',
                  'PROCESSING',
                  'SHIPPED',
                  'DELIVERED',
                  'CANCELLED'
              );
              RAISE NOTICE 'Created EcommerceOrderStatus enum';
          ELSE
              RAISE NOTICE 'EcommerceOrderStatus enum already exists';
          END IF;
      END$$;
    `);

    console.log('Creating EcommercePaymentStatus enum...');
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EcommercePaymentStatus') THEN
              CREATE TYPE "EcommercePaymentStatus" AS ENUM (
                  'PENDING',
                  'PAID',
                  'FAILED',
                  'REFUNDED',
                  'PARTIALLY_REFUNDED'
              );
              RAISE NOTICE 'Created EcommercePaymentStatus enum';
          ELSE
              RAISE NOTICE 'EcommercePaymentStatus enum already exists';
          END IF;
      END$$;
    `);

    console.log('✅ Enums created successfully!');
  } catch (error) {
    console.error('❌ Error creating enums:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

addEnums();

