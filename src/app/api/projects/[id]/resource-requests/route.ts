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
      sku,
      quantity = 1,
      unit = "unit",
      neededBy,
      assignedTeam = "WAREHOUSE",
      priority = "NORMAL",
      estimatedCost,
      currency,
      taskId,
      incidentId,
      stageId,
    } = body;

    if (!title) {
      return NextResponse.json(
        { error: "Title is required" },
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

    const resourceRequest = await prisma.resourceRequest.create({
      data: {
        projectId: params.id,
        title,
        details: details || null,
        sku: sku || null,
        quantity: parseFloat(quantity) || 1,
        unit: unit || "unit",
        neededBy: neededBy ? new Date(neededBy) : null,
        assignedTeam: assignedTeam as any,
        priority: priority as any,
        estimatedCost: estimatedCost ? parseFloat(estimatedCost) : null,
        currency: currency || null,
        requestedBy: session.user.id,
        taskId: taskId || null,
        incidentId: incidentId || null,
        stageId: stageId || null,
        status: "DRAFT",
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
  } catch (error) {
    console.error("Error creating resource request:", error);
    return NextResponse.json(
      { error: "Failed to create resource request" },
      { status: 500 }
    );
  }
}

