import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendResourceRequestEmail } from "@/lib/resource-request-email";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; requestId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resourceRequest = await prisma.resourceRequest.findFirst({
      where: {
        id: params.requestId,
        projectId: params.id,
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
        statusHistory: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!resourceRequest) {
      return NextResponse.json(
        { error: "Resource request not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ resourceRequest });
  } catch (error) {
    console.error("Error fetching resource request:", error);
    return NextResponse.json(
      { error: "Failed to fetch resource request" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; requestId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resourceRequest = await prisma.resourceRequest.findFirst({
      where: {
        id: params.requestId,
        projectId: params.id,
      },
    });

    if (!resourceRequest) {
      return NextResponse.json(
        { error: "Resource request not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      title,
      details,
      items, // New: array of items for update
      sku,
      quantity,
      unit,
      neededBy,
      assignedTeam,
      priority,
      estimatedCost,
      currency,
      status,
      approvedBy,
      stageId,
      taskId,
      incidentId,
      emailTo,
      emailCc,
    } = body;

    const updateData: any = {};

    if (title !== undefined) updateData.title = title;
    if (details !== undefined) updateData.details = details;
    if (sku !== undefined) updateData.sku = sku || null;
    if (quantity !== undefined) updateData.quantity = parseFloat(quantity) || 1;
    if (unit !== undefined) updateData.unit = unit || "unit";
    if (neededBy !== undefined)
      updateData.neededBy = neededBy ? new Date(neededBy) : null;
    if (assignedTeam !== undefined) updateData.assignedTeam = assignedTeam;
    if (priority !== undefined) updateData.priority = priority;
    if (estimatedCost !== undefined)
      updateData.estimatedCost = estimatedCost ? parseFloat(estimatedCost) : null;
    if (currency !== undefined) updateData.currency = currency || null;
    if (stageId !== undefined) updateData.stageId = stageId || null;
    if (taskId !== undefined) updateData.taskId = taskId || null;
    if (incidentId !== undefined) updateData.incidentId = incidentId || null;
    if (emailTo !== undefined) updateData.emailTo = emailTo || null;
    if (emailCc !== undefined) updateData.emailCc = emailCc || null;

    // Handle status changes
    if (status !== undefined && status !== resourceRequest.status) {
      updateData.status = status;
      
      if (status === "APPROVED") {
        updateData.approvedBy = approvedBy || session.user.id;
        updateData.approvedAt = new Date();
      } else if (status === "FULFILLED") {
        updateData.fulfilledAt = new Date();
      } else if (status === "DECLINED" || status === "CANCELLED") {
        updateData.approvedBy = null;
        updateData.approvedAt = null;
      }
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

    // Handle items update if provided
    if (items !== undefined && Array.isArray(items)) {
      // Validate items
      if (items.length === 0) {
        return NextResponse.json(
          { error: "At least one product/item is required" },
          { status: 400 }
        );
      }

      // Validate all items have product names
      const invalidItems = items.filter((item: any) => !item.productName || !item.productName.trim());
      if (invalidItems.length > 0) {
        return NextResponse.json(
          { error: "All products must have a name" },
          { status: 400 }
        );
      }

      // Try to find products by name (optional linking)
      const itemsWithProducts = await Promise.all(
        items.map(async (item: any) => {
          const productName = item.productName.trim();
          if (!productName) {
            throw new Error("Product name is required");
          }

          // Try to find product by name (exact match first)
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

      // Calculate total estimated cost from items if not provided
      const calculatedCost = itemsWithProducts.reduce((sum, item) => {
        return sum + (item.estimatedCost || 0);
      }, 0);

      if (estimatedCost === undefined) {
        updateData.estimatedCost = calculatedCost > 0 ? calculatedCost : null;
      }

      // Delete all existing items and create new ones
      updateData.items = {
        deleteMany: {}, // Delete all existing items
        create: itemsWithProducts, // Create new items
      };
    }

    const updatedRequest = await prisma.resourceRequest.update({
      where: { id: params.requestId },
      data: updateData,
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
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            totalAmount: true,
            createdAt: true,
          },
        },
      },
    });

    // Create status history event if status changed
    if (status !== undefined && status !== resourceRequest.status) {
      await prisma.resourceRequestEvent.create({
        data: {
          requestId: params.requestId,
          userId: session.user.id,
          status: status as any,
          notes: `Status changed to ${status}`,
        },
      });

      // Send email when status changes to APPROVED or SUBMITTED
      if (status === "APPROVED" || status === "SUBMITTED") {
        try {
          // Get project and requester details for email
          const project = await prisma.project.findUnique({
            where: { id: params.id },
            select: { id: true, name: true },
          });

          const requester = await prisma.user.findUnique({
            where: { id: updatedRequest.requestedBy },
            select: { id: true, name: true, email: true },
          });

          if (project && requester) {
            await sendResourceRequestEmail(updatedRequest, project, requester);
          }
        } catch (emailError) {
          // Don't fail the update if email fails
          console.error("Error sending resource request email:", emailError);
        }
      }
    }

    return NextResponse.json({ resourceRequest: updatedRequest });
  } catch (error) {
    console.error("Error updating resource request:", error);
    return NextResponse.json(
      { error: "Failed to update resource request" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; requestId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resourceRequest = await prisma.resourceRequest.findFirst({
      where: {
        id: params.requestId,
        projectId: params.id,
      },
    });

    if (!resourceRequest) {
      return NextResponse.json(
        { error: "Resource request not found" },
        { status: 404 }
      );
    }

    await prisma.resourceRequest.delete({
      where: { id: params.requestId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting resource request:", error);
    return NextResponse.json(
      { error: "Failed to delete resource request" },
      { status: 500 }
    );
  }
}

