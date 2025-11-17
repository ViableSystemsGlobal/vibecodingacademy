import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
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
    const { projectId, content } = body;

    if (!projectId || !content?.trim()) {
      return NextResponse.json(
        { error: "Project ID and content are required" },
        { status: 400 }
      );
    }

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Create activity log for the project update
    const activity = await prisma.activity.create({
      data: {
        entityType: "Project",
        entityId: projectId,
        action: "update_added",
        details: {
          content: content.trim(),
          projectName: projectId, // We can enhance this later
        },
        userId: userId,
      },
    });

    return NextResponse.json({ activity }, { status: 201 });
  } catch (error) {
    console.error("❌ Failed to add project update:", error);
    return NextResponse.json(
      {
        error: "Failed to add project update",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    const activities = await prisma.activity.findMany({
      where: {
        entityType: "Project",
        entityId: projectId,
        action: "update_added",
      },
      orderBy: { createdAt: "desc" },
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
    });

    return NextResponse.json({ updates: activities });
  } catch (error) {
    console.error("❌ Failed to fetch project updates:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch project updates",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

