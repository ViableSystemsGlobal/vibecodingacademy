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

    const incidents = await prisma.incident.findMany({
      where: { projectId: params.id },
      include: {
        reporter: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
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
        relatedTask: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ incidents });
  } catch (error) {
    console.error("Error fetching incidents:", error);
    return NextResponse.json(
      { error: "Failed to fetch incidents" },
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
      description,
      severity = "MEDIUM",
      source = "INTERNAL",
      assignedTo,
      stageId,
      relatedTaskId,
      dueDate,
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
          stageType: "INCIDENT",
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
    if (relatedTaskId) {
      const task = await prisma.task.findFirst({
        where: {
          id: relatedTaskId,
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

    const incident = await prisma.incident.create({
      data: {
        projectId: params.id,
        title,
        description,
        severity: severity as any,
        source: source as any,
        reportedBy: session.user.id,
        assignedTo: assignedTo || null,
        stageId: stageId || null,
        relatedTaskId: relatedTaskId || null,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
      include: {
        reporter: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
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
        relatedTask: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
    });

    // Create initial activity
    await prisma.incidentActivity.create({
      data: {
        incidentId: incident.id,
        userId: session.user.id,
        type: "COMMENT",
        detail: {
          message: "Incident created",
        },
      },
    });

    return NextResponse.json({ incident }, { status: 201 });
  } catch (error) {
    console.error("Error creating incident:", error);
    return NextResponse.json(
      { error: "Failed to create incident" },
      { status: 500 }
    );
  }
}

