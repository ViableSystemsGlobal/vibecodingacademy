import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: { memberId: string } }
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
    const { role, isExternal } = body;

    // Get the member to check project ownership
    const member = await prisma.projectMember.findUnique({
      where: { id: params.memberId },
      include: {
        project: {
          select: { ownerId: true, createdBy: true },
        },
      },
    });

    if (!member) {
      return NextResponse.json({ error: "Team member not found" }, { status: 404 });
    }

    // Check if user has permission (owner or creator)
    const canManage =
      member.project.ownerId === userId || member.project.createdBy === userId;
    if (!canManage) {
      return NextResponse.json(
        { error: "You don't have permission to manage team members" },
        { status: 403 }
      );
    }

    // Update member
    const updatedMember = await prisma.projectMember.update({
      where: { id: params.memberId },
      data: {
        ...(role && { role }),
        ...(isExternal !== undefined && { isExternal }),
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

    return NextResponse.json({ member: updatedMember });
  } catch (error) {
    console.error("❌ Failed to update team member:", error);
    return NextResponse.json(
      {
        error: "Failed to update team member",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { memberId: string } }
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

    // Get the member to check project ownership
    const member = await prisma.projectMember.findUnique({
      where: { id: params.memberId },
      include: {
        project: {
          select: { ownerId: true, createdBy: true },
        },
      },
    });

    if (!member) {
      return NextResponse.json({ error: "Team member not found" }, { status: 404 });
    }

    // Check if user has permission (owner or creator)
    const canManage =
      member.project.ownerId === userId || member.project.createdBy === userId;
    if (!canManage) {
      return NextResponse.json(
        { error: "You don't have permission to manage team members" },
        { status: 403 }
      );
    }

    // Don't allow removing the project owner
    if (member.userId === member.project.ownerId) {
      return NextResponse.json(
        { error: "Cannot remove the project owner" },
        { status: 400 }
      );
    }

    await prisma.projectMember.delete({
      where: { id: params.memberId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ Failed to remove team member:", error);
    return NextResponse.json(
      {
        error: "Failed to remove team member",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

