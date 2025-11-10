import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import crypto from "crypto";
import { convertCurrency } from "@/lib/currency";

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

          let priceInGHS = product.price || 0;
          const priceCurrency = product.originalPriceCurrency || product.baseCurrency || "GHS";
          
          if (priceCurrency !== "GHS" && product.price) {
            const priceConversion = await convertCurrency(priceCurrency, "GHS", product.price);
            if (priceConversion) {
              priceInGHS = priceConversion.convertedAmount;
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

    const tax = subtotal * 0.125; // 12.5% VAT
    const total = subtotal + tax;

    return NextResponse.json({
      items: validatedItems,
      subtotal,
      tax,
      total,
      itemCount: validatedItems.reduce((sum, item) => sum + item.quantity, 0),
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

    // Save cart
    cookieStore.set(`cart_${cartId}`, JSON.stringify(cart), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
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

    // Save cart
    cookieStore.set(`cart_${cartId}`, JSON.stringify(cart), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
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

// DELETE /api/public/shop/cart - Clear cart
export async function DELETE() {
  try {
    const cartId = await getCartSession();
    const cookieStore = await cookies();
    
    cookieStore.delete(`cart_${cartId}`);
    
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
