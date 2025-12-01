import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseTableQuery, buildWhereClause, buildOrderBy } from '@/lib/query-builder';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = parseTableQuery(request);

    // Custom filter handler
    const customFilters = (filters: Record<string, string | string[] | null>) => {
      const where: any = {};

      // Handle category filter (can come from filters.category or direct category param)
      const categoryFilter = filters.category || (params as any).category;
      if (categoryFilter && categoryFilter !== 'all' && categoryFilter !== '') {
        where.categoryId = categoryFilter;
      }

      if (filters.active !== undefined && filters.active !== null) {
        where.active = filters.active === 'true' || filters.active === true;
      }

      // Note: stockStatus and price range filters are applied after aggregation
      // They're handled separately below

      return where;
    };

    const where = buildWhereClause(params, {
      searchFields: ['name', 'sku'],
      customFilters,
    });

    // Ensure where clause is not empty object (Prisma needs at least {})
    // If where is empty, it means no filters, so we want all products
    const finalWhere = Object.keys(where).length === 0 ? {} : where;

    const orderBy = buildOrderBy(params.sortBy, params.sortOrder);
    const page = params.page || 1;
    const limit = params.limit || 10;

    // Fetch ALL products matching the base where clause (before filtering)
    // We need to process all products to calculate stock metrics, then filter, then paginate
    console.log('📦 Stock API - Fetching products with where clause:', JSON.stringify(finalWhere, null, 2));
    console.log('📦 Stock API - Query params:', { 
      stockStatus: params.filters?.stockStatus || params.stockStatus,
      category: params.filters?.category || params.category,
      search: params.search 
    });
    
    let allProducts;
    try {
      allProducts = await prisma.product.findMany({
        where: finalWhere,
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          stockItems: {
            // Include all stockItems, not just those with warehouseId
            // We'll filter for metrics calculation but show all products
            include: {
              warehouse: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
            },
            // Don't fail if warehouse doesn't exist
            take: undefined, // Get all stock items
          },
        },
      });
      console.log('📦 Stock API - Found products:', allProducts.length);
    } catch (dbError) {
      console.error('📦 Stock API - Database error:', dbError);
      console.error('📦 Stock API - Database error details:', {
        message: dbError instanceof Error ? dbError.message : String(dbError),
        name: dbError instanceof Error ? dbError.name : undefined,
        code: (dbError as any)?.code,
        meta: (dbError as any)?.meta,
      });
      throw new Error(`Database query failed: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
    }

    // Process products to calculate aggregated stock metrics
    const processedProducts = allProducts.map((product) => {
      try {
        // For aggregation, only count stockItems with warehouseId (for metrics)
        const stockItemsForMetrics = (product.stockItems || []).filter(item => item.warehouseId !== null);
        // For display, show all stockItems
        const allStockItems = product.stockItems || [];
        
        // Aggregate stock across all warehouses (only those with warehouseId for metrics)
        const totalQuantity = stockItemsForMetrics.reduce((sum, item) => sum + (item.quantity || 0), 0);
        const totalReserved = stockItemsForMetrics.reduce((sum, item) => sum + (item.reserved || 0), 0);
        const totalAvailable = stockItemsForMetrics.reduce((sum, item) => sum + (item.available || 0), 0);
        const maxReorderPoint = stockItemsForMetrics.reduce((max, item) => Math.max(max, item.reorderPoint || 0), 0);
        
        // Calculate total inventory value (using averageCost)
        const totalValue = stockItemsForMetrics.reduce((sum, item) => {
          const itemValue = (item.quantity || 0) * (item.averageCost || 0);
          return sum + itemValue;
        }, 0);

        // Determine stock status
        let stockStatus = 'out-of-stock';
        if (totalAvailable > maxReorderPoint) {
          stockStatus = 'in-stock';
        } else if (totalAvailable > 0) {
          stockStatus = 'low-stock';
        }

        return {
          ...product,
          stockItems: allStockItems.map(item => ({
            ...item,
            warehouse: item.warehouse || null, // Ensure warehouse is null if not loaded
          })),
          // Aggregated stock metrics
          totalQuantity,
          totalReserved,
          totalAvailable,
          maxReorderPoint,
          totalValue,
          stockStatus,
        };
      } catch (productError) {
        console.error(`❌ Error processing product ${product.id}:`, productError);
        // Return product with default values if processing fails
        return {
          ...product,
          stockItems: [],
          totalQuantity: 0,
          totalReserved: 0,
          totalAvailable: 0,
          maxReorderPoint: 0,
          totalValue: 0,
          stockStatus: 'out-of-stock',
        };
      }
    });

    // Apply stock status filter if provided (after processing)
    let filteredProducts = processedProducts;
    const stockStatusFilter = params.filters?.stockStatus || params.stockStatus;
    if (stockStatusFilter && stockStatusFilter !== 'all' && stockStatusFilter !== '') {
      filteredProducts = processedProducts.filter((p: any) => p.stockStatus === stockStatusFilter);
    }

    // Apply price range filter if provided
    const priceMin = params.filters?.priceMin || params.priceMin;
    const priceMax = params.filters?.priceMax || params.priceMax;
    if (priceMin || priceMax) {
      const min = priceMin ? parseFloat(priceMin as string) : null;
      const max = priceMax ? parseFloat(priceMax as string) : null;
      
      filteredProducts = filteredProducts.filter((p: any) => {
        if (min !== null && p.price && p.price < min) return false;
        if (max !== null && p.price && p.price > max) return false;
        return true;
      });
    }

    // Calculate metrics from all processed products (before status/price filtering)
    const metrics = {
      totalProducts: processedProducts.length,
      inStockProducts: processedProducts.filter((p) => p.stockStatus === 'in-stock').length,
      lowStockProducts: processedProducts.filter((p) => p.stockStatus === 'low-stock').length,
      outOfStockProducts: processedProducts.filter((p) => p.stockStatus === 'out-of-stock').length,
    };

    // Apply sorting to filtered products
    if (params.sortBy) {
      filteredProducts.sort((a: any, b: any) => {
        const aVal = a[params.sortBy!];
        const bVal = b[params.sortBy!];
        const order = params.sortOrder === 'asc' ? 1 : -1;
        
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return aVal.localeCompare(bVal) * order;
        }
        return (aVal > bVal ? 1 : -1) * order;
      });
    }

    // Paginate filtered products
    const total = filteredProducts.length;
    const skip = (page - 1) * limit;
    const paginatedProducts = filteredProducts.slice(skip, skip + limit);

    console.log('📦 Stock API - Returning:', {
      totalProducts: allProducts.length,
      filteredProducts: filteredProducts.length,
      paginatedProducts: paginatedProducts.length,
      page,
      limit,
      total,
    });

    return NextResponse.json({
      products: paginatedProducts,
      metrics,
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
    });
  } catch (error) {
    console.error('❌ Stock API Error:', error);
    console.error('❌ Error type:', typeof error);
    console.error('❌ Error constructor:', error?.constructor?.name);
    
    // Safely extract error information
    let errorMessage = 'Failed to fetch stock';
    let errorStack: string | undefined;
    let errorName: string | undefined;
    
    if (error instanceof Error) {
      errorMessage = error.message;
      errorStack = error.stack;
      errorName = error.name;
    } else if (typeof error === 'object' && error !== null) {
      errorMessage = (error as any).message || String(error);
      errorStack = (error as any).stack;
      errorName = (error as any).name;
    } else {
      errorMessage = String(error);
    }
    
    // Log full error details
    console.error('❌ Error details:', {
      message: errorMessage,
      name: errorName,
      stack: errorStack?.substring(0, 500), // First 500 chars of stack
    });
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch stock',
        message: errorMessage,
        name: errorName,
        // Only include stack in development
        ...(process.env.NODE_ENV === 'development' && errorStack ? { stack: errorStack.substring(0, 1000) } : {}),
      },
      { status: 500 }
    );
  }
}

