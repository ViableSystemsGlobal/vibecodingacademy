import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/projects/[id]/resource-requests/[requestId]/comments - Get all comments for a resource request
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; requestId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, requestId } = await params;

    // Verify resource request exists and belongs to project
    const resourceRequest = await prisma.resourceRequest.findFirst({
      where: {
        id: requestId,
        projectId: id,
      },
    });

    if (!resourceRequest) {
      return NextResponse.json({ error: "Resource request not found" }, { status: 404 });
    }

    const comments = await prisma.resourceRequestComment.findMany({
      where: { requestId },
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
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ comments });
  } catch (error) {
    console.error("Error fetching resource request comments:", error);
    return NextResponse.json(
      { error: "Failed to fetch resource request comments" },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/resource-requests/[requestId]/comments - Add a comment to a resource request
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; requestId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, requestId } = await params;
    const body = await request.json();
    const { content } = body;

    if (!content?.trim()) {
      return NextResponse.json(
        { error: "Comment content is required" },
        { status: 400 }
      );
    }

    // Verify resource request exists and belongs to project
    const resourceRequest = await prisma.resourceRequest.findFirst({
      where: {
        id: requestId,
        projectId: id,
      },
    });

    if (!resourceRequest) {
      return NextResponse.json({ error: "Resource request not found" }, { status: 404 });
    }

    const comment = await prisma.resourceRequestComment.create({
      data: {
        requestId,
        userId: session.user.id,
        content: content.trim(),
      },
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

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    console.error("Error creating resource request comment:", error);
    return NextResponse.json(
      {
        error: "Failed to create resource request comment",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

