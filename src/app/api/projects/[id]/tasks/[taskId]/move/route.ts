import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; taskId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { stageId } = body;

    // Verify task belongs to this project
    const task = await prisma.task.findUnique({
      where: { id: params.taskId },
      select: { projectId: true },
    });

    if (!task || task.projectId !== params.id) {
      return NextResponse.json(
        { error: "Task not found in this project" },
        { status: 404 }
      );
    }

    // Verify stage belongs to this project
    if (stageId) {
      const stage = await prisma.projectStage.findUnique({
        where: { id: stageId },
        select: { projectId: true },
      });

      if (!stage || stage.projectId !== params.id) {
        return NextResponse.json(
          { error: "Stage not found in this project" },
          { status: 404 }
        );
      }
    }

    // Update task stage
    const updatedTask = await prisma.task.update({
      where: { id: params.taskId },
      data: {
        stageId: stageId || null,
      },
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

