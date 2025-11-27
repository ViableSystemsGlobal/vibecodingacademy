import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { id: params.id },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const resourceRequests = await prisma.resourceRequest.findMany({
      where: { projectId: params.id },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        approver: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
        incident: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
        stage: {
          select: {
            id: true,
            name: true,
            color: true,
            order: true,
          },
        },
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
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ resourceRequests });
  } catch (error) {
    console.error("Error fetching resource requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch resource requests" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { id: params.id },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      title,
      details,
      items = [], // New: array of items
      sku, // Legacy support
      quantity = 1, // Legacy support
      unit = "unit", // Legacy support
      neededBy,
      assignedTeam = "WAREHOUSE",
      priority = "NORMAL",
      estimatedCost,
      currency,
      taskId,
      incidentId,
      stageId,
      emailTo,
      emailCc,
    } = body;

    if (!title) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    // Validate items - support both new format (items array) and legacy format (single item)
    const hasItems = items.length > 0;
    const hasLegacyItem = sku || quantity;
    
    if (!hasItems && !hasLegacyItem) {
      return NextResponse.json(
        { error: "At least one product/item is required" },
        { status: 400 }
      );
    }

    // Verify stage belongs to project if provided
    if (stageId) {
      const stage = await prisma.projectStage.findFirst({
        where: {
          id: stageId,
          projectId: params.id,
          stageType: "RESOURCE",
        },
      });

      if (!stage) {
        return NextResponse.json(
          { error: "Invalid stage for this project" },
          { status: 400 }
        );
      }
    }

    // Verify task belongs to project if provided
    if (taskId) {
      const task = await prisma.task.findFirst({
        where: {
          id: taskId,
          projectId: params.id,
        },
      });

      if (!task) {
        return NextResponse.json(
          { error: "Invalid task for this project" },
          { status: 400 }
        );
      }
    }

    // Verify incident belongs to project if provided
    if (incidentId) {
      const incident = await prisma.incident.findFirst({
        where: {
          id: incidentId,
          projectId: params.id,
        },
      });

      if (!incident) {
        return NextResponse.json(
          { error: "Invalid incident for this project" },
          { status: 400 }
        );
      }
    }

    // Handle items: new format (items array) or legacy format (single item)
    let itemsWithProducts: any[] = [];
    
    if (hasItems) {
      // Validate all items have product names
      const invalidItems = items.filter((item: any) => !item.productName || !item.productName.trim());
      if (invalidItems.length > 0) {
        return NextResponse.json(
          { error: "All products must have a name" },
          { status: 400 }
        );
      }

      // New format: Multiple items
      itemsWithProducts = await Promise.all(
        items.map(async (item: any) => {
          const productName = item.productName.trim();
          if (!productName) {
            throw new Error("Product name is required");
          }

          // Try to find product by name (exact match first, then case-insensitive)
          // SQLite doesn't support mode: "insensitive", so we'll try exact match
          let product = await prisma.product.findFirst({
            where: {
              name: productName,
              active: true,
            },
          });

          // If not found, try case-insensitive search (for PostgreSQL/MySQL)
          if (!product) {
            try {
              product = await prisma.product.findFirst({
                where: {
                  name: {
                    contains: productName,
                    mode: "insensitive",
                  },
                  active: true,
                },
              });
            } catch (e) {
              // SQLite doesn't support mode: "insensitive", skip
            }
          }

          return {
            productName: productName,
            productId: product?.id || null,
            quantity: parseFloat(item.quantity) || 1,
            unit: item.unit || "unit",
            estimatedCost: item.estimatedCost ? parseFloat(item.estimatedCost) : null,
            notes: item.notes || null,
          };
        })
      );
    } else {
      // Legacy format: Convert single item to items array
      let product = null;
      if (sku) {
        product = await prisma.product.findFirst({
          where: { sku, active: true },
        });
      }
      
      itemsWithProducts = [{
        productName: sku || "Item",
        productId: product?.id || null,
        quantity: parseFloat(quantity) || 1,
        unit: unit || "unit",
        estimatedCost: null,
        notes: null,
      }];
    }

    // Ensure we have items to create
    if (itemsWithProducts.length === 0) {
      return NextResponse.json(
        { error: "At least one valid product/item is required" },
        { status: 400 }
      );
    }

    // Calculate total estimated cost from items if not provided
    const calculatedCost = itemsWithProducts.reduce((sum, item) => {
      return sum + (item.estimatedCost || 0);
    }, 0);

    console.log("Creating resource request with items:", itemsWithProducts.length);
    console.log("Items data:", JSON.stringify(itemsWithProducts, null, 2));

    const resourceRequest = await prisma.resourceRequest.create({
      data: {
        projectId: params.id,
        title,
        details: details || null,
        sku: sku || null, // Legacy support
        quantity: parseFloat(quantity) || 1, // Legacy support
        unit: unit || "unit", // Legacy support
        neededBy: neededBy ? new Date(neededBy) : null,
        assignedTeam: assignedTeam as any,
        priority: priority as any,
        estimatedCost: estimatedCost ? parseFloat(estimatedCost) : (calculatedCost > 0 ? calculatedCost : null),
        currency: currency || null,
        requestedBy: session.user.id,
        taskId: taskId || null,
        incidentId: incidentId || null,
        stageId: stageId || null,
        emailTo: emailTo || null,
        emailCc: emailCc || null,
        status: "DRAFT",
        items: {
          create: itemsWithProducts,
        },
      },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        approver: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
        incident: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
        stage: {
          select: {
            id: true,
            name: true,
            color: true,
            order: true,
          },
        },
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
      },
    });

    // Create initial status history event
    await prisma.resourceRequestEvent.create({
      data: {
        requestId: resourceRequest.id,
        userId: session.user.id,
        status: "DRAFT",
        notes: "Resource request created",
      },
    });

    return NextResponse.json({ resourceRequest }, { status: 201 });
  } catch (error: any) {
    console.error("❌ Error creating resource request:", error);
    console.error("❌ Error details:", {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
      name: error?.name,
      meta: error?.meta,
    });
    
    // Handle specific Prisma errors
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          { 
            error: "A resource request with this identifier already exists",
            details: error.meta?.target || "Duplicate entry"
          },
          { status: 400 }
        );
      }
      if (error.code === 'P2003') {
        return NextResponse.json(
          { 
            error: "Invalid reference - one of the related records doesn't exist",
            details: error.meta?.field_name || "Foreign key constraint failed"
          },
          { status: 400 }
        );
      }
      if (error.code === 'P2011') {
        return NextResponse.json(
          { 
            error: "Required field is missing",
            details: error.meta?.constraint || "Null constraint violation"
          },
          { status: 400 }
        );
      }
    }
    
    // Return detailed error message
    const errorMessage = error instanceof Error ? error.message : "Failed to create resource request";
    return NextResponse.json(
      { 
        error: "Failed to create resource request",
        details: errorMessage,
        code: error?.code || "UNKNOWN"
      },
      { status: 500 }
    );
  }
}

