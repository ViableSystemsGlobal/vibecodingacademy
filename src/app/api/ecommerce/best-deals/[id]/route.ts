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

    // Update using Prisma (works for both SQLite and PostgreSQL)
    const updateData: any = {};
    
    if (isBestDeal !== undefined) {
      updateData.isBestDeal = isBestDeal;
    }
    
    if (bestDealPrice !== undefined) {
      updateData.bestDealPrice = bestDealPrice;
    }
    
    if (Object.keys(updateData).length > 0) {
      await prisma.product.update({
        where: { id },
        data: updateData,
      });
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

    return NextResponse.json({ product });
  } catch (error: any) {
    console.error("Error updating best deal status:", error);
    const errorMessage = error?.message || "Failed to update product";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

