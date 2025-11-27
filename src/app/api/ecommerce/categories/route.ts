import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const THIRTY_DAYS_MS = 1000 * 60 * 60 * 24 * 30;

function toInt(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
  }
  return fallback;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const featured = searchParams.get("featured");

    const where: Record<string, unknown> = {};

    if (search?.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: "insensitive" } },
        { description: { contains: search.trim(), mode: "insensitive" } },
      ];
    }

    if (featured === "true") {
      where.ecommerceConfig = {
        isFeatured: true,
      };
    }

    const [categories, productCounts, activeCounts, newCounts] =
      await Promise.all([
        prisma.category.findMany({
          where,
          include: {
            parent: {
              select: {
                id: true,
                name: true,
              },
            },
            ecommerceConfig: {
              select: {
                isFeatured: true,
                displayOrder: true,
                heroImageUrl: true,
                tileImageUrl: true,
                marketingTagline: true,
                merchandisingNotes: true,
                opsNotes: true,
                aiPrompt: true,
                updatedBy: true,
                updatedAt: true,
                createdAt: true,
              },
            },
            _count: {
              select: {
                children: true,
                products: true,
              },
            },
          },
          orderBy: [
            {
              ecommerceConfig: {
                displayOrder: "asc",
              },
            },
            { name: "asc" },
          ],
        }),
        prisma.product.groupBy({
          by: ["categoryId"],
          _count: { _all: true },
        }),
        prisma.product.groupBy({
          by: ["categoryId"],
          where: { active: true },
          _count: { _all: true },
        }),
        prisma.product.groupBy({
          by: ["categoryId"],
          where: {
            createdAt: {
              gte: new Date(Date.now() - THIRTY_DAYS_MS),
            },
          },
          _count: { _all: true },
        }),
      ]);

    const activeLookup = new Map(
      activeCounts.map((item) => [item.categoryId, item._count._all])
    );
    const newLookup = new Map(
      newCounts.map((item) => [item.categoryId, item._count._all])
    );
    const productLookup = new Map(
      productCounts.map((item) => [item.categoryId, item._count._all])
    );

    const data = categories.map((category) => {
      const productCount =
        productLookup.get(category.id) ?? category._count.products ?? 0;
      const activeProductCount = activeLookup.get(category.id) ?? 0;
      const newProductsLast30Days = newLookup.get(category.id) ?? 0;

      return {
        id: category.id,
        name: category.name,
        description: category.description,
        parent: category.parent
          ? { id: category.parent.id, name: category.parent.name }
          : null,
        childCount: category._count.children,
        productCount,
        activeProductCount,
        newProductsLast30Days,
        ecommerce: category.ecommerceConfig
          ? {
              isFeatured: category.ecommerceConfig.isFeatured,
              displayOrder: category.ecommerceConfig.displayOrder,
              heroImageUrl: category.ecommerceConfig.heroImageUrl,
              tileImageUrl: category.ecommerceConfig.tileImageUrl,
              marketingTagline: category.ecommerceConfig.marketingTagline,
              merchandisingNotes: category.ecommerceConfig.merchandisingNotes,
              opsNotes: category.ecommerceConfig.opsNotes,
              aiPrompt: category.ecommerceConfig.aiPrompt,
              updatedBy: category.ecommerceConfig.updatedBy,
              updatedAt: category.ecommerceConfig.updatedAt,
              createdAt: category.ecommerceConfig.createdAt,
            }
          : null,
      };
    });

    const totalCategories = data.length;
    const featuredCategories = data.filter(
      (category) => category.ecommerce?.isFeatured
    ).length;
    const totalProducts = data.reduce(
      (sum, category) => sum + category.productCount,
      0
    );
    const totalActiveProducts = data.reduce(
      (sum, category) => sum + category.activeProductCount,
      0
    );
    const newProductsLast30Days = data.reduce(
      (sum, category) => sum + category.newProductsLast30Days,
      0
    );

    return NextResponse.json({
      data,
      metrics: {
        totalCategories,
        featuredCategories,
        totalProducts,
        totalActiveProducts,
        newProductsLast30Days,
      },
    });
  } catch (error) {
    console.error("Error fetching ecommerce categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch ecommerce categories" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { categoryId, ...payload } = body ?? {};

    if (!categoryId || typeof categoryId !== "string") {
      return NextResponse.json(
        { error: "categoryId is required" },
        { status: 400 }
      );
    }

    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    const allowedFields = new Set([
      "isFeatured",
      "displayOrder",
      "heroImageUrl",
      "tileImageUrl",
      "marketingTagline",
      "merchandisingNotes",
      "opsNotes",
      "aiPrompt",
    ]);

    const updateData: Record<string, unknown> = {};

    Object.entries(payload).forEach(([key, value]) => {
      if (!allowedFields.has(key)) return;

      if (key === "displayOrder") {
        updateData.displayOrder = toInt(value);
      } else if (typeof value === "string") {
        updateData[key] = value.trim() === "" ? null : value.trim();
      } else {
        updateData[key] = value;
      }
    });

    updateData.updatedBy = session.user.id;

    const ecommerceConfig = await prisma.ecommerceCategoryConfig.upsert({
      where: { categoryId },
      update: updateData,
      create: {
        categoryId,
        isFeatured:
          typeof updateData.isFeatured === "boolean"
            ? (updateData.isFeatured as boolean)
            : false,
        displayOrder:
          typeof updateData.displayOrder === "number"
            ? (updateData.displayOrder as number)
            : 0,
        heroImageUrl: (updateData.heroImageUrl as string | undefined) ?? null,
        tileImageUrl: (updateData.tileImageUrl as string | undefined) ?? null,
        marketingTagline:
          (updateData.marketingTagline as string | undefined) ?? null,
        merchandisingNotes:
          (updateData.merchandisingNotes as string | undefined) ?? null,
        opsNotes: (updateData.opsNotes as string | undefined) ?? null,
        aiPrompt: (updateData.aiPrompt as string | undefined) ?? null,
        updatedBy: session.user.id,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      categoryId: ecommerceConfig.categoryId,
      isFeatured: ecommerceConfig.isFeatured,
      displayOrder: ecommerceConfig.displayOrder,
      heroImageUrl: ecommerceConfig.heroImageUrl,
      tileImageUrl: ecommerceConfig.tileImageUrl,
      marketingTagline: ecommerceConfig.marketingTagline,
      merchandisingNotes: ecommerceConfig.merchandisingNotes,
      opsNotes: ecommerceConfig.opsNotes,
      aiPrompt: ecommerceConfig.aiPrompt,
      updatedBy: ecommerceConfig.updatedBy,
      updatedAt: ecommerceConfig.updatedAt,
      createdAt: ecommerceConfig.createdAt,
      category: ecommerceConfig.category,
    });
  } catch (error) {
    console.error("Error updating ecommerce category:", error);
    return NextResponse.json(
      { error: "Failed to update ecommerce category" },
      { status: 500 }
    );
  }
}

