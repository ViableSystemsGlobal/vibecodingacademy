"use server";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEFAULT_RANGE_DAYS = 30;

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const rangeDaysParam = searchParams.get("days");
    const rangeDays = Number(rangeDaysParam) > 0 ? Number(rangeDaysParam) : DEFAULT_RANGE_DAYS;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - rangeDays + 1);

    const orders = await prisma.ecommerceOrder.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        items: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const totalRevenue = orders.reduce((sum, order) => sum + order.total.toNumber(), 0);
    const totalOrders = orders.length;
    const totalItems = orders.reduce(
      (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0
    );
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const orderCountByStatus = orders.reduce<Record<string, number>>((acc, order) => {
      acc[order.status] = (acc[order.status] ?? 0) + 1;
      return acc;
    }, {});

    const revenueByDayMap = new Map<string, number>();

    for (const order of orders) {
      const dayKey = order.createdAt.toISOString().slice(0, 10);
      const current = revenueByDayMap.get(dayKey) ?? 0;
      revenueByDayMap.set(dayKey, current + order.total.toNumber());
    }

    const revenueTrend = Array.from(revenueByDayMap.entries())
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));

    const topProductsRaw = await prisma.ecommerceOrderItem.groupBy({
      by: ["productId", "productName"],
      where: {
        order: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      },
      _sum: {
        quantity: true,
        totalPrice: true,
      },
      orderBy: {
        _sum: {
          quantity: "desc",
        },
      },
      take: 5,
    });

    const topProducts = topProductsRaw.map((product) => ({
      productId: product.productId,
      name: product.productName ?? "Product",
      quantity: product._sum.quantity ?? 0,
      revenue: product._sum.totalPrice ? product._sum.totalPrice.toNumber() : 0,
    }));

    const recentOrdersRaw = await prisma.ecommerceOrder.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        total: true,
        currency: true,
        status: true,
        paymentStatus: true,
        createdAt: true,
      },
    });

    const recentOrders = recentOrdersRaw.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      total: order.total.toNumber(),
      currency: order.currency,
      status: order.status,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt,
    }));

    return NextResponse.json({
      range: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        days: rangeDays,
      },
      metrics: {
        totalRevenue,
        totalOrders,
        averageOrderValue,
        totalItems,
        orderCountByStatus,
      },
      revenueTrend,
      topProducts,
      recentOrders,
    });
  } catch (error) {
    console.error("Failed to load ecommerce analytics:", error);
    return NextResponse.json(
      {
        error: "Failed to load ecommerce analytics",
      },
      { status: 500 }
    );
  }
}

