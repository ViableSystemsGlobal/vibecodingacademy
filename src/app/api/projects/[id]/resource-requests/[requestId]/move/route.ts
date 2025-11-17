import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; requestId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { stageId } = body;

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

    // Verify stage belongs to project and is of type RESOURCE
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

    const updatedRequest = await prisma.resourceRequest.update({
      where: { id: params.requestId },
      data: { stageId: stageId || null },
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

    // Create status history event
    await prisma.resourceRequestEvent.create({
      data: {
        requestId: params.requestId,
        userId: session.user.id,
        status: updatedRequest.status,
        notes: stageId
          ? `Moved to stage: ${updatedRequest.stage?.name || "Unknown"}`
          : "Removed from stage",
      },
    });

    return NextResponse.json({ resourceRequest: updatedRequest });
  } catch (error) {
    console.error("Error moving resource request:", error);
    return NextResponse.json(
      { error: "Failed to move resource request" },
      { status: 500 }
    );
  }
}

