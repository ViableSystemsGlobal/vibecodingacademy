import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NotificationService, SystemNotificationTriggers } from "@/lib/notification-service";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateBarcode, validateBarcode, detectBarcodeType } from "@/lib/barcode-utils";
import { parseTableQuery, buildTableQuery, buildWhereClause, buildOrderBy } from "@/lib/query-builder";
import { Prisma } from "@prisma/client";

// GET /api/products - List all products
export async function GET(request: NextRequest) {
  try {
    const params = parseTableQuery(request);
    
    // Custom filter handler for category (nested relation)
    const customFilters = (filters: Record<string, string | string[] | null>) => {
      const where: any = {};
      
      if (filters.category && filters.category !== 'all') {
        where.category = { name: filters.category };
      }
      
      if (filters.status && filters.status !== 'all') {
        where.status = filters.status;
      }
      
      if (filters.type && filters.type !== 'all') {
        where.type = filters.type;
      }
      
      if (filters.active !== undefined && filters.active !== null) {
        where.active = filters.active === 'true' || filters.active === true;
      }
      
      return where;
    };

    // Handle category sorting specially (nested relation)
    let orderBy = buildOrderBy(params.sortBy, params.sortOrder);
    if (params.sortBy === 'category') {
      orderBy = { category: { name: params.sortOrder || 'asc' } };
    }
    // 'active' field is handled by buildOrderBy, no special case needed

    const where = buildWhereClause(params, {
      searchFields: ['name', 'sku', 'serviceCode', 'description'], // 'brand' removed - it's a relation
      customFilters,
    });

    // Add brand name search (it's a relation, so we need to handle it separately)
    if (params.search && (where as any).OR) {
      (where as any).OR.push({
        brand: { name: { contains: params.search } }
      });
    }

    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          stockItems: {
            include: {
              warehouse: true
            }
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    const result = {
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      sort: params.sortBy
        ? {
            field: params.sortBy,
            order: params.sortOrder || 'desc',
          }
        : undefined,
    };

    // Get total counts for metrics (using base where clause without pagination)
    const baseWhere = buildWhereClause(params, {
      searchFields: ['name', 'sku', 'serviceCode', 'description'], // 'brand' removed - it's a relation
      customFilters,
    });

    // Add brand name search to baseWhere as well
    if (params.search && (baseWhere as any).OR) {
      (baseWhere as any).OR.push({
        brand: { name: { contains: params.search } }
      });
    }

    const [totalActive, totalLowStock, totalOutOfStock] = await Promise.all([
      prisma.product.count({ 
        where: { 
          ...baseWhere, 
          active: true 
        } 
      }),
      prisma.product.count({
        where: {
          ...baseWhere,
          stockItems: {
            some: {
              available: {
                lte: 10 // Assuming 10 is the low stock threshold
              }
            }
          }
        }
      }),
      prisma.product.count({
        where: {
          ...baseWhere,
          stockItems: {
            some: {
              available: 0
            }
          }
        }
      }),
    ]);

    // Manually add bestDealPrice and currency info to each product since Prisma client may not recognize some fields
    // Fetch all additional fields in one query for efficiency
    const productIds = result.data.map((p: any) => p.id);
    let bestDealPricesMap: Record<string, number | null> = {};
    let currencyInfoMap: Record<string, { originalPriceCurrency?: string; baseCurrency?: string }> = {};
    
    if (productIds.length > 0) {
      try {
        const placeholders = productIds.map(() => '?').join(',');
        const [pricesRaw, currencyRaw] = await Promise.all([
          (prisma as any).$queryRawUnsafe(
            `SELECT id, "bestDealPrice" FROM products WHERE id IN (${placeholders})`,
            ...productIds
          ),
          (prisma as any).$queryRawUnsafe(
            `SELECT id, "originalPriceCurrency", "baseCurrency" FROM products WHERE id IN (${placeholders})`,
            ...productIds
          ),
        ]);
        
        bestDealPricesMap = (pricesRaw as any[]).reduce((acc: Record<string, number | null>, row: any) => {
          acc[row.id] = row.bestDealPrice;
          return acc;
        }, {});
        
        currencyInfoMap = (currencyRaw as any[]).reduce((acc: Record<string, any>, row: any) => {
          acc[row.id] = {
            originalPriceCurrency: row.originalPriceCurrency,
            baseCurrency: row.baseCurrency,
          };
          return acc;
        }, {});
      } catch (error) {
        console.error("Error fetching product metadata:", error);
        // Continue without metadata if query fails
      }
    }

    const productsWithBestDealPrice = result.data.map((product: any) => {
      const currencyInfo = currencyInfoMap[product.id] || {};
      return {
        ...product,
        bestDealPrice: bestDealPricesMap[product.id] || null,
        originalPriceCurrency: currencyInfo.originalPriceCurrency || product.originalPriceCurrency,
        baseCurrency: currencyInfo.baseCurrency || product.baseCurrency,
      };
    });

    return NextResponse.json({
      products: productsWithBestDealPrice,
      pagination: result.pagination,
      metrics: {
        totalActive,
        totalLowStock,
        totalOutOfStock,
      },
      sort: result.sort,
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}

// POST /api/products - Create a new product
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = await request.json();
    const {
      type = "PRODUCT",
      sku,
      serviceCode,
      name,
      description,
      categoryId,
      duration,
      unit,
      barcode: providedBarcode,
      barcodeType: providedBarcodeType,
      generateBarcode: shouldGenerateBarcode = true,
      supplierBarcode,
      supplierName,
      price,
      cost,
      costPrice,
      costCurrency,
      sellingCurrency,
      exchangeRateMode,
      customExchangeRate,
      originalPrice,
      originalCost,
      originalPriceCurrency,
      originalCostCurrency,
      exchangeRateAtImport,
      baseCurrency,
      uomBase,
      uomSell,
      reorderPoint,
      attributes,
      images,
      active = true,
    } = body;

    // Validate required fields based on type
    if (!name || !categoryId) {
      return NextResponse.json(
        { error: "Name and category are required" },
        { status: 400 }
      );
    }

    // For products, SKU is required; for services, serviceCode is required
    if (type === "PRODUCT" && !sku) {
      return NextResponse.json(
        { error: "SKU is required for products" },
        { status: 400 }
      );
    }
    
    if (type === "SERVICE" && !serviceCode) {
      return NextResponse.json(
        { error: "Service Code is required for services" },
        { status: 400 }
      );
    }

    // Check if SKU or Service Code already exists
    if (type === "PRODUCT" && sku) {
      const existingProduct = await prisma.product.findFirst({
        where: { sku },
      });

      if (existingProduct) {
        return NextResponse.json(
          { error: "Product with this SKU already exists" },
          { status: 400 }
        );
      }
    }
    
    if (type === "SERVICE" && serviceCode) {
      const existingService = await prisma.product.findFirst({
        where: { serviceCode },
      });

      if (existingService) {
        return NextResponse.json(
          { error: "Service with this Service Code already exists" },
          { status: 400 }
        );
      }
    }

    // Handle barcode generation/validation
    let finalBarcode = providedBarcode?.trim() || null;
    let finalBarcodeType = providedBarcodeType || 'EAN13';

    if (!finalBarcode && shouldGenerateBarcode) {
      // Generate barcode from SKU or Service Code
      const codeForBarcode = type === "SERVICE" ? serviceCode : sku;
      finalBarcode = generateBarcode(codeForBarcode, finalBarcodeType as any);
      
      // Ensure uniqueness
      let attempts = 0;
      while (attempts < 5) {
        const existingBarcode = await prisma.product.findUnique({
          where: { barcode: finalBarcode as string }
        });
        
        if (!existingBarcode) break;
        
        // Add timestamp to ensure uniqueness
        finalBarcode = generateBarcode(`${codeForBarcode}-${Date.now()}`, finalBarcodeType as any);
        attempts++;
      }
    }

    // Validate barcode if provided
    if (finalBarcode) {
      const detectedType = detectBarcodeType(finalBarcode);
      finalBarcodeType = providedBarcodeType || detectedType;
      
      if (!validateBarcode(finalBarcode, finalBarcodeType as any)) {
        return NextResponse.json(
          { error: 'Invalid barcode format' },
          { status: 400 }
        );
      }
      
      // Check for duplicates
      const duplicateBarcode = await prisma.product.findUnique({
        where: { barcode: finalBarcode }
      });
      
      if (duplicateBarcode) {
        return NextResponse.json(
          { error: 'Barcode already exists on another product' },
          { status: 400 }
        );
      }
    }

    const product = await prisma.product.create({
      data: {
        type,
        sku: type === "PRODUCT" ? sku : null,
        serviceCode: type === "SERVICE" ? serviceCode : null,
        name,
        description,
        categoryId,
        barcode: finalBarcode,
        barcodeType: finalBarcode ? finalBarcodeType : null,
        generateBarcode: shouldGenerateBarcode,
        price: price ? parseFloat(price) : 0,
        cost: cost ? parseFloat(cost) : 0,
        costPrice: costPrice ? parseFloat(costPrice) : (cost ? parseFloat(cost) : 0),
        originalPrice: originalPrice ? parseFloat(originalPrice) : (price ? parseFloat(price) : 0),
        originalCost: originalCost ? parseFloat(originalCost) : (cost ? parseFloat(cost) : 0),
        originalPriceCurrency: originalPriceCurrency || sellingCurrency || "USD",
        originalCostCurrency: originalCostCurrency || costCurrency || "USD",
        exchangeRateAtImport: exchangeRateAtImport ? parseFloat(exchangeRateAtImport) : null,
        baseCurrency: baseCurrency || sellingCurrency || "USD",
        uomBase,
        uomSell,
        duration: type === "SERVICE" ? duration : null,
        unit: type === "SERVICE" ? unit : null,
        attributes: attributes || {},
        images: images || null,
        active,
      },
      include: {
        category: true,
        additionalBarcodes: true,
      },
    });

    // After product creation, handle supplier barcode if provided
    if (supplierBarcode && supplierBarcode !== finalBarcode) {
      try {
        await prisma.productBarcode.create({
          data: {
            productId: product.id,
            barcode: supplierBarcode,
            barcodeType: detectBarcodeType(supplierBarcode),
            source: supplierName || 'Supplier',
            description: 'Supplier barcode',
            isPrimary: false,
            isActive: true
          }
        });
      } catch (error) {
        console.error('Error creating supplier barcode:', error);
        // Don't fail the entire request if supplier barcode fails
      }
    }

    // Get the default warehouse (Main Warehouse)
    const defaultWarehouse = await prisma.warehouse.findFirst({
      where: { code: 'MAIN' }
    });

    // Create initial stock item for the product
    const productCostPrice = costPrice ? parseFloat(costPrice) : (cost ? parseFloat(cost) : 0);
    await prisma.stockItem.create({
      data: {
        productId: product.id,
        quantity: 0,
        reserved: 0,
        available: 0,
        averageCost: cost ? parseFloat(cost) : 0,
        totalValue: 0 * productCostPrice, // Will be 0 initially, but uses costPrice for consistency
        reorderPoint: reorderPoint ? parseFloat(reorderPoint) : 0,
        warehouseId: defaultWarehouse?.id, // Assign to default warehouse
      },
    });

    // Send notification to inventory managers about new product
    if (session?.user) {
      const trigger = {
        type: 'SYSTEM_ALERT' as const,
        title: 'New Product Created',
        message: `Product "${product.name}" (SKU: ${product.sku}) has been created and added to inventory.`,
        channels: ['IN_APP' as const, 'EMAIL' as const],
        data: { productId: product.id, productName: product.name, sku: product.sku }
      };
      
      await NotificationService.sendToInventoryManagers(trigger);
    }

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("Error creating product:", error);
    return NextResponse.json(
      { error: "Failed to create product" },
      { status: 500 }
    );
  }
}
