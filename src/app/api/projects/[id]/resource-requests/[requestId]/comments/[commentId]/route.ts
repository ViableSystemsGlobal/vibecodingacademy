import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PUT /api/projects/[id]/resource-requests/[requestId]/comments/[commentId] - Update a comment
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; requestId: string; commentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, requestId, commentId } = await params;
    const body = await request.json();
    const { content } = body;

    if (!content?.trim()) {
      return NextResponse.json(
        { error: "Comment content is required" },
        { status: 400 }
      );
    }

    // Verify comment exists and belongs to resource request
    const existingComment = await prisma.resourceRequestComment.findUnique({
      where: { id: commentId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        request: {
          select: {
            id: true,
            projectId: true,
          },
        },
      },
    });

    if (!existingComment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    // Verify resource request belongs to project
    if (existingComment.request.projectId !== id) {
      return NextResponse.json({ error: "Resource request not found" }, { status: 404 });
    }

    // Only the comment author or admin can edit
    const userRole = session.user.role;
    const isAdmin = userRole === "SUPER_ADMIN" || userRole === "ADMIN";
    const isOwner = existingComment.userId === session.user.id;

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const comment = await prisma.resourceRequestComment.update({
      where: { id: commentId },
      data: { content: content.trim() },
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

    return NextResponse.json({ comment });
  } catch (error) {
    console.error("Error updating resource request comment:", error);
    return NextResponse.json(
      { error: "Failed to update resource request comment" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id]/resource-requests/[requestId]/comments/[commentId] - Delete a comment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; requestId: string; commentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, requestId, commentId } = await params;

    // Verify comment exists and belongs to resource request
    const existingComment = await prisma.resourceRequestComment.findUnique({
      where: { id: commentId },
      include: {
        request: {
          select: {
            id: true,
            projectId: true,
          },
        },
      },
    });

    if (!existingComment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    // Verify resource request belongs to project
    if (existingComment.request.projectId !== id) {
      return NextResponse.json({ error: "Resource request not found" }, { status: 404 });
    }

    // Only the comment author or admin can delete
    const userRole = session.user.role;
    const isAdmin = userRole === "SUPER_ADMIN" || userRole === "ADMIN";
    const isOwner = existingComment.userId === session.user.id;

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    await prisma.resourceRequestComment.delete({
      where: { id: commentId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting resource request comment:", error);
    return NextResponse.json(
      { error: "Failed to delete resource request comment" },
      { status: 500 }
    );
  }
}

