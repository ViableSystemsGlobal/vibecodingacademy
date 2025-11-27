import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Helper function to get setting value
async function getSettingValue(key: string, defaultValue: string = ""): Promise<string> {
  try {
    const setting = await prisma.systemSettings.findUnique({
      where: { key },
    });
    return setting?.value || defaultValue;
  } catch (error) {
    console.error(`Error getting setting ${key}:`, error);
    return defaultValue;
  }
}

// Helper function to set setting value
async function setSettingValue(
  key: string,
  value: string,
  category: string = "ecommerce",
  description?: string
): Promise<void> {
  await prisma.systemSettings.upsert({
    where: { key },
    update: {
      value,
      category,
      description,
      updatedAt: new Date(),
    },
    create: {
      key,
      value,
      type: typeof value === "boolean" ? "boolean" : typeof value === "number" ? "number" : "string",
      category,
      description,
    },
  });
}

// GET /api/ecommerce/settings - Get all ecommerce settings
export async function GET() {
  try {
    const settings = {
      // Store Configuration
      storeName: await getSettingValue("ECOMMERCE_STORE_NAME", ""),
      storeDescription: await getSettingValue("ECOMMERCE_STORE_DESCRIPTION", ""),
      storeTagline: await getSettingValue("ECOMMERCE_STORE_TAGLINE", ""),
      storeStatus: await getSettingValue("ECOMMERCE_STORE_STATUS", "active"), // active, maintenance
      storeEmail: await getSettingValue("ECOMMERCE_STORE_EMAIL", ""),
      storePhone: await getSettingValue("ECOMMERCE_STORE_PHONE", ""),
      
      // Checkout & Payment
      paymentMethods: await getSettingValue("ECOMMERCE_PAYMENT_METHODS", "ONLINE,CASH,BANK_TRANSFER,MOBILE_MONEY"), // Comma-separated
      minimumOrderAmount: parseFloat(await getSettingValue("ECOMMERCE_MIN_ORDER_AMOUNT", "0")),
      freeShippingThreshold: parseFloat(await getSettingValue("ECOMMERCE_FREE_SHIPPING_THRESHOLD", "500")),
      taxRate: parseFloat(await getSettingValue("ECOMMERCE_TAX_RATE", "12.5")),
      currency: await getSettingValue("ECOMMERCE_CURRENCY", "GHS"),
      
      // Order Management
      autoConfirmOrders: (await getSettingValue("ECOMMERCE_AUTO_CONFIRM_ORDERS", "false")) === "true",
      defaultOrderStatus: await getSettingValue("ECOMMERCE_DEFAULT_ORDER_STATUS", "PROCESSING"),
      inventoryReservationDuration: parseInt(await getSettingValue("ECOMMERCE_INVENTORY_RESERVATION_DURATION", "24")), // hours
      lowStockThreshold: parseInt(await getSettingValue("ECOMMERCE_LOW_STOCK_THRESHOLD", "5")),
      orderNumberPrefix: await getSettingValue("ECOMMERCE_ORDER_NUMBER_PREFIX", "ORD"),
      
      // Customer Settings
      requireAccountCreation: (await getSettingValue("ECOMMERCE_REQUIRE_ACCOUNT_CREATION", "false")) === "true",
      allowGuestCheckout: (await getSettingValue("ECOMMERCE_ALLOW_GUEST_CHECKOUT", "true")) === "true",
      requireEmailVerification: (await getSettingValue("ECOMMERCE_REQUIRE_EMAIL_VERIFICATION", "false")) === "true",
      
      // Storefront Display
      productsPerPage: parseInt(await getSettingValue("ECOMMERCE_PRODUCTS_PER_PAGE", "12")),
      defaultSorting: await getSettingValue("ECOMMERCE_DEFAULT_SORTING", "newest"), // newest, price-asc, price-desc, name
      showOutOfStock: (await getSettingValue("ECOMMERCE_SHOW_OUT_OF_STOCK", "true")) === "true",
      
      // Email Notifications
      sendOrderConfirmation: (await getSettingValue("ECOMMERCE_SEND_ORDER_CONFIRMATION", "true")) === "true",
      sendShippingNotifications: (await getSettingValue("ECOMMERCE_SEND_SHIPPING_NOTIFICATIONS", "true")) === "true",
      sendOrderStatusUpdates: (await getSettingValue("ECOMMERCE_SEND_ORDER_STATUS_UPDATES", "true")) === "true",
      sendAbandonedCartReminders: (await getSettingValue("ECOMMERCE_SEND_ABANDONED_CART_REMINDERS", "false")) === "true",
      abandonedCartDelayHours: parseInt(await getSettingValue("ECOMMERCE_ABANDONED_CART_DELAY_HOURS", "24")),
      
      // Legal & Policies
      termsAndConditionsUrl: await getSettingValue("ECOMMERCE_TERMS_URL", ""),
      privacyPolicyUrl: await getSettingValue("ECOMMERCE_PRIVACY_URL", ""),
      returnPolicyUrl: await getSettingValue("ECOMMERCE_RETURN_POLICY_URL", ""),
      cookieConsentEnabled: (await getSettingValue("ECOMMERCE_COOKIE_CONSENT_ENABLED", "true")) === "true",
      
      // Paystack Configuration
      paystackPublicKey: await getSettingValue("PAYSTACK_PUBLIC_KEY", ""),
      paystackSecretKey: await getSettingValue("PAYSTACK_SECRET_KEY", ""),
      paystackMode: await getSettingValue("PAYSTACK_MODE", "live"), // test or live
    };

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error fetching ecommerce settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch ecommerce settings" },
      { status: 500 }
    );
  }
}

// POST /api/ecommerce/settings - Update ecommerce settings
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Store Configuration
    if (body.storeName !== undefined) {
      await setSettingValue("ECOMMERCE_STORE_NAME", body.storeName, "ecommerce", "Store name");
    }
    if (body.storeDescription !== undefined) {
      await setSettingValue("ECOMMERCE_STORE_DESCRIPTION", body.storeDescription, "ecommerce", "Store description");
    }
    if (body.storeTagline !== undefined) {
      await setSettingValue("ECOMMERCE_STORE_TAGLINE", body.storeTagline, "ecommerce", "Store tagline");
    }
    if (body.storeStatus !== undefined) {
      await setSettingValue("ECOMMERCE_STORE_STATUS", body.storeStatus, "ecommerce", "Store status");
    }
    if (body.storeEmail !== undefined) {
      await setSettingValue("ECOMMERCE_STORE_EMAIL", body.storeEmail, "ecommerce", "Store contact email");
    }
    if (body.storePhone !== undefined) {
      await setSettingValue("ECOMMERCE_STORE_PHONE", body.storePhone, "ecommerce", "Store contact phone");
    }

    // Checkout & Payment
    if (body.paymentMethods !== undefined) {
      await setSettingValue("ECOMMERCE_PAYMENT_METHODS", body.paymentMethods, "ecommerce", "Enabled payment methods");
    }
    if (body.minimumOrderAmount !== undefined) {
      await setSettingValue("ECOMMERCE_MIN_ORDER_AMOUNT", String(body.minimumOrderAmount), "ecommerce", "Minimum order amount");
    }
    if (body.freeShippingThreshold !== undefined) {
      await setSettingValue("ECOMMERCE_FREE_SHIPPING_THRESHOLD", String(body.freeShippingThreshold), "ecommerce", "Free shipping threshold");
    }
    if (body.taxRate !== undefined) {
      await setSettingValue("ECOMMERCE_TAX_RATE", String(body.taxRate), "ecommerce", "Tax/VAT rate percentage");
    }
    if (body.currency !== undefined) {
      await setSettingValue("ECOMMERCE_CURRENCY", body.currency, "ecommerce", "Store currency");
    }

    // Order Management
    if (body.autoConfirmOrders !== undefined) {
      await setSettingValue("ECOMMERCE_AUTO_CONFIRM_ORDERS", String(body.autoConfirmOrders), "ecommerce", "Auto-confirm orders");
    }
    if (body.defaultOrderStatus !== undefined) {
      await setSettingValue("ECOMMERCE_DEFAULT_ORDER_STATUS", body.defaultOrderStatus, "ecommerce", "Default order status");
    }
    if (body.inventoryReservationDuration !== undefined) {
      await setSettingValue("ECOMMERCE_INVENTORY_RESERVATION_DURATION", String(body.inventoryReservationDuration), "ecommerce", "Inventory reservation duration in hours");
    }
    if (body.lowStockThreshold !== undefined) {
      await setSettingValue("ECOMMERCE_LOW_STOCK_THRESHOLD", String(body.lowStockThreshold), "ecommerce", "Low stock threshold");
    }
    if (body.orderNumberPrefix !== undefined) {
      await setSettingValue("ECOMMERCE_ORDER_NUMBER_PREFIX", body.orderNumberPrefix, "ecommerce", "Order number prefix");
    }

    // Customer Settings
    if (body.requireAccountCreation !== undefined) {
      await setSettingValue("ECOMMERCE_REQUIRE_ACCOUNT_CREATION", String(body.requireAccountCreation), "ecommerce", "Require account creation");
    }
    if (body.allowGuestCheckout !== undefined) {
      await setSettingValue("ECOMMERCE_ALLOW_GUEST_CHECKOUT", String(body.allowGuestCheckout), "ecommerce", "Allow guest checkout");
    }
    if (body.requireEmailVerification !== undefined) {
      await setSettingValue("ECOMMERCE_REQUIRE_EMAIL_VERIFICATION", String(body.requireEmailVerification), "ecommerce", "Require email verification");
    }

    // Storefront Display
    if (body.productsPerPage !== undefined) {
      await setSettingValue("ECOMMERCE_PRODUCTS_PER_PAGE", String(body.productsPerPage), "ecommerce", "Products per page");
    }
    if (body.defaultSorting !== undefined) {
      await setSettingValue("ECOMMERCE_DEFAULT_SORTING", body.defaultSorting, "ecommerce", "Default product sorting");
    }
    if (body.showOutOfStock !== undefined) {
      await setSettingValue("ECOMMERCE_SHOW_OUT_OF_STOCK", String(body.showOutOfStock), "ecommerce", "Show out of stock products");
    }

    // Email Notifications
    if (body.sendOrderConfirmation !== undefined) {
      await setSettingValue("ECOMMERCE_SEND_ORDER_CONFIRMATION", String(body.sendOrderConfirmation), "ecommerce", "Send order confirmation emails");
    }
    if (body.sendShippingNotifications !== undefined) {
      await setSettingValue("ECOMMERCE_SEND_SHIPPING_NOTIFICATIONS", String(body.sendShippingNotifications), "ecommerce", "Send shipping notifications");
    }
    if (body.sendOrderStatusUpdates !== undefined) {
      await setSettingValue("ECOMMERCE_SEND_ORDER_STATUS_UPDATES", String(body.sendOrderStatusUpdates), "ecommerce", "Send order status updates");
    }
    if (body.sendAbandonedCartReminders !== undefined) {
      await setSettingValue("ECOMMERCE_SEND_ABANDONED_CART_REMINDERS", String(body.sendAbandonedCartReminders), "ecommerce", "Send abandoned cart reminders");
    }
    if (body.abandonedCartDelayHours !== undefined) {
      await setSettingValue("ECOMMERCE_ABANDONED_CART_DELAY_HOURS", String(body.abandonedCartDelayHours), "ecommerce", "Abandoned cart reminder delay (hours)");
    }

    // Legal & Policies
    if (body.termsAndConditionsUrl !== undefined) {
      await setSettingValue("ECOMMERCE_TERMS_URL", body.termsAndConditionsUrl, "ecommerce", "Terms and conditions URL");
    }
    if (body.privacyPolicyUrl !== undefined) {
      await setSettingValue("ECOMMERCE_PRIVACY_URL", body.privacyPolicyUrl, "ecommerce", "Privacy policy URL");
    }
    if (body.returnPolicyUrl !== undefined) {
      await setSettingValue("ECOMMERCE_RETURN_POLICY_URL", body.returnPolicyUrl, "ecommerce", "Return policy URL");
    }
    if (body.cookieConsentEnabled !== undefined) {
      await setSettingValue("ECOMMERCE_COOKIE_CONSENT_ENABLED", String(body.cookieConsentEnabled), "ecommerce", "Enable cookie consent");
    }

    // Paystack Configuration
    if (body.paystackPublicKey !== undefined) {
      await setSettingValue("PAYSTACK_PUBLIC_KEY", body.paystackPublicKey, "ecommerce", "Paystack public key");
    }
    if (body.paystackSecretKey !== undefined) {
      await setSettingValue("PAYSTACK_SECRET_KEY", body.paystackSecretKey, "ecommerce", "Paystack secret key");
    }
    if (body.paystackMode !== undefined) {
      await setSettingValue("PAYSTACK_MODE", body.paystackMode, "ecommerce", "Paystack mode (test/live)");
    }

    return NextResponse.json({ success: true, message: "Ecommerce settings updated successfully" });
  } catch (error) {
    console.error("Error updating ecommerce settings:", error);
    return NextResponse.json(
      { error: "Failed to update ecommerce settings" },
      { status: 500 }
    );
  }
}

