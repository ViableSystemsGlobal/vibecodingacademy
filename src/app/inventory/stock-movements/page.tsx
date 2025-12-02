import { prisma } from "@/lib/prisma";
import { StockMovementsClient } from "./stock-movements-client";

// Force dynamic rendering to prevent build-time database access
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function StockMovementsPage() {
  // Fetch movements server-side to ensure data is available
  let movements: any[] = [];
  try {
    // Fetch movements without product/stockItem includes to handle deleted records
    const rawMovements = await prisma.stockMovement.findMany({
      select: {
        id: true,
        type: true,
        quantity: true,
        reference: true,
        reason: true,
        notes: true,
        userId: true,
        productId: true,
        stockItemId: true, // Select stockItemId instead of including stockItem
        createdAt: true,
        warehouseId: true,
        fromWarehouseId: true,
        toWarehouseId: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Fetch products separately to handle deleted products gracefully
    const productIds = [...new Set(rawMovements.map(m => m.productId).filter(Boolean))];
    const existingProducts = productIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, name: true, sku: true, uomBase: true, images: true },
        })
      : [];
    const productMap = new Map(existingProducts.map(p => [p.id, p]));

    // Fetch stock items separately to handle deleted stock items gracefully
    const stockItemIds = [...new Set(rawMovements.map(m => m.stockItemId).filter(Boolean))];
    const existingStockItems = stockItemIds.length > 0
      ? await prisma.stockItem.findMany({
          where: { id: { in: stockItemIds } },
          select: { id: true, quantity: true, available: true },
        })
      : [];
    const stockItemMap = new Map(existingStockItems.map(si => [si.id, si]));

    // Enrich movements with product and stockItem data
    movements = rawMovements.map(movement => ({
      ...movement,
      product: movement.productId ? productMap.get(movement.productId) || null : null,
      stockItem: movement.stockItemId ? stockItemMap.get(movement.stockItemId) || null : null,
    }));
  } catch (error) {
    console.error('Database error:', error);
    // Return empty array if database is not available
    movements = [];
  }

  return (
    <>
      <StockMovementsClient initialMovements={movements} />
    </>
  );
}