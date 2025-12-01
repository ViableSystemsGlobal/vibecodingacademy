import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/categories - List all categories
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const parentId = searchParams.get("parentId");

    const where: any = {};

    if (search) {
      // SQLite doesn't support mode: "insensitive", using case-sensitive search
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    if (parentId) {
      if (parentId === "null") {
        where.parentId = null;
      } else {
        where.parentId = parentId;
      }
    }

    const categories = await prisma.category.findMany({
      where,
      include: {
        parent: true,
        children: true,
      },
      orderBy: [
        { parentId: "asc" },
        { name: "asc" },
      ],
    });

    return NextResponse.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}

// POST /api/categories - Create a new category
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, parentId } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 }
      );
    }

    // Check if category name already exists at the same level
    const existingCategory = await prisma.category.findFirst({
      where: {
        name,
        parentId: parentId || null,
      },
    });

    if (existingCategory) {
      return NextResponse.json(
        { error: "Category with this name already exists at this level" },
        { status: 400 }
      );
    }

    // If parentId is provided, check if parent exists
    if (parentId) {
      const parent = await prisma.category.findUnique({
        where: { id: parentId },
      });

      if (!parent) {
        return NextResponse.json(
          { error: "Parent category not found" },
          { status: 400 }
        );
      }
    }

    const category = await prisma.category.create({
      data: {
        name,
        description,
        parentId: parentId || null,
      },
      include: {
        parent: true,
        children: true,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error("Error creating category:", error);
    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 }
    );
  }
}
