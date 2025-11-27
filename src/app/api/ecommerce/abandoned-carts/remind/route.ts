import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmailViaSMTP, getCompanyName } from "@/lib/payment-order-notifications";
import { convertCurrency } from "@/lib/currency";

// Helper function to get setting value from database
async function getSettingValue(key: string, defaultValue: string = ''): Promise<string> {
  try {
    const setting = await prisma.systemSettings.findUnique({
      where: { key },
      select: { value: true }
    });
    return setting?.value || defaultValue;
  } catch (error) {
    console.error(`Error fetching setting ${key}:`, error);
    return defaultValue;
  }
}

// POST /api/ecommerce/abandoned-carts/remind - Send abandoned cart reminder emails
// This should be called by a cron job (e.g., every 6-24 hours)
export async function POST(request: NextRequest) {
  try {
    // Check if abandoned cart reminders are enabled
    const sendAbandonedCartReminders = (await getSettingValue("ECOMMERCE_SEND_ABANDONED_CART_REMINDERS", "false")) === "true";
    
    if (!sendAbandonedCartReminders) {
      return NextResponse.json({
        success: true,
        message: "Abandoned cart reminders are disabled",
        cartsProcessed: 0
      });
    }

    // Get hours threshold from settings (default: 24 hours)
    const reminderDelayHours = parseInt(await getSettingValue("ECOMMERCE_ABANDONED_CART_DELAY_HOURS", "24"));
    const reminderDelayMs = reminderDelayHours * 60 * 60 * 1000;
    const cutoffTime = new Date(Date.now() - reminderDelayMs);

    // Find abandoned carts that:
    // 1. Haven't been converted to orders
    // 2. Haven't been updated recently (older than cutoff time)
    // 3. Either haven't received a reminder OR haven't received a reminder in the last 48 hours (for repeat reminders)
    const abandonedCarts = await prisma.abandonedCart.findMany({
      where: {
        convertedToOrder: false,
        lastActivityAt: {
          lt: cutoffTime
        },
        OR: [
          { reminderSentAt: null }, // Never sent a reminder
          { 
            reminderSentAt: {
              lt: new Date(Date.now() - 48 * 60 * 60 * 1000) // Last reminder was more than 48 hours ago
            }
          }
        ]
      },
      include: {
        customer: {
          select: {
            email: true,
            firstName: true,
            lastName: true
          }
        }
      },
      take: 100 // Limit to 100 carts per run to avoid overwhelming the system
    });

    if (abandonedCarts.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No abandoned carts found to send reminders for",
        cartsProcessed: 0
      });
    }

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const cart of abandonedCarts) {
      try {
        // Get customer email - prefer from customer record, fallback to cart email
        const customerEmail = cart.customer?.email || cart.customerEmail;
        const customerName = cart.customer 
          ? `${cart.customer.firstName} ${cart.customer.lastName}`
          : cart.customerName || "Valued Customer";

        if (!customerEmail) {
          console.log(`Skipping cart ${cart.cartSessionId}: No email available`);
          continue;
        }

        // Get cart items and fetch product details
        const items = Array.isArray(cart.items) ? cart.items : [];
        const total = Number(cart.total || 0);
        const currency = cart.currency || "GHS";

        // Fetch product details for items
        const itemsWithDetails = await Promise.all(
          items.slice(0, 5).map(async (item: any) => {
            try {
              const product = await prisma.product.findUnique({
                where: { id: item.productId },
                select: { name: true, price: true, baseCurrency: true, originalPriceCurrency: true }
              });
              
              if (product) {
                let price = product.price || 0;
                const baseCurrency = product.baseCurrency || "GHS";
                
                // Convert price to GHS if needed
                if (baseCurrency !== "GHS" && price) {
                  const priceConversion = await convertCurrency(baseCurrency, "GHS", price);
                  if (priceConversion) {
                    price = priceConversion.convertedAmount;
                  }
                }
                
                return {
                  name: product.name || "Product",
                  quantity: item.quantity || 1,
                  price,
                  lineTotal: price * (item.quantity || 1)
                };
              }
            } catch (e) {
              // Skip items with errors
            }
            return null;
          })
        );

        // Format total amount
        const formattedTotal = new Intl.NumberFormat('en-GH', {
          style: 'currency',
          currency: currency,
          minimumFractionDigits: 2
        }).format(total);

        // Create email content
        const companyName = await getCompanyName();
        const emailSubject = `Complete Your Purchase - Items Waiting in Your Cart`;
        
        let itemsList = "";
        const validItems = itemsWithDetails.filter(item => item !== null);
        if (validItems.length > 0) {
          itemsList = validItems.map((item: any) => {
            return `- ${item.name} (Qty: ${item.quantity}) - ${new Intl.NumberFormat('en-GH', {
              style: 'currency',
              currency: currency
            }).format(item.lineTotal)}`;
          }).join('\n');
          
          if (items.length > 5) {
            itemsList += `\n- ... and ${items.length - 5} more item(s)`;
          }
        }

        const emailMessage = `Dear ${customerName},

We noticed you left some items in your shopping cart and wanted to remind you about them!

Your Cart Summary:
${itemsList || "Your cart items"}

Cart Total: ${formattedTotal}

Don't miss out! Complete your purchase now:
${process.env.NEXT_PUBLIC_APP_URL || "https://your-store.com"}/shop/cart

${items.length > 0 ? `You have ${items.length} ${items.length === 1 ? 'item' : 'items'} waiting for you.` : ''}

This reminder will expire in 7 days. If you've already completed your purchase, please ignore this email.

Thank you for considering us!

Best regards,
${companyName || "Store Team"}`;

        // Send reminder email
        const emailResult = await sendEmailViaSMTP(customerEmail, emailSubject, emailMessage);
        
        if (emailResult.success) {
          // Update cart to mark reminder as sent
          await prisma.abandonedCart.update({
            where: { id: cart.id },
            data: {
              reminderSentAt: new Date(),
              reminderCount: (cart.reminderCount || 0) + 1
            }
          });
          
          successCount++;
          results.push({
            cartId: cart.id,
            cartSessionId: cart.cartSessionId,
            email: customerEmail,
            status: "sent"
          });
          
          console.log(`✅ Abandoned cart reminder sent to ${customerEmail} for cart ${cart.cartSessionId}`);
        } else {
          errorCount++;
          results.push({
            cartId: cart.id,
            cartSessionId: cart.cartSessionId,
            email: customerEmail,
            status: "failed",
            error: emailResult.error
          });
          
          console.error(`❌ Failed to send abandoned cart reminder to ${customerEmail}: ${emailResult.error}`);
        }
      } catch (error) {
        errorCount++;
        console.error(`Error processing abandoned cart ${cart.id}:`, error);
        results.push({
          cartId: cart.id,
          cartSessionId: cart.cartSessionId,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${abandonedCarts.length} abandoned carts`,
      cartsProcessed: abandonedCarts.length,
      successful: successCount,
      failed: errorCount,
      results
    });
  } catch (error) {
    console.error("Error processing abandoned cart reminders:", error);
    return NextResponse.json(
      { 
        error: "Failed to process abandoned cart reminders",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

