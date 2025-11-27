import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, taskId } = await params;
    const body = await request.json();
    const { stageId } = body;

    // Verify task belongs to this project
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { projectId: true },
    });

    if (!task || task.projectId !== id) {
      return NextResponse.json(
        { error: "Task not found in this project" },
        { status: 404 }
      );
    }

    // Verify stage belongs to this project and get stage name
    let stageName: string | null = null;
    if (stageId) {
      const stage = await prisma.projectStage.findUnique({
        where: { id: stageId },
        select: { projectId: true, name: true },
      });

      if (!stage || stage.projectId !== id) {
        return NextResponse.json(
          { error: "Stage not found in this project" },
          { status: 404 }
        );
      }
      stageName = stage.name;
    }

    // Get current task to check status
    const currentTask = await prisma.task.findUnique({
      where: { id: taskId },
      select: { status: true },
    });

    // Determine if moving to/from "Done" stage
    const isMovingToDone = stageName && stageName.toLowerCase().includes("done");
    const isMovingFromDone = !stageId || !isMovingToDone;

    // Prepare update data
    const updateData: any = {
      stageId: stageId || null,
    };

    // Sync status when moving to/from Done stage
    if (isMovingToDone && currentTask?.status !== "COMPLETED") {
      // Moving to Done stage - mark as COMPLETED
      updateData.status = "COMPLETED";
      updateData.completedAt = new Date();
    } else if (isMovingFromDone && currentTask?.status === "COMPLETED") {
      // Moving away from Done stage - change status back to IN_PROGRESS or PENDING
      // Check if task was previously in a stage that indicates it was in progress
      updateData.status = "IN_PROGRESS";
      updateData.completedAt = null;
    }

    // Update task stage and status
    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: updateData,
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assignees: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        stage: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    });

    return NextResponse.json({ task: updatedTask });
  } catch (error) {
    console.error("❌ Failed to move task:", error);
    return NextResponse.json(
      {
        error: "Failed to move task",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

