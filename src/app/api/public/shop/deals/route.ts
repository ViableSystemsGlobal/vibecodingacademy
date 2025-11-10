import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { convertCurrency } from "@/lib/currency";

const DEFAULT_LIMIT = 8;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      parseInt(searchParams.get("limit") || `${DEFAULT_LIMIT}`, 10) || DEFAULT_LIMIT,
      24
    );

    const sampleSize = Math.min(limit * 3, 60);

    const dealProducts = await prisma.product.findMany({
      where: {
        active: true,
        type: "PRODUCT",
        originalPrice: {
          not: null,
        },
        price: {
          not: null,
        },
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        stockItems: {
          select: {
            available: true,
            warehouseId: true,
          },
        },
      },
      take: sampleSize,
    });

    const transformed = await Promise.all(
      dealProducts.map(async (product) => {
        let priceInGHS = product.price || 0;
        let originalPriceInGHS = product.originalPrice || 0;
        const priceCurrency = product.originalPriceCurrency || product.baseCurrency || "GHS";
        const originalCurrency = product.originalPriceCurrency || priceCurrency;

        if (priceCurrency !== "GHS" && product.price) {
          const priceConversion = await convertCurrency(
            priceCurrency,
            "GHS",
            product.price
          );
          if (priceConversion) {
            priceInGHS = priceConversion.convertedAmount;
          }
        }

        if (originalCurrency !== "GHS" && product.originalPrice) {
          const originalPriceConversion = await convertCurrency(
            originalCurrency,
            "GHS",
            product.originalPrice
          );
          if (originalPriceConversion) {
            originalPriceInGHS = originalPriceConversion.convertedAmount;
          }
        }

        const discountPercent =
          originalPriceInGHS > priceInGHS && originalPriceInGHS > 0
            ? Math.round(
                ((originalPriceInGHS - priceInGHS) / originalPriceInGHS) * 100
              )
            : 0;

        return {
          id: product.id,
          name: product.name,
          description: product.description,
          price: Math.round(priceInGHS * 100) / 100,
          originalPrice: Math.round(originalPriceInGHS * 100) / 100,
          currency: "GHS",
          sku: product.sku,
          images,
          category: product.category,
          inStock: totalStock > 0,
          stockQuantity: totalStock,
          lowStock: totalStock > 0 && totalStock <= 5,
          discountPercent,
        };
      })
    );

    const filtered = transformed
      .filter((product) => product.discountPercent > 0)
      .sort((a, b) => b.discountPercent - a.discountPercent || b.stockQuantity - a.stockQuantity)
      .slice(0, limit);

    let deals = filtered;

    if (deals.length === 0) {
      const fallbackProducts = await prisma.product.findMany({
        where: {
          active: true,
          type: "PRODUCT",
        },
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          stockItems: {
            select: {
              available: true,
              warehouseId: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: limit,
      });

      deals = await Promise.all(
        fallbackProducts.map(async (product) => {
          const totalStock = product.stockItems.reduce(
            (sum, item) => sum + item.available,
            0
          );

          let images: string[] = [];
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
            const priceConversion = await convertCurrency(
              priceCurrency,
              "GHS",
              product.price
            );
            if (priceConversion) {
              priceInGHS = priceConversion.convertedAmount;
            }
          }

          return {
            id: product.id,
            name: product.name,
            description: product.description,
            price: Math.round(priceInGHS * 100) / 100,
            originalPrice: null,
            currency: "GHS",
            sku: product.sku,
            images,
            category: product.category,
            inStock: totalStock > 0,
            stockQuantity: totalStock,
            lowStock: totalStock > 0 && totalStock <= 5,
            discountPercent: null,
          };
        })
      );
    }

    return NextResponse.json({
      deals,
    });
  } catch (error) {
    console.error("Error fetching deal products:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch deal products",
        details:
          process.env.NODE_ENV === "development" && error instanceof Error
            ? error.message
            : undefined,
      },
      { status: 500 }
    );
  }
}
