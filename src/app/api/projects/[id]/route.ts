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
  { params }: { params: { id: string } }
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

    const body = await request.json();
    const name = (body?.name || "").trim();

    if (!name) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }

    // Check if project exists and user has permission
    const existingProject = await prisma.project.findUnique({
      where: { id: params.id },
      select: { ownerId: true, createdBy: true },
    });

    if (!existingProject) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Only owner or creator can edit
    const canEdit = existingProject.ownerId === userId || existingProject.createdBy === userId;
    if (!canEdit) {
      return NextResponse.json({ error: "You don't have permission to edit this project" }, { status: 403 });
    }

    const startDate = body?.startDate ? new Date(body.startDate) : null;
    const dueDate = body?.dueDate ? new Date(body.dueDate) : null;
    const budgetValue = typeof body?.budget === "number" && !Number.isNaN(body.budget)
      ? body.budget
      : null;

    const project = await prisma.project.update({
      where: { id: params.id },
      data: {
        name,
        code: body?.code?.trim() || null,
        description: body?.description?.trim() || null,
        status: body?.status || "ACTIVE",
        visibility: body?.visibility || "INTERNAL",
        startDate,
        dueDate,
        budget: budgetValue,
        budgetCurrency: body?.budgetCurrency?.trim() || null,
        ...(body?.ownerId && { ownerId: body.ownerId }),
      },
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

    return NextResponse.json({ project });
  } catch (error) {
    console.error("❌ Failed to update project:", error);
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
  { params }: { params: { id: string } }
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

    // Check if project exists and user has permission
    const existingProject = await prisma.project.findUnique({
      where: { id: params.id },
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
      where: { id: params.id },
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

