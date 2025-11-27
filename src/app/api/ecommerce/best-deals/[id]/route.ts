import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PUT - Update a product's Best Deal status
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { isBestDeal, bestDealPrice } = body;

    // Validate isBestDeal if provided
    if (isBestDeal !== undefined && typeof isBestDeal !== "boolean") {
      return NextResponse.json(
        { error: "isBestDeal must be a boolean" },
        { status: 400 }
      );
    }

    // Validate bestDealPrice if provided
    if (bestDealPrice !== undefined && bestDealPrice !== null && (typeof bestDealPrice !== "number" || bestDealPrice < 0)) {
      return NextResponse.json(
        { error: "bestDealPrice must be a positive number or null" },
        { status: 400 }
      );
    }

    // Check if product exists first
    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    // Update using raw SQL since Prisma client may not have the fields yet
    // SQLite uses INTEGER (0/1) for booleans
    const updates: string[] = [];
    const values: any[] = [];
    
    if (isBestDeal !== undefined) {
      updates.push(`"isBestDeal" = ?`);
      values.push(isBestDeal ? 1 : 0);
    }
    
    if (bestDealPrice !== undefined) {
      updates.push(`"bestDealPrice" = ?`);
      values.push(bestDealPrice);
    }
    
    if (updates.length > 0) {
      values.push(id);
      await (prisma as any).$executeRawUnsafe(
        `UPDATE products SET ${updates.join(', ')} WHERE id = ?`,
        ...values
      );
    }
    
    // Fetch the updated product
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json(
        { error: "Product not found after update" },
        { status: 404 }
      );
    }

    // Manually add isBestDeal and bestDealPrice to the response since Prisma client might not include them
    const productWithBestDeal = {
      ...product,
      isBestDeal: isBestDeal !== undefined ? isBestDeal : (product as any).isBestDeal,
      bestDealPrice: bestDealPrice !== undefined ? bestDealPrice : (product as any).bestDealPrice,
    };

    return NextResponse.json({ product: productWithBestDeal });
  } catch (error: any) {
    console.error("Error updating best deal status:", error);
    const errorMessage = error?.message || "Failed to update product";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

