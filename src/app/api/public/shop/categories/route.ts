import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/public/shop/categories - Get all product categories
export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        ecommerceConfig: {
          select: {
            tileImageUrl: true,
            heroImageUrl: true,
            marketingTagline: true,
            displayOrder: true,
          },
        },
        _count: {
          select: {
            products: {
              where: {
                active: true,
                type: "PRODUCT",
              },
            },
          },
        },
      },
      orderBy: [
        {
          ecommerceConfig: {
            displayOrder: "asc",
      },
        },
        { name: "asc" },
      ],
    });

    // Transform to include product count
    const transformedCategories = categories.map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description,
      productCount: category._count.products,
      tileImageUrl:
        category.ecommerceConfig?.tileImageUrl ||
        category.ecommerceConfig?.heroImageUrl ||
        null,
      marketingTagline: category.ecommerceConfig?.marketingTagline || null,
    }));

    // Filter out categories with no products
    const activeCategories = transformedCategories.filter(
      (cat) => cat.productCount > 0
    );

    return NextResponse.json({
      categories: activeCategories,
      total: activeCategories.length,
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}
