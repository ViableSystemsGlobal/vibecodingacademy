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

    const stages = await prisma.projectStage.findMany({
      where: { projectId: params.id },
      orderBy: { order: "asc" },
      include: {
        _count: {
          select: {
            tasks: true,
            incidents: true,
          },
        },
      },
    });

    return NextResponse.json({ stages });
  } catch (error) {
    console.error("❌ Failed to load stages:", error);
    return NextResponse.json(
      {
        error: "Failed to load stages",
        details: error instanceof Error ? error.message : String(error),
      },
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
      return NextResponse.json({ error: "Stage name is required" }, { status: 400 });
    }

    // Check if project exists
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Get the highest order value
    const lastStage = await prisma.projectStage.findFirst({
      where: { projectId: params.id, stageType: body?.stageType || "TASK" },
      orderBy: { order: "desc" },
    });

    const newOrder = lastStage ? lastStage.order + 1 : 0;

    const stage = await prisma.projectStage.create({
      data: {
        projectId: params.id,
        name,
        color: body?.color || "#6366F1",
        order: newOrder,
        stageType: body?.stageType || "TASK",
      },
      include: {
        _count: {
          select: {
            tasks: true,
            incidents: true,
          },
        },
      },
    });

    return NextResponse.json({ stage }, { status: 201 });
  } catch (error) {
    console.error("❌ Failed to create stage:", error);
    return NextResponse.json(
      {
        error: "Failed to create stage",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

