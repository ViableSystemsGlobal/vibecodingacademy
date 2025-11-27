import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/ecommerce/abandoned-carts - Fetch abandoned carts with filters
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;
    
    const status = searchParams.get("status"); // 'active', 'converted', 'all'
    const search = searchParams.get("search"); // Search by email, name, or cart session ID
    const hasEmail = searchParams.get("hasEmail"); // 'true' or 'false'

    // Build where clause - use AND to properly combine conditions
    const conditions: any[] = [];

    if (status === "active") {
      conditions.push({ convertedToOrder: false });
    } else if (status === "converted") {
      conditions.push({ convertedToOrder: true });
    }

    if (hasEmail === "true") {
      conditions.push({ customerEmail: { not: null } });
    } else if (hasEmail === "false") {
      conditions.push({ customerEmail: null });
    }

    if (search) {
      conditions.push({
        OR: [
          { customerEmail: { contains: search } },
          { customerName: { contains: search } },
          { cartSessionId: { contains: search } },
        ],
      });
    }

    // Build where clause - flatten if only one condition
    let where: any;
    if (conditions.length === 0) {
      where = {};
    } else if (conditions.length === 1) {
      where = conditions[0];
    } else {
      where = { AND: conditions };
    }

    console.log("Query where clause:", JSON.stringify(where, null, 2));

    // Fetch abandoned carts - use type assertion to bypass TypeScript error (runtime works fine)
    const [carts, total] = await Promise.all([
      (prisma as any).abandonedCart.findMany({
        where,
        orderBy: {
          lastActivityAt: "desc",
        },
        skip,
        take: limit,
      }),
      (prisma as any).abandonedCart.count({ where }),
    ]);
    
    console.log("Query successful, found", carts.length, "carts, total:", total);

    const convertDecimal = (val: any): number => {
      if (val == null) return 0;
      if (typeof val === "number") return Number.isFinite(val) ? val : 0;
      if (typeof val === "string") {
        const parsed = parseFloat(val);
        return Number.isFinite(parsed) ? parsed : 0;
      }
      try {
        if (val && typeof val === "object") {
          if (typeof val.toNumber === "function") {
            return val.toNumber();
          }
          const parsed = parseFloat(String(val));
          return Number.isFinite(parsed) ? parsed : 0;
        }
      } catch (decimalError) {
        console.warn("Decimal conversion error:", decimalError);
      }
      return 0;
    };

    const toIsoString = (value: Date | string | null | undefined) => {
      if (!value) return null;
      try {
        const date =
          value instanceof Date ? value : new Date(value as unknown as string);
        return Number.isNaN(date.getTime()) ? null : date.toISOString();
      } catch {
        return null;
      }
    };

    // Transform data for frontend
    const transformedCarts = (carts as any[])
      .map((cart: any) => {
        try {
          // Handle items - Prisma Json type
          let items: any[] = [];
          if (cart.items != null) {
            if (Array.isArray(cart.items)) {
              items = cart.items;
            } else if (typeof cart.items === "string") {
              try {
                const parsed = JSON.parse(cart.items);
                items = Array.isArray(parsed) ? parsed : [];
              } catch {
                items = [];
              }
            } else if (typeof cart.items === "object") {
              items = [cart.items];
            }
          }

          return {
            id: String(cart.id),
            cartSessionId: String(cart.cartSessionId),
            customerId: cart.customerId ? String(cart.customerId) : null,
            customerEmail: cart.customerEmail ? String(cart.customerEmail) : null,
            customerName: cart.customerName ? String(cart.customerName) : null,
            items,
            itemCount: items.reduce((sum: number, item: any) => {
              const qty = item?.quantity;
              if (typeof qty === "number") return sum + qty;
              if (typeof qty === "string") {
                const parsed = parseFloat(qty);
                return sum + (Number.isFinite(parsed) ? parsed : 1);
              }
              return sum + 1;
            }, 0),
            subtotal: convertDecimal(cart.subtotal),
            tax: convertDecimal(cart.tax),
            total: convertDecimal(cart.total),
            currency: String(cart.currency || "GHS"),
            lastActivityAt: toIsoString(cart.lastActivityAt),
            reminderSentAt: toIsoString(cart.reminderSentAt),
            reminderCount: Number(cart.reminderCount) || 0,
            convertedToOrder: Boolean(cart.convertedToOrder),
            convertedOrderId: cart.convertedOrderId ? String(cart.convertedOrderId) : null,
            createdAt: toIsoString(cart.createdAt),
            updatedAt: toIsoString(cart.updatedAt),
          };
        } catch (cartError: any) {
          console.error(`Error transforming cart ${cart.id}:`, cartError?.message || cartError);
          return null;
        }
      })
      .filter(Boolean) as any[];

    // Ensure all data is JSON-serializable
    const safeResponse = {
      success: true,
      data: transformedCarts.map(cart => ({
        ...cart,
        items: Array.isArray(cart.items) ? cart.items : [],
      })),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: Number(total),
        totalPages: Math.ceil(Number(total) / Number(limit)),
      },
    };

    console.log("Returning response with", transformedCarts.length, "carts");
    
    try {
      return NextResponse.json(safeResponse);
    } catch (jsonError: any) {
      console.error("JSON serialization error:", jsonError);
      return NextResponse.json(
        { 
          error: "Failed to serialize response", 
          details: jsonError?.message || "Unknown serialization error"
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error fetching abandoned carts:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("Error details:", { errorMessage, errorStack });
    return NextResponse.json(
      { 
        error: "Failed to fetch abandoned carts", 
        details: errorMessage,
        // Include stack trace in development
        ...(process.env.NODE_ENV === 'development' && errorStack ? { stack: errorStack } : {})
      },
      { status: 500 }
    );
  }
}

