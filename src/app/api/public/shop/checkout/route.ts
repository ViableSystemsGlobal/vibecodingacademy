import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { verify } from "jsonwebtoken";
import { convertCurrency } from "@/lib/currency";
import { sendOrderCreatedNotifications } from "@/lib/payment-order-notifications";

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

// Helper to generate order number (uses prefix from settings)
async function generateOrderNumber(): Promise<string> {
  const prefix = await getSettingValue("ECOMMERCE_ORDER_NUMBER_PREFIX", "ORD");
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

async function generateSalesOrderNumber(
  tx: Prisma.TransactionClient
): Promise<string> {
  let attempts = 0;
  const maxAttempts = 10;
  let baseNumber = 1;

  const lastOrder = await tx.salesOrder.findFirst({
    orderBy: { createdAt: "desc" },
    select: { number: true },
  });

  if (lastOrder?.number) {
    const match = lastOrder.number.match(/\d+$/);
    if (match) {
      baseNumber = parseInt(match[0], 10) + 1;
    }
  }

  while (attempts < maxAttempts) {
    const orderNumber = `SO-${baseNumber.toString().padStart(6, "0")}`;

    const exists = await tx.salesOrder.findUnique({
      where: { number: orderNumber },
      select: { id: true },
    });

    if (!exists) {
      return orderNumber;
    }

    attempts += 1;
    baseNumber += 1;
  }

  return `SO-${Date.now().toString().slice(-6)}`;
}

// POST /api/public/shop/checkout - Process checkout
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      customer,
      shippingAddress,
      billingAddress,
      paymentMethod = "CASH",
      notes,
    } = body;

    // Validate required fields
    if (!customer || !customer.email || !customer.name) {
      return NextResponse.json(
        { error: "Customer information is required" },
        { status: 400 }
      );
    }

    if (!shippingAddress) {
      return NextResponse.json(
        { error: "Shipping address is required" },
        { status: 400 }
      );
    }

    // Get cart session
    const cookieStore = await cookies();
    const cartId = cookieStore.get("cart_session")?.value;
    
    if (!cartId) {
      return NextResponse.json(
        { error: "No cart found" },
        { status: 400 }
      );
    }

    const cartData = cookieStore.get(`cart_${cartId}`)?.value;
    const customerToken = cookieStore.get("customer_token")?.value;
    let sessionCustomer: { id?: string; email?: string } | null = null;

    if (customerToken) {
      try {
        const decoded: any = verify(
          customerToken,
          process.env.NEXTAUTH_SECRET || "adpools-secret-key-2024-production-change-me"
        );
        if (decoded?.type === "customer") {
          sessionCustomer = {
            id: decoded.id,
            email: decoded.email,
          };
        }
      } catch (error) {
        console.warn("Failed to verify customer token during checkout", error);
      }
    }
    
    if (!cartData) {
      return NextResponse.json(
        { error: "Cart is empty" },
        { status: 400 }
      );
    }

    const cart = JSON.parse(cartData);
    
    if (!cart.items || cart.items.length === 0) {
      return NextResponse.json(
        { error: "Cart is empty" },
        { status: 400 }
      );
    }

    // Check customer settings
    const requireAccountCreation = (await getSettingValue("ECOMMERCE_REQUIRE_ACCOUNT_CREATION", "false")) === "true";
    const allowGuestCheckout = (await getSettingValue("ECOMMERCE_ALLOW_GUEST_CHECKOUT", "true")) === "true";
    const requireEmailVerification = (await getSettingValue("ECOMMERCE_REQUIRE_EMAIL_VERIFICATION", "false")) === "true";

    // Enforce account creation requirement
    if (requireAccountCreation && !sessionCustomer?.id) {
      return NextResponse.json(
        { 
          error: "Account creation is required to checkout. Please create an account or log in.",
          requiresAccount: true
        },
        { status: 403 }
      );
    }

    // Enforce guest checkout restriction
    if (!allowGuestCheckout && !sessionCustomer?.id) {
      return NextResponse.json(
        { 
          error: "Guest checkout is not allowed. Please create an account or log in.",
          requiresAccount: true
        },
        { status: 403 }
      );
    }

    // Check email verification if required
    if (requireEmailVerification) {
      // If customer is logged in, check their email verification status
      if (sessionCustomer?.id) {
        try {
          const customer = await prisma.customer.findUnique({
            where: { id: sessionCustomer.id },
            select: { emailVerified: true, email: true }
          });
          
          if (customer && !customer.emailVerified) {
            return NextResponse.json(
              { 
                error: "Email verification is required. Please verify your email address before checkout.",
                requiresEmailVerification: true
              },
              { status: 403 }
            );
          }
        } catch (error: any) {
          // If customer table doesn't exist, skip email verification check
          if (error.code === 'P2021' || error.message?.includes('does not exist')) {
            console.warn('Customer table not found, skipping email verification check');
          }
        }
      } else {
        // If guest checkout, email verification can't be checked/enforced
        // Since requireAccountCreation should be true if email verification is required
        // This is a fallback check
        if (!requireAccountCreation) {
          console.warn('Email verification is required but guest checkout is allowed - this configuration may need review');
        }
      }
    }

    // Check minimum order amount from settings
    const minimumOrderAmount = parseFloat(await getSettingValue("ECOMMERCE_MIN_ORDER_AMOUNT", "0"));
    if (minimumOrderAmount > 0) {
      // Calculate cart total (we'll recalculate it properly later, but this is a quick check)
      let cartTotal = 0;
      for (const item of cart.items) {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          select: { price: true, baseCurrency: true, originalPriceCurrency: true }
        });
        if (product) {
          let priceInGHS = product.price || 0;
          const baseCurrency = product.baseCurrency || "GHS";
          if (baseCurrency !== "GHS" && product.price) {
            const priceConversion = await convertCurrency(baseCurrency, "GHS", product.price);
            if (priceConversion) {
              priceInGHS = priceConversion.convertedAmount;
            }
          }
          cartTotal += priceInGHS * item.quantity;
        }
      }
      const taxRateSetting = await getSettingValue("ECOMMERCE_TAX_RATE", "12.5");
      const taxRate = parseFloat(taxRateSetting) || 12.5;
      const tax = cartTotal * (taxRate / 100);
      const totalWithTax = cartTotal + tax;
      
      if (totalWithTax < minimumOrderAmount) {
        return NextResponse.json(
          { error: `Minimum order amount is ${minimumOrderAmount} GHS. Your order total is ${totalWithTax.toFixed(2)} GHS.` },
          { status: 400 }
        );
      }
    }

    // Check for ecommerce customer BEFORE transaction (to avoid aborting transaction)
    let ecommerceCustomerId: string | null = null;
    
    try {
      if (sessionCustomer?.id) {
        const ecommerceCustomer = await prisma.customer.findUnique({
          where: {
            id: sessionCustomer.id,
          },
        });
        if (ecommerceCustomer) {
          ecommerceCustomerId = ecommerceCustomer.id;
        }
      }

      if (!ecommerceCustomerId && customer.email) {
        const ecommerceCustomer = await prisma.customer.findUnique({
          where: {
            email: customer.email,
          },
        });
        if (ecommerceCustomer) {
          ecommerceCustomerId = ecommerceCustomer.id;
        }
      }
    } catch (error: any) {
      // If customer table doesn't exist (P2021 error), just continue without customer link
      if (error.code === 'P2021' || error.message?.includes('does not exist')) {
        console.warn('Customer table not found, continuing without customer link');
      } else {
        // Log other errors but don't fail checkout
        console.warn('Error looking up customer:', error);
      }
    }

    // Start transaction
    const result = await prisma.$transaction(async (tx) => {
      // Check if customer exists or create new lead
      let lead = await tx.lead.findFirst({
        where: {
          email: customer.email,
        },
      });

      // Get default system user (for owner assignment) - moved outside if block
      let systemUser = await tx.user.findFirst({
        where: {
          OR: [
            { role: "ADMIN" },
            { role: "SUPER_ADMIN" }
          ]
        },
      });

      // If no admin user found, create a default one
      if (!systemUser) {
        systemUser = await tx.user.create({
          data: {
            email: "system@thepoolshop.africa",
            name: "System User",
            role: "ADMIN",
          },
        });
      }

      if (!lead) {
        // Create new lead from customer
        const [firstName, ...lastNameParts] = customer.name.split(" ");
        const lastName = lastNameParts.join(" ") || firstName;

        lead = await tx.lead.create({
          data: {
            firstName,
            lastName,
            email: customer.email,
            phone: customer.phone || "",
            company: customer.company,
            status: "NEW",
            leadType: "INDIVIDUAL",
            source: "ECOMMERCE",
            subject: "Online Store Customer",
            ownerId: systemUser ? systemUser.id : "system",
            billingAddress: billingAddress || shippingAddress,
            shippingAddress: shippingAddress,
            hasBillingAddress: true,
            hasShippingAddress: true,
            sameAsBilling: !billingAddress,
          },
        });
      }

      // Find or create account linked to this customer
      let account = await tx.account.findFirst({
        where: {
          email: customer.email,
        },
      });

      if (!account) {
        const accountName = customer.company?.trim()
          ? customer.company.trim()
          : customer.name;
        const accountType = customer.company?.trim()
          ? "COMPANY"  // Use COMPANY instead of BUSINESS (matches AccountType enum)
          : "INDIVIDUAL";

        account = await tx.account.create({
          data: {
            name: accountName,
            type: accountType as "INDIVIDUAL" | "COMPANY" | "PROJECT",
            email: customer.email,
            phone: customer.phone || "",
            ownerId: systemUser ? systemUser.id : "system",
            notes: "Created automatically from ecommerce checkout.",
          },
        });

        const existingContact = await tx.contact.findFirst({
          where: {
            accountId: account.id,
            email: customer.email,
          },
        });

        if (!existingContact) {
          await tx.contact.create({
            data: {
              firstName: customer.name.split(" ")[0] || customer.name,
              lastName:
                customer.name.split(" ").slice(1).join(" ") || customer.name,
              email: customer.email,
              phone: customer.phone || "",
              role: "Primary Contact",
              accountId: account.id,
            },
          });
        }
      }

      // Create quotation from cart
      const quotationNumber = `QT-${Date.now().toString(36).toUpperCase()}`;
      
      // Get order number prefix from settings (for ecommerce order)
      const orderPrefix = await getSettingValue("ECOMMERCE_ORDER_NUMBER_PREFIX", "ORD");
      
      // Calculate totals
      let subtotal = 0;
      const quotationLines = [];
      const salesOrderLineInputs: Array<{
        productId: string;
        description: string;
        quantity: number;
        unitPrice: number;
      }> = [];
      const ecommerceOrderItemsData: Array<{
        productId: string;
        productName: string;
        sku: string | null;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
      }> = [];
      
      for (const item of cart.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          include: { stockItems: true },
        });

        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }

        const totalStock = product.stockItems.reduce(
          (sum, si) => sum + si.available,
          0
        );

        if (totalStock < item.quantity) {
          throw new Error(
            `Insufficient stock for ${product.name}. Available: ${totalStock}, Requested: ${item.quantity}`
          );
        }

        // Convert product price from its base currency to GHS
        let unitPriceInGHS = product.price || 0;
        const baseCurrency = product.baseCurrency || "GHS";
        
        if (baseCurrency !== "GHS" && product.price) {
          const priceConversion = await convertCurrency(baseCurrency, "GHS", product.price);
          if (priceConversion) {
            unitPriceInGHS = priceConversion.convertedAmount;
          } else {
            console.warn(`Failed to convert price for product ${product.id} from ${baseCurrency} to GHS`);
          }
        }

        const lineTotal = unitPriceInGHS * item.quantity;
        subtotal += lineTotal;

        quotationLines.push({
          productId: product.id,
          quantity: item.quantity,
          unitPrice: unitPriceInGHS, // Store in GHS
          discount: 0,
          lineTotal,
        });

        salesOrderLineInputs.push({
          productId: product.id,
          description: product.name || "",
          quantity: item.quantity,
          unitPrice: unitPriceInGHS,
        });

        ecommerceOrderItemsData.push({
          productId: product.id,
          productName: product.name || "Product",
          sku: product.sku || null,
          quantity: item.quantity,
          unitPrice: unitPriceInGHS,
          lineTotal,
        });
      }

      // Get tax rate from ecommerce settings (defaults to 12.5%)
      const taxRateSetting = await getSettingValue("ECOMMERCE_TAX_RATE", "12.5");
      const taxRate = parseFloat(taxRateSetting) || 12.5;
      const tax = subtotal * (taxRate / 100);
      const total = subtotal + tax;


      // Create quotation
      const quotation = await tx.quotation.create({
        data: {
          number: quotationNumber,
          status: "SENT",
          subject: `Online Order - ${customer.name}`,
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          notes: notes || "Order placed via online store",
          currency: "GHS",
          subtotal,
          tax,
          total,
          taxInclusive: true,
          leadId: lead.id,
          ownerId: systemUser ? systemUser.id : "system",
          customerType: "STANDARD",
          accountId: account?.id ?? null,
          billingAddressSnapshot: billingAddress || shippingAddress,
          shippingAddressSnapshot: shippingAddress,
          lines: {
            create: quotationLines,
          },
        },
        include: {
          lines: {
            include: {
              product: true,
            },
          },
        },
      });

      // Create invoice from quotation
      const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
      
      const invoice = await tx.invoice.create({
        data: {
          number: invoiceNumber,
          subject: `Invoice - ${customer.name}`,
          quotationId: quotation.id,
          leadId: lead.id,
          accountId: account?.id ?? null,
          status: "SENT",
          paymentStatus: paymentMethod === "ONLINE" || paymentMethod === "PAYSTACK" ? "UNPAID" : "UNPAID", // Will be updated by webhook when payment is confirmed
          issueDate: new Date(),
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          currency: "GHS",
          subtotal,
          tax,
          discount: 0,
          total,
          amountPaid: 0,
          amountDue: total,
          taxInclusive: true,
          paymentTerms: "Net 7 days",
          customerType: "STANDARD",
          billingAddressSnapshot: billingAddress || shippingAddress,
          shippingAddressSnapshot: shippingAddress,
          notes: `Payment Method: ${paymentMethod}\n${notes || ""}`,
          ownerId: systemUser ? systemUser.id : "system",
          lines: {
            create: quotationLines.map(line => ({
              productId: line.productId,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              discount: line.discount,
              lineTotal: line.lineTotal,
            })),
          },
        },
        include: {
          lines: {
            include: {
              product: true,
            },
          },
        },
      });

      // Use ecommerceCustomerId from outside transaction (already looked up above)
      const ecommerceOrder = await tx.ecommerceOrder.create({
        data: {
          orderNumber: invoice.number,
          customerId: ecommerceCustomerId, // Will be null if customer table doesn't exist or customer not found
          customerEmail: customer.email,
          customerName: customer.name,
          customerPhone: customer.phone || null,
          shippingAddress: shippingAddress ?? {},
          billingAddress: billingAddress || shippingAddress || {},
          subtotal,
          tax,
          discount: 0,
          total,
          currency: "GHS",
          status: "PROCESSING",
          paymentStatus: "PENDING",
          paymentMethod,
          paymentId: null,
          notes: notes || "Order placed via online store",
        },
      });

      for (const itemData of ecommerceOrderItemsData) {
        await tx.ecommerceOrderItem.create({
          data: {
            orderId: ecommerceOrder.id,
            productId: itemData.productId,
            productName: itemData.productName,
            sku: itemData.sku,
            quantity: itemData.quantity,
            unitPrice: itemData.unitPrice,
            totalPrice: itemData.lineTotal,
          },
        });
      }

      // Create a sales order for internal operations if an account exists
      if (account) {
        const salesOrderNumber = await generateSalesOrderNumber(tx);
        await tx.salesOrder.create({
          data: {
            number: salesOrderNumber,
            quotationId: quotation.id,
            invoiceId: invoice.id,
            accountId: account.id,
            ownerId: systemUser ? systemUser.id : "system",
            status: "PENDING",
            source: "ECOMMERCE",
            subtotal,
            tax,
            discount: 0,
            total,
            deliveryAddress: shippingAddress
              ? JSON.stringify(shippingAddress)
              : null,
            deliveryDate: null,
            deliveryNotes: notes || "Order placed via online store",
            notes: "Ecommerce order created from online checkout",
            lines: {
              create: salesOrderLineInputs.map((line) => {
                const lineSubtotal = line.unitPrice * line.quantity;
                const lineTax = lineSubtotal * 0.125;

                return {
                  productId: line.productId,
                  description: line.description,
                  quantity: line.quantity,
                  unitPrice: line.unitPrice,
                  discount: 0,
                  tax: lineTax,
                  lineTotal: lineSubtotal,
                };
              }),
            },
          },
        });
      }

      // Update stock levels with intelligent warehouse allocation
      for (const item of cart.items) {
        // Get stock items for the product with warehouse information
        const stockItems = await tx.stockItem.findMany({
          where: {
            productId: item.productId,
            available: { gt: 0 },
          },
          include: {
            warehouse: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
          orderBy: {
            available: "desc", // Prefer warehouses with more stock to reduce fragmentation
          },
        });

        if (stockItems.length === 0) {
          throw new Error(`No stock available for product ${item.productId}`);
        }

        let remainingQuantity = item.quantity;
        const warehouseAllocations: Array<{
          warehouseId: string;
          warehouseName: string;
          quantity: number;
        }> = [];

        // Intelligently allocate stock from warehouses
        for (const stockItem of stockItems) {
          if (remainingQuantity <= 0) break;

          const quantityToDeduct = Math.min(
            remainingQuantity,
            stockItem.available
          );

          // Update stock item
          await tx.stockItem.update({
            where: { id: stockItem.id },
            data: {
              available: stockItem.available - quantityToDeduct,
              reserved: stockItem.reserved + quantityToDeduct,
            },
          });

          // Create stock movement
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              stockItemId: stockItem.id,
              type: "SALE",
              quantity: -quantityToDeduct,
              reference: invoice.number,
              reason: "Online store sale",
              notes: `Invoice: ${invoice.number} | Allocated from ${stockItem.warehouse?.name || 'Warehouse'}`,
              warehouseId: stockItem.warehouseId,
            },
          });

          warehouseAllocations.push({
            warehouseId: stockItem.warehouseId || '',
            warehouseName: stockItem.warehouse?.name || 'Unknown Warehouse',
            quantity: quantityToDeduct,
          });

          remainingQuantity -= quantityToDeduct;
        }

        // If we couldn't fulfill the entire quantity, throw an error
        if (remainingQuantity > 0) {
          throw new Error(
            `Insufficient stock for product. Requested: ${item.quantity}, Allocated: ${item.quantity - remainingQuantity}`
          );
        }

        // Log warehouse allocation for debugging/fulfillment tracking
        console.log(`Product ${item.productId} allocated from warehouses:`, warehouseAllocations);
      }

      return {
        quotation,
        invoice,
        lead,
        ecommerceOrder,
      };
    });

    // Mark abandoned cart as converted (if it exists)
    try {
      await prisma.abandonedCart.updateMany({
        where: {
          cartSessionId: cartId,
          convertedToOrder: false
        },
        data: {
          convertedToOrder: true,
          convertedOrderId: result.ecommerceOrder.id,
        }
      });
    } catch (error) {
      // Don't fail checkout if marking cart as converted fails
      console.error("Error marking cart as converted:", error);
    }

    // Clear the cart after successful transaction
    const clearCookieStore = await cookies();
    clearCookieStore.delete(`cart_${cartId}`);

    // NOTE: Order confirmation emails/SMS are now sent AFTER payment is confirmed
    // in the payment verification/webhook routes, not here during checkout

    return NextResponse.json({
      success: true,
      message: "Order placed successfully",
      order: {
        id: result.ecommerceOrder.id,
        quotationNumber: result.quotation.number,
        invoiceId: result.invoice.id,
        invoiceNumber: result.invoice.number,
        orderNumber: result.ecommerceOrder.orderNumber,
        total: result.invoice.total,
        currency: result.invoice.currency,
        status: result.ecommerceOrder.status,
      },
    });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Checkout failed"
      },
      { status: 500 }
    );
  }
}
