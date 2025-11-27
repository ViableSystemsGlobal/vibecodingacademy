import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { convertCurrency } from "@/lib/currency";

// GET - Get all products marked as Best Deals
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use raw SQL to query since Prisma client may not recognize isBestDeal field yet
    const productsRaw = await (prisma as any).$queryRaw`
      SELECT 
        p.id,
        p.name,
        p.sku,
        p.price,
        p."originalPrice",
        p."bestDealPrice",
        p."originalPriceCurrency",
        p."baseCurrency",
        p.images,
        p.active,
        p."isBestDeal",
        p."createdAt",
        p."updatedAt",
        c.id as "categoryId",
        c.name as "categoryName"
      FROM products p
      LEFT JOIN categories c ON p."categoryId" = c.id
      WHERE p."isBestDeal" = 1 AND p.active = 1
      ORDER BY p."updatedAt" DESC
    `;

    // Transform the raw results and convert prices to GHS
    const products = await Promise.all(
      (productsRaw as any[]).map(async (row: any) => {
        const priceCurrency = row.originalPriceCurrency || row.baseCurrency || "GHS";
        let priceInGHS = row.price || 0;
        let originalPriceInGHS = row.originalPrice || 0;

        // Convert regular price to GHS if needed
        if (priceCurrency !== "GHS" && row.price) {
          const priceConversion = await convertCurrency(
            priceCurrency,
            "GHS",
            row.price
          );
          if (priceConversion) {
            priceInGHS = priceConversion.convertedAmount;
          }
        }

        // Convert original price to GHS if needed
        if (priceCurrency !== "GHS" && row.originalPrice) {
          const originalPriceConversion = await convertCurrency(
            priceCurrency,
            "GHS",
            row.originalPrice
          );
          if (originalPriceConversion) {
            originalPriceInGHS = originalPriceConversion.convertedAmount;
          }
        }

        // bestDealPrice is always in GHS (entered by admin in GHS)
        const bestDealPriceInGHS = row.bestDealPrice || null;

        return {
          id: row.id,
          name: row.name,
          sku: row.sku,
          price: Math.round(priceInGHS * 100) / 100, // Round to 2 decimal places
          originalPrice: Math.round(originalPriceInGHS * 100) / 100,
          bestDealPrice: bestDealPriceInGHS,
          images: row.images,
          active: row.active === 1,
          isBestDeal: row.isBestDeal === 1,
          category: row.categoryId ? {
            id: row.categoryId,
            name: row.categoryName,
          } : null,
        };
      })
    );

    return NextResponse.json({ products });
  } catch (error: any) {
    console.error("Error fetching best deals:", error);
    // If raw SQL fails, try Prisma query as fallback
    try {
      const products = await prisma.product.findMany({
        where: {
          active: true,
        },
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
        take: 100, // Limit to prevent huge queries
      });
      
      // Filter manually by checking the raw database value
      const bestDealProducts = products.filter((p: any) => {
        // Check if isBestDeal exists and is truthy
        return (p as any).isBestDeal === true || (p as any).isBestDeal === 1;
      });
      
      return NextResponse.json({ products: bestDealProducts });
    } catch (fallbackError) {
      console.error("Fallback query also failed:", fallbackError);
      return NextResponse.json(
        { error: error?.message || "Failed to fetch best deals" },
        { status: 500 }
      );
    }
  }
}

