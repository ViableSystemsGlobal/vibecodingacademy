import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/brands - List all brands
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const brands = await prisma.brand.findMany({
      where,
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(brands);
  } catch (error) {
    console.error("Error fetching brands:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch brands", details: errorMessage },
      { status: 500 }
    );
  }
}

// POST /api/brands - Create a new brand
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description } = body;

    // Validate required fields
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Brand name is required" },
        { status: 400 }
      );
    }

    // Check if brand name already exists
    // Note: SQLite doesn't support mode: "insensitive" in Prisma queries
    const trimmedName = name.trim();
    
    // Check for existing brand with exact match
    const existingBrand = await prisma.brand.findUnique({
      where: {
        name: trimmedName,
      },
    });
    
    if (existingBrand) {
      return NextResponse.json(
        { error: "Brand with this name already exists" },
        { status: 400 }
      );
    }

    const brand = await prisma.brand.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
      },
    });

    return NextResponse.json(brand, { status: 201 });
  } catch (error: any) {
    console.error("Error creating brand:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorCode = error?.code;
    console.error("Error details:", { 
      errorMessage, 
      errorStack, 
      errorCode,
      errorName: error?.name,
      fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
    });
    
    // Check if it's a table doesn't exist error
    if (
      errorMessage.includes("does not exist") ||
      errorMessage.includes("Table") ||
      errorMessage.includes("no such table") ||
      errorCode === "P2001" ||
      errorCode === "42P01"
    ) {
      return NextResponse.json(
        { 
          error: "Brand table does not exist. Please run: npx prisma db push",
          code: "MIGRATION_REQUIRED",
          details: errorMessage
        },
        { status: 500 }
      );
    }

    // Check if it's a unique constraint violation
    if (
      errorMessage.includes("Unique constraint") ||
      errorMessage.includes("unique constraint") ||
      errorMessage.includes("UNIQUE constraint failed") ||
      errorCode === "P2002"
    ) {
      return NextResponse.json(
        { error: "Brand with this name already exists" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        error: "Failed to create brand", 
        details: errorMessage, 
        code: errorCode,
        message: errorMessage
      },
      { status: 500 }
    );
  }
}

