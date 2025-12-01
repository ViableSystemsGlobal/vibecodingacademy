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

    // First, get manually selected Best Deals products using raw SQL
    // (Prisma client may not recognize isBestDeal field yet)
    let bestDealProducts: any[] = [];
    try {
      const bestDealsRaw = await (prisma as any).$queryRaw`
        SELECT 
          p.id,
          p.name,
          p.description,
          p.sku,
          p.price,
          p."originalPrice",
          p."bestDealPrice",
          p."originalPriceCurrency",
          p."baseCurrency",
          p.images,
          p.active,
          p.type,
          c.id as "categoryId",
          c.name as "categoryName"
        FROM products p
        LEFT JOIN categories c ON p."categoryId" = c.id
        WHERE p.active = 1 
          AND p.type = 'PRODUCT'
          AND p."isBestDeal" = 1
          AND p.price IS NOT NULL
        LIMIT ${limit}
      `;
      
      console.log(`Found ${bestDealsRaw.length} best deal products`);

      // Get stock items for best deal products
      if (bestDealsRaw.length > 0) {
        const productIds = bestDealsRaw.map((p: any) => p.id);
        // Use Prisma.$queryRawUnsafe for dynamic IN clause (SQLite syntax)
        const placeholders = productIds.map(() => '?').join(',');
        const stockItemsRaw = await (prisma as any).$queryRawUnsafe(
          `SELECT "productId", available, "warehouseId" FROM stock_items WHERE "productId" IN (${placeholders})`,
          ...productIds
        );

        // Transform to match Prisma format
        bestDealProducts = bestDealsRaw.map((row: any) => ({
          id: row.id,
          name: row.name,
          description: row.description,
          sku: row.sku,
          price: row.price,
          originalPrice: row.originalPrice,
          bestDealPrice: row.bestDealPrice,
          originalPriceCurrency: row.originalPriceCurrency,
          baseCurrency: row.baseCurrency,
          images: row.images,
          active: row.active === 1,
          type: row.type,
          category: row.categoryId ? {
            id: row.categoryId,
            name: row.categoryName,
          } : null,
          stockItems: stockItemsRaw
            .filter((si: any) => si.productId === row.id)
            .map((si: any) => ({
              available: si.available,
              warehouseId: si.warehouseId,
            })),
        }));
      }
    } catch (error) {
      console.error("Error fetching best deals with raw SQL:", error);
      // Fallback: try Prisma query (might fail if field doesn't exist)
      try {
        bestDealProducts = await prisma.product.findMany({
          where: {
            active: true,
            type: "PRODUCT",
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
          take: limit,
        });
        // Filter manually by checking raw value
        bestDealProducts = bestDealProducts.filter((p: any) => 
          (p as any).isBestDeal === true || (p as any).isBestDeal === 1
        );
      } catch (fallbackError) {
        console.error("Fallback query also failed:", fallbackError);
        bestDealProducts = [];
      }
    }

    // Then get other products with discounts to fill remaining slots
    const remainingSlots = Math.max(0, limit - bestDealProducts.length);
    
    // Exclude best deal product IDs
    const bestDealProductIds = bestDealProducts.map((p: any) => p.id);
    
    const dealProducts = await prisma.product.findMany({
      where: {
        active: true,
        type: "PRODUCT",
        ...(bestDealProductIds.length > 0 && {
          id: {
            notIn: bestDealProductIds,
          },
        }),
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
      take: remainingSlots > 0 ? Math.min(sampleSize, remainingSlots * 3) : 0,
    });

    // Combine best deals first, then other deals
    const allDealProducts = [...bestDealProducts, ...dealProducts];

    const transformed = await Promise.all(
      allDealProducts.map(async (product) => {
        let images: string[] = [];
        if (product.images) {
          try {
            const parsed = JSON.parse(product.images);
            images = Array.isArray(parsed) ? parsed : [product.images];
          } catch {
            images = [product.images];
          }
        }

        const totalStock = product.stockItems.reduce(
          (sum, stockItem) => sum + stockItem.available,
          0
        );

        // Check if this is a best deal product with a special price
        const isBestDeal = bestDealProducts.some((bd) => bd.id === product.id);
        const bestDealProduct = isBestDeal ? bestDealProducts.find((bd) => bd.id === product.id) : null;
        const bestDealPrice = bestDealProduct?.bestDealPrice || null;

        // If bestDealPrice is set, it's always in GHS (entered by admin in GHS)
        // Otherwise, use regular price and convert from product's currency
        let priceInGHS: number;
        let originalPriceInGHS: number;
        
        if (bestDealPrice) {
          // Best deal price is already in GHS (entered by admin)
          priceInGHS = bestDealPrice;
          
          // For original price, we need the regular price in GHS to show the discount
          const regularPrice = product.price || 0;
          const priceCurrency = product.originalPriceCurrency || product.baseCurrency || "GHS";
          
          if (priceCurrency !== "GHS" && regularPrice) {
            const priceConversion = await convertCurrency(
              priceCurrency,
              "GHS",
              regularPrice
            );
            if (priceConversion) {
              originalPriceInGHS = priceConversion.convertedAmount;
            } else {
              originalPriceInGHS = regularPrice; // Fallback if conversion fails
            }
          } else {
            originalPriceInGHS = regularPrice;
          }
        } else {
          // No best deal price, use regular price logic
          const effectivePrice = product.price || 0;
          const effectiveOriginalPrice = product.originalPrice || 0;
          const priceCurrency = product.originalPriceCurrency || product.baseCurrency || "GHS";
          const originalCurrency = product.originalPriceCurrency || priceCurrency;

          priceInGHS = effectivePrice;
          originalPriceInGHS = effectiveOriginalPrice;

          if (priceCurrency !== "GHS" && effectivePrice) {
            const priceConversion = await convertCurrency(
              priceCurrency,
              "GHS",
              effectivePrice
            );
            if (priceConversion) {
              priceInGHS = priceConversion.convertedAmount;
            }
          }

          if (originalCurrency !== "GHS" && effectiveOriginalPrice) {
            const originalPriceConversion = await convertCurrency(
              originalCurrency,
              "GHS",
              effectiveOriginalPrice
            );
            if (originalPriceConversion) {
              originalPriceInGHS = originalPriceConversion.convertedAmount;
            }
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
          brand: product.brand,
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
          isBestDeal,
        };
      })
    );

    // Prioritize manually selected best deals, then sort by discount
    const filtered = transformed
      .filter((product) => {
        // Include best deals even if no discount, or products with discount
        return product.isBestDeal || (product.discountPercent || 0) > 0;
      })
      .sort((a, b) => {
        // Best deals first
        if (a.isBestDeal && !b.isBestDeal) return -1;
        if (!a.isBestDeal && b.isBestDeal) return 1;
        
        // Then sort by discount percentage and stock
        return (b.discountPercent || 0) - (a.discountPercent || 0) || b.stockQuantity - a.stockQuantity;
      })
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
            brand: product.brand,
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
