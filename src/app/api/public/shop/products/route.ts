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

    const where: any = {
      active: true,
      type: "PRODUCT", // Only show products, not services (for now)
    };

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
          select: {
            available: true,
            warehouseId: true,
          },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy,
    });

    // Transform products for public consumption
    const transformedProducts = await Promise.all(products.map(async (product) => {
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

      const priceCurrency = product.originalPriceCurrency || product.baseCurrency || "GHS";
      const originalCurrency = product.originalPriceCurrency || priceCurrency;

      let priceInGHS = product.price || 0;
      let originalPriceInGHS = product.originalPrice || null;

      if (priceCurrency !== "GHS" && product.price) {
        const priceConversion = await convertCurrency(priceCurrency, "GHS", product.price);
        if (priceConversion) {
          priceInGHS = priceConversion.convertedAmount;
        }
      }

      if (originalPriceInGHS && originalCurrency !== "GHS") {
        const originalPriceConversion = await convertCurrency(originalCurrency, "GHS", originalPriceInGHS);
        if (originalPriceConversion) {
          originalPriceInGHS = originalPriceConversion.convertedAmount;
        }
      }

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
          select: {
            available: true,
            warehouseId: true,
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

    const priceCurrency = product.originalPriceCurrency || product.baseCurrency || "GHS";
    const originalCurrency = product.originalPriceCurrency || priceCurrency;

    let priceInGHS = product.price || 0;
    let originalPriceInGHS = product.originalPrice || null;

    if (priceCurrency !== "GHS" && product.price) {
      const priceConversion = await convertCurrency(priceCurrency, "GHS", product.price);
      if (priceConversion) {
        priceInGHS = priceConversion.convertedAmount;
      }
    }

    if (originalPriceInGHS && originalCurrency !== "GHS") {
      const originalPriceConversion = await convertCurrency(originalCurrency, "GHS", originalPriceInGHS);
      if (originalPriceConversion) {
        originalPriceInGHS = originalPriceConversion.convertedAmount;
      }
    }

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
    });
  } catch (error) {
    console.error("Error fetching product details:", error);
    return NextResponse.json(
      { error: "Failed to fetch product" },
      { status: 500 }
    );
  }
}
