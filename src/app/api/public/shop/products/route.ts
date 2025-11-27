import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { convertCurrency } from "@/lib/currency";

// GET /api/public/shop/products - List products for shop
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const category = searchParams.get("category");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "12");
    const sort = searchParams.get("sort") || "newest";
    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");
    const bestDealsOnly = searchParams.get("bestDealsOnly") === "true";

    const where: any = {
      active: true,
      type: "PRODUCT", // Only show products, not services (for now)
    };

    // Filter for best deals only if requested
    if (bestDealsOnly) {
      // We'll filter this after fetching since Prisma might not recognize isBestDeal
    }

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
        { sku: { contains: search } },
      ];
    }

    // Category filter
    if (category) {
      where.categoryId = category;
    }

    // Price range filter
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(minPrice);
      if (maxPrice) where.price.lte = parseFloat(maxPrice);
    }

    // Determine sort order
    let orderBy: any = {};
    switch (sort) {
      case "price-asc":
        orderBy = { price: "asc" };
        break;
      case "price-desc":
        orderBy = { price: "desc" };
        break;
      case "name":
        orderBy = { name: "asc" };
        break;
      case "newest":
      default:
        orderBy = { createdAt: "desc" };
    }

    // Get products with stock information
    const products = await prisma.product.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        stockItems: {
          include: {
            warehouse: {
          select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy,
    });

    // Fetch best deal data for these products using raw SQL
    const productIds = products.map(p => p.id);
    let bestDealData = new Map<string, { isBestDeal: boolean; bestDealPrice: number | null }>();
    
    if (productIds.length > 0) {
      try {
        // Build SQL query with proper escaping for SQLite
        const idsString = productIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',');
        const bestDealsRaw = await (prisma as any).$queryRawUnsafe(
          `SELECT id, "isBestDeal", "bestDealPrice" FROM products WHERE id IN (${idsString})`
        );
        
        if (Array.isArray(bestDealsRaw)) {
          bestDealsRaw.forEach((row: any) => {
            bestDealData.set(row.id, {
              isBestDeal: row.isBestDeal === 1 || row.isBestDeal === true,
              bestDealPrice: row.bestDealPrice ? Number(row.bestDealPrice) : null,
            });
          });
        }
      } catch (error) {
        console.error('Error fetching best deal data:', error);
      }
    }

    // Filter to best deals only if requested (before transformation to avoid unnecessary processing)
    let productsToTransform = products;
    if (bestDealsOnly) {
      // Get best deal product IDs using raw SQL
      try {
        const productIds = products.map(p => p.id);
        if (productIds.length > 0) {
          const idsString = productIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',');
          const bestDealIdsRaw = await (prisma as any).$queryRawUnsafe(
            `SELECT id FROM products WHERE id IN (${idsString}) AND "isBestDeal" = 1`
          );
          const bestDealIds = new Set(Array.isArray(bestDealIdsRaw) ? bestDealIdsRaw.map((row: any) => row.id) : []);
          productsToTransform = products.filter(p => bestDealIds.has(p.id));
        } else {
          productsToTransform = [];
        }
      } catch (error) {
        console.error('Error filtering best deals:', error);
        productsToTransform = products; // Fallback to all products
      }
    }

    // Transform products for public consumption
    const transformedProducts = await Promise.all(productsToTransform.map(async (product) => {
      const totalStock = product.stockItems.reduce(
        (sum, item) => sum + item.available,
        0
      );

      let images = [];
      if (product.images) {
        try {
          images = JSON.parse(product.images);
        } catch {
          images = [product.images];
        }
      }

      // Get best deal data for this product
      const bestDeal = bestDealData.get(product.id);
      const isBestDeal = bestDeal?.isBestDeal || false;
      const bestDealPrice = bestDeal?.bestDealPrice || null;

      const priceCurrency = product.originalPriceCurrency || product.baseCurrency || "GHS";
      const originalCurrency = product.originalPriceCurrency || priceCurrency;

      // Use bestDealPrice if available (it's already in GHS), otherwise convert regular price
      let priceInGHS = bestDealPrice || product.price || 0;
      let originalPriceInGHS = bestDealPrice ? product.price : (product.originalPrice || null);

      // If no bestDealPrice, convert regular price to GHS
      if (!bestDealPrice && priceCurrency !== "GHS" && product.price) {
        const priceConversion = await convertCurrency(priceCurrency, "GHS", product.price);
        if (priceConversion) {
          priceInGHS = priceConversion.convertedAmount;
        }
      }

      // Convert original price to GHS if needed
      if (originalPriceInGHS && originalCurrency !== "GHS") {
        const originalPriceConversion = await convertCurrency(originalCurrency, "GHS", originalPriceInGHS);
        if (originalPriceConversion) {
          originalPriceInGHS = originalPriceConversion.convertedAmount;
        }
      }

      // Get warehouse-specific stock
      const warehouseStock = product.stockItems
        .filter(item => item.warehouse && item.available > 0)
        .map(item => ({
          warehouseId: item.warehouse.id,
          warehouseName: item.warehouse.name,
          warehouseCode: item.warehouse.code,
          available: item.available,
        }))
        .sort((a, b) => b.available - a.available); // Sort by available stock descending

      return {
        id: product.id,
        name: product.name,
        description: product.description,
        price: Math.round(priceInGHS * 100) / 100,
        originalPrice: originalPriceInGHS ? Math.round(originalPriceInGHS * 100) / 100 : null,
        currency: "GHS",
        sku: product.sku,
        images: images,
        category: product.category,
        inStock: totalStock > 0,
        stockQuantity: totalStock,
        lowStock: totalStock > 0 && totalStock <= 5,
        warehouseStock: warehouseStock, // Add warehouse-specific stock
        isBestDeal: isBestDeal,
        bestDealPrice: bestDealPrice ? Math.round(bestDealPrice * 100) / 100 : null,
      };
    }));

    // Get total count for pagination
    const total = await prisma.product.count({ where });

    return NextResponse.json({
      products: transformedProducts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching shop products:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch products",
        details:
          process.env.NODE_ENV === "development" && error instanceof Error
            ? error.message
            : undefined,
        stack:
          process.env.NODE_ENV === "development" && error instanceof Error
            ? error.stack
            : undefined,
      },
      { status: 500 }
    );
  }
}

// GET product by ID
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId } = body;

    if (!productId) {
      return NextResponse.json(
        { error: "Product ID is required" },
        { status: 400 }
      );
    }

    const product = await prisma.product.findUnique({
      where: { 
        id: productId,
        active: true,
      },
      include: {
        category: true,
        stockItems: {
          include: {
            warehouse: {
          select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    // Calculate total stock
    const totalStock = product.stockItems.reduce(
      (sum, item) => sum + item.available,
      0
    );

    // Parse images
    let images = [];
    if (product.images) {
      try {
        images = JSON.parse(product.images);
      } catch {
        images = [product.images];
      }
    }

    // Parse attributes for additional product details
    let attributes = {};
    if (product.attributes) {
      try {
        attributes = JSON.parse(product.attributes as string);
      } catch {
        attributes = {};
      }
    }

    // Fetch best deal data for this product using raw SQL
    let isBestDeal = false;
    let bestDealPrice: number | null = null;
    
    try {
      const bestDealRaw = await (prisma as any).$queryRawUnsafe(
        `SELECT "isBestDeal", "bestDealPrice" FROM products WHERE id = '${product.id.replace(/'/g, "''")}'`
      );
      
      if (Array.isArray(bestDealRaw) && bestDealRaw.length > 0) {
        const row = bestDealRaw[0];
        isBestDeal = row.isBestDeal === 1 || row.isBestDeal === true;
        bestDealPrice = row.bestDealPrice ? Number(row.bestDealPrice) : null;
      }
    } catch (error) {
      console.error('Error fetching best deal data for product:', error);
    }

    const priceCurrency = product.originalPriceCurrency || product.baseCurrency || "GHS";
    const originalCurrency = product.originalPriceCurrency || priceCurrency;

    // Use bestDealPrice if available (it's already in GHS), otherwise convert regular price
    let priceInGHS = bestDealPrice || product.price || 0;
    let originalPriceInGHS = bestDealPrice ? product.price : (product.originalPrice || null);

    // If no bestDealPrice, convert regular price to GHS
    if (!bestDealPrice && priceCurrency !== "GHS" && product.price) {
      const priceConversion = await convertCurrency(priceCurrency, "GHS", product.price);
      if (priceConversion) {
        priceInGHS = priceConversion.convertedAmount;
      }
    }

    // Convert original price to GHS if needed
    if (originalPriceInGHS && originalCurrency !== "GHS") {
      const originalPriceConversion = await convertCurrency(originalCurrency, "GHS", originalPriceInGHS);
      if (originalPriceConversion) {
        originalPriceInGHS = originalPriceConversion.convertedAmount;
      }
    }

    // Get warehouse-specific stock
    const warehouseStock = product.stockItems
      .filter(item => item.warehouse && item.available > 0)
      .map(item => ({
        warehouseId: item.warehouse.id,
        warehouseName: item.warehouse.name,
        warehouseCode: item.warehouse.code,
        available: item.available,
      }))
      .sort((a, b) => b.available - a.available); // Sort by available stock descending

    return NextResponse.json({
      id: product.id,
      name: product.name,
      description: product.description,
      price: Math.round(priceInGHS * 100) / 100,
      originalPrice: originalPriceInGHS ? Math.round(originalPriceInGHS * 100) / 100 : null,
      currency: "GHS",
      sku: product.sku,
      barcode: product.barcode,
      images: images,
      category: product.category,
      attributes: attributes,
      inStock: totalStock > 0,
      stockQuantity: totalStock,
      lowStock: totalStock > 0 && totalStock <= 5,
      warehouseStock: warehouseStock, // Add warehouse-specific stock
      isBestDeal: isBestDeal,
      bestDealPrice: bestDealPrice ? Math.round(bestDealPrice * 100) / 100 : null,
    });
  } catch (error) {
    console.error("Error fetching product details:", error);
    return NextResponse.json(
      { error: "Failed to fetch product" },
      { status: 500 }
    );
  }
}
