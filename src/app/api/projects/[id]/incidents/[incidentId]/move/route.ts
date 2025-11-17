import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; incidentId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { stageId } = body;

    const incident = await prisma.incident.findFirst({
      where: {
        id: params.incidentId,
        projectId: params.id,
      },
    });

    if (!incident) {
      return NextResponse.json({ error: "Incident not found" }, { status: 404 });
    }

    // Verify stage belongs to project and is of type INCIDENT
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

    const updatedIncident = await prisma.incident.update({
      where: { id: params.incidentId },
      data: { stageId: stageId || null },
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

    // Create activity log
    await prisma.incidentActivity.create({
      data: {
        incidentId: params.incidentId,
        userId: session.user.id,
        type: "STATUS_CHANGE",
        detail: {
          message: stageId
            ? `Moved to stage: ${updatedIncident.stage?.name || "Unknown"}`
            : "Removed from stage",
        },
      },
    });

    return NextResponse.json({ incident: updatedIncident });
  } catch (error) {
    console.error("Error moving incident:", error);
    return NextResponse.json(
      { error: "Failed to move incident" },
      { status: 500 }
    );
  }
}

