import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import crypto from "crypto";
import { verify } from "jsonwebtoken";
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

// Helper function to get or create cart session
async function getCartSession() {
  const cookieStore = await cookies();
  let cartId = cookieStore.get("cart_session")?.value;

  if (!cartId) {
    cartId = crypto.randomUUID();
    cookieStore.set("cart_session", cartId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
  }

  return cartId;
}

// Helper function to track/update abandoned cart
async function trackAbandonedCart(cartId: string, cart: any) {
  try {
    // Skip if cart is empty
    if (!cart.items || cart.items.length === 0) {
      // If cart is empty, mark as converted to stop tracking
      try {
        await prisma.abandonedCart.updateMany({
          where: { cartSessionId: cartId },
          data: { convertedToOrder: true }
        });
      } catch (e) {
        // Ignore errors if cart doesn't exist
      }
      return;
    }

    // Try to get customer email if logged in
    const cookieStore = await cookies();
    const customerToken = cookieStore.get("customer_token")?.value;
    let customerId: string | null = null;
    let customerEmail: string | null = null;
    let customerName: string | null = null;

    if (customerToken) {
      try {
        const decoded: any = verify(
          customerToken,
          process.env.NEXTAUTH_SECRET || "adpools-secret-key-2024-production-change-me"
        );
        if (decoded?.type === "customer") {
          customerId = decoded.id;
          
          // Try to get customer details
          try {
            const customer = await prisma.customer.findUnique({
              where: { id: customerId },
              select: { email: true, firstName: true, lastName: true }
            });
            if (customer) {
              customerEmail = customer.email;
              customerName = `${customer.firstName} ${customer.lastName}`;
            }
          } catch (e) {
            // Customer table might not exist, continue without email
          }
        }
      } catch (error) {
        // Token invalid, continue as guest
      }
    }

    // Use passed totals if available, otherwise calculate
    const subtotal = cart.subtotal !== undefined ? cart.subtotal : 0;
    const tax = cart.tax !== undefined ? cart.tax : 0;
    const total = cart.total !== undefined ? cart.total : 0;

    // Upsert abandoned cart record (only if not already converted)
    await prisma.abandonedCart.upsert({
      where: { cartSessionId: cartId },
      update: {
        items: cart.items,
        subtotal,
        tax,
        total,
        lastActivityAt: new Date(),
        customerId: customerId || null,
        customerEmail: customerEmail || null,
        customerName: customerName || null,
        // Don't update reminder fields on activity update
      },
      create: {
        cartSessionId: cartId,
        customerId: customerId || null,
        customerEmail: customerEmail || null,
        customerName: customerName || null,
        items: cart.items,
        subtotal,
        tax,
        total,
        currency: "GHS",
        lastActivityAt: new Date(),
      },
    });
  } catch (error) {
    // Don't fail cart operations if tracking fails
    console.error("Error tracking abandoned cart:", error);
  }
}

// GET /api/public/shop/cart - Get cart contents
export async function GET() {
  try {
    const cartId = await getCartSession();
    
    // For now, we'll store cart in session/cookies
    // In production, you might want to store in database
    const cookieStore = await cookies();
    const cartData = cookieStore.get(`cart_${cartId}`)?.value;
    
    if (!cartData) {
      return NextResponse.json({
        items: [],
        subtotal: 0,
        tax: 0,
        total: 0,
        itemCount: 0,
      });
    }

    const cart = JSON.parse(cartData);
    
    // Validate items still exist and have stock
    const validatedItems = [];
    let subtotal = 0;

    for (const item of cart.items) {
      const product = await prisma.product.findUnique({
        where: {
          id: item.productId,
          active: true,
        },
        include: {
          category: true,
          stockItems: {
            select: {
              available: true,
            },
          },
        },
      });

      if (product) {
        const totalStock = product.stockItems.reduce(
          (sum, si) => sum + si.available,
          0
        );

        const quantity = Math.min(item.quantity, totalStock);
        
        if (quantity > 0) {
          let images = [];
          if (product.images) {
            try {
              images = JSON.parse(product.images);
            } catch {
              images = [product.images];
            }
          }

          // Check for bestDealPrice (always in GHS)
          let bestDealPrice: number | null = null;
          try {
            const bestDealRow = await (prisma as any).$queryRaw`
              SELECT "bestDealPrice" FROM products WHERE id = ${product.id}
            `;
            bestDealPrice = bestDealRow?.[0]?.bestDealPrice || null;
          } catch (e) {
            // If query fails, continue without bestDealPrice
          }

          // Use bestDealPrice if available, otherwise use regular price
          let priceInGHS: number;
          if (bestDealPrice) {
            // bestDealPrice is already in GHS
            priceInGHS = bestDealPrice;
          } else {
            // Convert regular price to GHS
            priceInGHS = product.price || 0;
            const priceCurrency = product.originalPriceCurrency || product.baseCurrency || "GHS";
            
            if (priceCurrency !== "GHS" && product.price) {
              const priceConversion = await convertCurrency(priceCurrency, "GHS", product.price);
              if (priceConversion) {
                priceInGHS = priceConversion.convertedAmount;
              }
            }
          }
          
          const lineTotalInGHS = priceInGHS * quantity;
          subtotal += lineTotalInGHS;

          validatedItems.push({
            productId: product.id,
            name: product.name,
            sku: product.sku,
            price: priceInGHS,
            currency: "GHS",
            quantity,
            maxQuantity: totalStock,
            lineTotal: lineTotalInGHS,
            image: images[0] || null,
          });
        }
      }
    }

    // If items were removed (cart had invalid products), update the cart cookie
    if (validatedItems.length !== cart.items.length) {
      const cleanedCart = {
        items: validatedItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity
        }))
      };
      cookieStore.set(`cart_${cartId}`, JSON.stringify(cleanedCart), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });
    }

    // Get tax rate from ecommerce settings (defaults to 12.5%)
    const taxRateSetting = await getSettingValue("ECOMMERCE_TAX_RATE", "12.5");
    const taxRate = parseFloat(taxRateSetting) || 12.5;
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;

    return NextResponse.json({
      items: validatedItems,
      subtotal,
      tax,
      total,
      itemCount: validatedItems.reduce((sum, item) => sum + item.quantity, 0),
      cleaned: validatedItems.length !== cart.items.length, // Indicate if cart was cleaned
    });
  } catch (error) {
    console.error("Error getting cart:", error);
    return NextResponse.json(
      { error: "Failed to get cart" },
      { status: 500 }
    );
  }
}

// POST /api/public/shop/cart - Add item to cart
export async function POST(request: NextRequest) {
  try {
    const cartId = await getCartSession();
    const body = await request.json();
    const { productId, quantity = 1 } = body;

    if (!productId) {
      return NextResponse.json(
        { error: "Product ID is required" },
        { status: 400 }
      );
    }

    // Validate product exists and has stock
    const product = await prisma.product.findUnique({
      where: {
        id: productId,
        active: true,
      },
      include: {
        stockItems: true,
      },
    });

    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    const totalStock = product.stockItems.reduce(
      (sum, item) => sum + item.available,
      0
    );

    if (totalStock < quantity) {
      return NextResponse.json(
        { error: "Insufficient stock", availableStock: totalStock },
        { status: 400 }
      );
    }

    // Get current cart
    const cookieStore = await cookies();
    const cartData = cookieStore.get(`cart_${cartId}`)?.value;
    let cart = cartData ? JSON.parse(cartData) : { items: [] };

    // Add or update item in cart
    const existingItemIndex = cart.items.findIndex(
      (item: any) => item.productId === productId
    );

    if (existingItemIndex >= 0) {
      cart.items[existingItemIndex].quantity = Math.min(
        cart.items[existingItemIndex].quantity + quantity,
        totalStock
      );
    } else {
      cart.items.push({
        productId,
        quantity: Math.min(quantity, totalStock),
      });
    }

    // Recalculate cart totals for tracking
    const taxRate = parseFloat(await getSettingValue("ECOMMERCE_TAX_RATE", "12.5")) || 12.5;
    let cartSubtotal = 0;
    
    for (const item of cart.items) {
      try {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          select: { price: true, baseCurrency: true, originalPriceCurrency: true }
        });
        
        if (product) {
          // Check for bestDealPrice (always in GHS)
          let bestDealPrice: number | null = null;
          try {
            const bestDealRow = await (prisma as any).$queryRaw`
              SELECT "bestDealPrice" FROM products WHERE id = ${item.productId}
            `;
            bestDealPrice = bestDealRow?.[0]?.bestDealPrice || null;
          } catch (e) {
            // If query fails, continue without bestDealPrice
          }

          // Use bestDealPrice if available, otherwise convert regular price
          let price: number;
          if (bestDealPrice) {
            price = bestDealPrice; // Already in GHS
          } else {
            price = product.price || 0;
            const baseCurrency = product.baseCurrency || "GHS";
            
            if (baseCurrency !== "GHS" && price) {
              const priceConversion = await convertCurrency(baseCurrency, "GHS", price);
              if (priceConversion) {
                price = priceConversion.convertedAmount;
              }
            }
          }
          
          cartSubtotal += price * (item.quantity || 1);
        }
      } catch (e) {
        // Skip items with errors
      }
    }
    
    const cartTax = cartSubtotal * (taxRate / 100);
    const cartTotal = cartSubtotal + cartTax;

    // Save cart
    cookieStore.set(`cart_${cartId}`, JSON.stringify(cart), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    // Track abandoned cart (async, don't wait)
    trackAbandonedCart(cartId, {
      ...cart,
      subtotal: cartSubtotal,
      tax: cartTax,
      total: cartTotal
    }).catch(error => {
      console.error("Error tracking abandoned cart:", error);
    });

    return NextResponse.json({
      success: true,
      message: "Item added to cart",
      cartItemCount: cart.items.reduce(
        (sum: number, item: any) => sum + item.quantity,
        0
      ),
    });
  } catch (error) {
    console.error("Error adding to cart:", error);
    return NextResponse.json(
      { error: "Failed to add item to cart" },
      { status: 500 }
    );
  }
}

// PUT /api/public/shop/cart - Update cart item quantity
export async function PUT(request: NextRequest) {
  try {
    const cartId = await getCartSession();
    const body = await request.json();
    const { productId, quantity } = body;

    if (!productId || quantity === undefined) {
      return NextResponse.json(
        { error: "Product ID and quantity are required" },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const cartData = cookieStore.get(`cart_${cartId}`)?.value;
    
    if (!cartData) {
      return NextResponse.json(
        { error: "Cart not found" },
        { status: 404 }
      );
    }

    let cart = JSON.parse(cartData);

    if (productId) {
      const itemIndex = cart.items.findIndex(
        (item: any) => item.productId === productId
      );

      if (itemIndex >= 0) {
        if (quantity <= 0) {
          cart.items.splice(itemIndex, 1);
        } else {
        // Validate stock
        const product = await prisma.product.findUnique({
          where: { id: productId },
          include: { stockItems: true },
        });

        if (product) {
          const totalStock = product.stockItems.reduce(
            (sum, item) => sum + item.available,
            0
          );
          cart.items[itemIndex].quantity = Math.min(quantity, totalStock);
          }
        }
      }
    }

    // Recalculate cart totals for tracking
    const taxRate = parseFloat(await getSettingValue("ECOMMERCE_TAX_RATE", "12.5")) || 12.5;
    let cartSubtotal = 0;
    
    for (const item of cart.items) {
      try {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          select: { price: true, baseCurrency: true, originalPriceCurrency: true }
        });
        
        if (product) {
          // Check for bestDealPrice (always in GHS)
          let bestDealPrice: number | null = null;
          try {
            const bestDealRow = await (prisma as any).$queryRaw`
              SELECT "bestDealPrice" FROM products WHERE id = ${item.productId}
            `;
            bestDealPrice = bestDealRow?.[0]?.bestDealPrice || null;
          } catch (e) {
            // If query fails, continue without bestDealPrice
          }

          // Use bestDealPrice if available, otherwise convert regular price
          let price: number;
          if (bestDealPrice) {
            price = bestDealPrice; // Already in GHS
          } else {
            price = product.price || 0;
            const baseCurrency = product.baseCurrency || "GHS";
            
            if (baseCurrency !== "GHS" && price) {
              const priceConversion = await convertCurrency(baseCurrency, "GHS", price);
              if (priceConversion) {
                price = priceConversion.convertedAmount;
              }
            }
          }
          
          cartSubtotal += price * (item.quantity || 1);
        }
      } catch (e) {
        // Skip items with errors
      }
    }
    
    const cartTax = cartSubtotal * (taxRate / 100);
    const cartTotal = cartSubtotal + cartTax;

    // Save cart
    cookieStore.set(`cart_${cartId}`, JSON.stringify(cart), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
    });

    // Track abandoned cart (async, don't wait)
    trackAbandonedCart(cartId, {
      ...cart,
      subtotal: cartSubtotal,
      tax: cartTax,
      total: cartTotal
    }).catch(error => {
      console.error("Error tracking abandoned cart:", error);
    });

    return NextResponse.json({
      success: true,
      message: "Cart updated",
    });
  } catch (error) {
    console.error("Error updating cart:", error);
    return NextResponse.json(
      { error: "Failed to update cart" },
      { status: 500 }
    );
  }
}

// DELETE /api/public/shop/cart - Clear cart or remove item
export async function DELETE(request: NextRequest) {
  try {
    const cartId = await getCartSession();
    const cookieStore = await cookies();
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");
    
    if (productId) {
      // Remove specific item from cart
      const cartData = cookieStore.get(`cart_${cartId}`)?.value;
      
      if (cartData) {
        let cart = JSON.parse(cartData);
        cart.items = cart.items.filter((item: any) => item.productId !== productId);
        
        cookieStore.set(`cart_${cartId}`, JSON.stringify(cart), {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 7,
        });

        // Track abandoned cart (async, don't wait)
        trackAbandonedCart(cartId, cart).catch(error => {
          console.error("Error tracking abandoned cart:", error);
        });

        return NextResponse.json({
          success: true,
          message: "Item removed from cart",
        });
      }
    } else {
      // Clear entire cart
    cookieStore.delete(`cart_${cartId}`);
      
      // Mark cart as converted (empty = no longer abandoned)
      try {
        await prisma.abandonedCart.updateMany({
          where: { cartSessionId: cartId },
          data: { convertedToOrder: true }
        });
      } catch (e) {
        // Ignore errors if cart doesn't exist
      }
    }
    
    return NextResponse.json({
      success: true,
      message: "Cart cleared",
    });
  } catch (error) {
    console.error("Error clearing cart:", error);
    return NextResponse.json(
      { error: "Failed to clear cart" },
      { status: 500 }
    );
  }
}
