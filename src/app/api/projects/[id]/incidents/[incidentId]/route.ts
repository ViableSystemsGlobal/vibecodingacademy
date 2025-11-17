import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; incidentId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const incident = await prisma.incident.findFirst({
      where: {
        id: params.incidentId,
        projectId: params.id,
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
        timeline: {
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

    if (!incident) {
      return NextResponse.json({ error: "Incident not found" }, { status: 404 });
    }

    return NextResponse.json({ incident });
  } catch (error) {
    console.error("Error fetching incident:", error);
    return NextResponse.json(
      { error: "Failed to fetch incident" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; incidentId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const incident = await prisma.incident.findFirst({
      where: {
        id: params.incidentId,
        projectId: params.id,
      },
    });

    if (!incident) {
      return NextResponse.json({ error: "Incident not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      title,
      description,
      status,
      severity,
      source,
      assignedTo,
      stageId,
      relatedTaskId,
      dueDate,
      resolvedAt,
      resolutionSummary,
    } = body;

    const updateData: any = {};

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (severity !== undefined) updateData.severity = severity;
    if (source !== undefined) updateData.source = source;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo || null;
    if (stageId !== undefined) updateData.stageId = stageId || null;
    if (relatedTaskId !== undefined) updateData.relatedTaskId = relatedTaskId || null;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (resolvedAt !== undefined) updateData.resolvedAt = resolvedAt ? new Date(resolvedAt) : null;
    if (resolutionSummary !== undefined) updateData.resolutionSummary = resolutionSummary;

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

    // Track changes for activity log
    const changes: string[] = [];
    if (status && status !== incident.status) {
      changes.push(`Status changed from ${incident.status} to ${status}`);
    }
    if (assignedTo && assignedTo !== incident.assignedTo) {
      changes.push("Assignment changed");
    }
    if (stageId && stageId !== incident.stageId) {
      changes.push("Stage changed");
    }

    const updatedIncident = await prisma.incident.update({
      where: { id: params.incidentId },
      data: updateData,
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

    // Create activity entries for changes
    if (changes.length > 0) {
      await Promise.all(
        changes.map((change) =>
          prisma.incidentActivity.create({
            data: {
              incidentId: params.incidentId,
              userId: session.user.id,
              type: change.includes("Status") ? "STATUS_CHANGE" : change.includes("Assignment") ? "ASSIGNMENT" : "NOTE",
              detail: {
                message: change,
              },
            },
          })
        )
      );
    }

    return NextResponse.json({ incident: updatedIncident });
  } catch (error) {
    console.error("Error updating incident:", error);
    return NextResponse.json(
      { error: "Failed to update incident" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; incidentId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const incident = await prisma.incident.findFirst({
      where: {
        id: params.incidentId,
        projectId: params.id,
      },
    });

    if (!incident) {
      return NextResponse.json({ error: "Incident not found" }, { status: 404 });
    }

    await prisma.incident.delete({
      where: { id: params.incidentId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting incident:", error);
    return NextResponse.json(
      { error: "Failed to delete incident" },
      { status: 500 }
    );
  }
}

