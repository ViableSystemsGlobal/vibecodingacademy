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

    const stageType = body?.stageType || "TASK";

    // Check if stage with same name and stageType already exists for this project
    const existingStage = await prisma.projectStage.findFirst({
      where: {
        projectId: params.id,
        name,
        stageType,
      },
    });

    if (existingStage) {
      return NextResponse.json(
        {
          error: `A stage named "${name}" already exists for ${stageType.toLowerCase()} stages in this project`,
          details: "Stage names must be unique within a project and stage type",
        },
        { status: 409 }
      );
    }

    // Use provided order, or calculate the next order if not provided
    let order = body?.order;
    if (order === undefined || order === null) {
      const lastStage = await prisma.projectStage.findFirst({
        where: { projectId: params.id, stageType },
        orderBy: { order: "desc" },
      });
      order = lastStage ? lastStage.order + 1 : 0;
    }

    const stage = await prisma.projectStage.create({
      data: {
        projectId: params.id,
        name,
        color: body?.color || "#6366F1",
        order: order,
        stageType,
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
    
    // Check if it's a unique constraint violation
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("Unique constraint") || errorMessage.includes("P2002")) {
      return NextResponse.json(
        {
          error: `A stage with this name already exists for this stage type in this project`,
          details: "Stage names must be unique within a project and stage type",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to create stage",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

