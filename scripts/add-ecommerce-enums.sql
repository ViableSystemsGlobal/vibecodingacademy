-- Create EcommerceOrderStatus enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EcommerceOrderStatus') THEN
        CREATE TYPE "public"."EcommerceOrderStatus" AS ENUM (
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

-- Create EcommercePaymentStatus enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EcommercePaymentStatus') THEN
        CREATE TYPE "public"."EcommercePaymentStatus" AS ENUM (
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

