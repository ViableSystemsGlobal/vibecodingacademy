import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/price-lists - List all price lists
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const channel = searchParams.get("channel");
    const status = searchParams.get("status");

    const where: any = {};

    if (search) {
      // SQLite doesn't support mode: "insensitive", using case-sensitive search
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    if (channel && channel !== "all") {
      where.channel = channel;
    }

    if (status && status !== "all") {
      where.status = status;
    }

    const priceLists = await prisma.priceList.findMany({
      where,
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(priceLists);
  } catch (error) {
    console.error("Error fetching price lists:", error);
    return NextResponse.json(
      { error: "Failed to fetch price lists" },
      { status: 500 }
    );
  }
}

// POST /api/price-lists - Create a new price list with auto-populated products
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      channel,
      currency = "USD",
      calculationType = "DISCOUNT",
      basePrice = "SELLING",
      percentage = 0,
      effectiveFrom,
      effectiveTo,
      includeInactive = false,
    } = body;
    
    // Ensure percentage is a number
    const numericPercentage = typeof percentage === 'string' ? parseFloat(percentage) : percentage;

    // Validate required fields
    if (!name || !channel) {
      return NextResponse.json(
        { error: "Name and channel are required" },
        { status: 400 }
      );
    }

    // Validate percentage
    if (numericPercentage < 0 || numericPercentage > 100) {
      return NextResponse.json(
        { error: "Percentage must be between 0 and 100" },
        { status: 400 }
      );
    }

    // Check if price list name already exists for the same channel
    const existingPriceList = await prisma.priceList.findFirst({
      where: {
        name,
        channel,
      },
    });

    if (existingPriceList) {
      return NextResponse.json(
        { error: "Price list with this name already exists for this channel" },
        { status: 400 }
      );
    }

    // Create the price list
    const priceList = await prisma.priceList.create({
      data: {
        name,
        channel,
        currency,
        calculationType,
        basePrice,
        percentage: numericPercentage,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
        effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
      },
    });

    // Import currency conversion function
    const { convertCurrency } = await import('@/lib/currency');

    // Fetch all products (active or all based on includeInactive)
    const products = await prisma.product.findMany({
      where: includeInactive ? {} : { active: true },
      select: {
        id: true,
        sku: true,
        name: true,
        price: true,
        cost: true,
        originalPrice: true,
        originalCost: true,
        originalPriceCurrency: true,
        originalCostCurrency: true,
        baseCurrency: true,
      },
    });
    

    // Calculate prices and create price list items for all products
    const priceListItemsPromises = products.map(async (product) => {
      // Determine which price to use and what currency it's in
      let sourcePrice: number;
      let sourceCurrency: string;
      
      if (basePrice === "COST") {
        // Use cost - prefer original cost if available
        if (product.originalCost && product.originalCostCurrency) {
          sourcePrice = product.originalCost;
          sourceCurrency = product.originalCostCurrency;
        } else {
          sourcePrice = product.cost || 0;
          sourceCurrency = product.baseCurrency || 'USD';
        }
      } else {
        // Use selling price - prefer original price if available
        if (product.originalPrice && product.originalPriceCurrency) {
          sourcePrice = product.originalPrice;
          sourceCurrency = product.originalPriceCurrency;
        } else {
          sourcePrice = product.price || 0;
          sourceCurrency = product.baseCurrency || 'USD';
        }
      }
      
      // Convert to price list currency if needed
      let convertedPrice = sourcePrice;
      if (sourceCurrency !== currency && sourcePrice > 0) {
        try {
          const conversion = await convertCurrency(sourceCurrency, currency, sourcePrice);
          if (conversion) {
            convertedPrice = conversion.convertedAmount;
          } else {
            console.warn(`Failed to convert ${sourceCurrency} to ${currency} for product ${product.id}, using original price`);
          }
        } catch (error) {
          console.error(`Error converting price for product ${product.id}:`, error);
          // Fallback to original price if conversion fails
        }
      }
      
      // Calculate unit price based on calculation type
      let unitPrice: number;
      if (calculationType === "MARKUP") {
        // Markup: increase price by percentage
        unitPrice = convertedPrice * (1 + numericPercentage / 100);
      } else {
        // Discount: decrease price by percentage
        unitPrice = convertedPrice * (1 - numericPercentage / 100);
      }

      return {
        priceListId: priceList.id,
        productId: product.id,
        unitPrice: Math.round(unitPrice * 100) / 100, // Round to 2 decimal places
        basePrice: convertedPrice,
      };
    });

    // Wait for all conversions to complete
    const priceListItems = await Promise.all(priceListItemsPromises);

    // Bulk create price list items
    if (priceListItems.length > 0) {
      await prisma.priceListItem.createMany({
        data: priceListItems,
      });
    }

    // Fetch the complete price list with items
    const completePriceList = await prisma.priceList.findUnique({
      where: { id: priceList.id },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
    });

    return NextResponse.json(completePriceList, { status: 201 });
  } catch (error) {
    console.error("Error creating price list:", error);
    return NextResponse.json(
      { error: "Failed to create price list" },
      { status: 500 }
    );
  }
}
