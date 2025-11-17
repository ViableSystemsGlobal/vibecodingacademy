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

    const tasks = await prisma.task.findMany({
      where: { projectId: params.id },
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
        dependencies: {
          include: {
            dependsOnTask: {
              select: {
                id: true,
                title: true,
                dueDate: true,
              },
            },
          },
        },
      },
      orderBy: [
        { priority: "desc" },
        { dueDate: "asc" },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error("❌ Failed to load project tasks:", error);
    return NextResponse.json(
      {
        error: "Failed to load project tasks",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

