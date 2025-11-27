import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        members: {
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
          orderBy: { createdAt: "asc" },
        },
        stages: {
          select: {
            id: true,
            name: true,
            color: true,
            order: true,
            stageType: true,
            _count: {
              select: {
                tasks: true,
                incidents: true,
              },
            },
          },
          orderBy: { order: "asc" },
        },
        tasks: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
            assignedTo: true,
            createdAt: true,
            updatedAt: true,
          },
          take: 10,
          orderBy: { updatedAt: "desc" },
        },
        incidents: {
          select: {
            id: true,
            title: true,
            status: true,
            severity: true,
            dueDate: true,
            createdAt: true,
          },
          take: 10,
          orderBy: { createdAt: "desc" },
        },
        resourceRequests: {
          select: {
            id: true,
            title: true,
            status: true,
            quantity: true,
            sku: true,
            requestedBy: true,
            createdAt: true,
          },
          take: 10,
          orderBy: { createdAt: "desc" },
        },
        _count: {
          select: {
            members: true,
            stages: true,
            tasks: true,
            incidents: true,
            resourceRequests: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error("❌ Failed to load project:", error);
    return NextResponse.json(
      {
        error: "Failed to load project",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any)?.id;
    if (!userId) {
      return NextResponse.json({ error: "Missing user context" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    console.log('PUT /api/projects/[id] - Updating project:', id, 'with data:', JSON.stringify(body));

    // Check if project exists and user has permission
    const existingProject = await prisma.project.findUnique({
      where: { id },
      select: { ownerId: true, createdBy: true, name: true },
    });

    if (!existingProject) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Only owner or creator can edit
    const canEdit = existingProject.ownerId === userId || existingProject.createdBy === userId;
    if (!canEdit) {
      return NextResponse.json({ error: "You don't have permission to edit this project" }, { status: 403 });
    }

    // Allow partial updates - only validate name if it's being updated
    const name = body?.name !== undefined ? (body.name || "").trim() : existingProject.name;
    if (!name) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }

    const startDate = body?.startDate ? new Date(body.startDate) : null;
    const dueDate = body?.dueDate ? new Date(body.dueDate) : null;
    const budgetValue = typeof body?.budget === "number" && !Number.isNaN(body.budget)
      ? body.budget
      : null;

    // Build update data object - only include fields that are being updated
    const updateData: any = {};
    
    if (body?.name !== undefined) {
      updateData.name = name;
    }
    if (body?.code !== undefined) {
      updateData.code = body.code?.trim() || null;
    }
    if (body?.description !== undefined) {
      updateData.description = body.description?.trim() || null;
    }
    if (body?.scope !== undefined) {
      updateData.scope = body.scope?.trim() || null;
    }
    if (body?.status !== undefined) {
      updateData.status = body.status;
    }
    if (body?.visibility !== undefined) {
      updateData.visibility = body.visibility;
    }
    if (body?.startDate !== undefined) {
      updateData.startDate = startDate;
    }
    if (body?.dueDate !== undefined) {
      updateData.dueDate = dueDate;
    }
    if (body?.budget !== undefined) {
      updateData.budget = budgetValue;
    }
    if (body?.budgetCurrency !== undefined) {
      updateData.budgetCurrency = body.budgetCurrency?.trim() || null;
    }
    if (body?.latitude !== undefined) {
      const latValue = typeof body.latitude === 'number' && !isNaN(body.latitude) ? body.latitude : null;
      updateData.latitude = latValue;
      console.log('Setting latitude:', latValue, 'from input:', body.latitude);
    }
    if (body?.longitude !== undefined) {
      const lngValue = typeof body.longitude === 'number' && !isNaN(body.longitude) ? body.longitude : null;
      updateData.longitude = lngValue;
      console.log('Setting longitude:', lngValue, 'from input:', body.longitude);
    }
    if (body?.ownerId !== undefined) {
      updateData.ownerId = body.ownerId;
    }

    // Ensure we have at least one field to update
    if (Object.keys(updateData).length === 0) {
      console.error('No fields to update');
      return NextResponse.json({ error: "No fields provided for update" }, { status: 400 });
    }

    console.log('Updating project with data:', JSON.stringify(updateData, null, 2));
    console.log('Project ID:', id);
    
    try {
    const project = await prisma.project.update({
        where: { id },
        data: updateData,
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            members: true,
            tasks: true,
            incidents: true,
            resourceRequests: true,
          },
        },
      },
    });

      console.log('Project updated successfully');
    return NextResponse.json({ project });
    } catch (prismaError: any) {
      console.error('Prisma update error:', prismaError);
      console.error('Error code:', prismaError?.code);
      console.error('Error meta:', prismaError?.meta);
      throw prismaError;
    }
  } catch (error) {
    console.error("❌ Failed to update project:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });
    return NextResponse.json(
      {
        error: "Failed to update project",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any)?.id;
    if (!userId) {
      return NextResponse.json({ error: "Missing user context" }, { status: 401 });
    }

    const { id } = await params;

    // Check if project exists and user has permission
    const existingProject = await prisma.project.findUnique({
      where: { id },
      select: { ownerId: true, createdBy: true },
    });

    if (!existingProject) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Only owner or creator can delete
    const canDelete = existingProject.ownerId === userId || existingProject.createdBy === userId;
    if (!canDelete) {
      return NextResponse.json({ error: "You don't have permission to delete this project" }, { status: 403 });
    }

    await prisma.project.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ Failed to delete project:", error);
    return NextResponse.json(
      {
        error: "Failed to delete project",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

