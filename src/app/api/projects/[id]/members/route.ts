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

    // Get all users and current project members
    const [allUsers, projectMembers] = await Promise.all([
      prisma.user.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
        orderBy: { name: "asc" },
      }),
      prisma.projectMember.findMany({
        where: { projectId: params.id },
        select: { userId: true },
      }),
    ]);

    const memberUserIds = new Set(projectMembers.map((m) => m.userId));
    const availableUsers = allUsers.filter((user) => !memberUserIds.has(user.id));

    return NextResponse.json({
      members: projectMembers,
      availableUsers,
      allUsers,
    });
  } catch (error) {
    console.error("❌ Failed to load project members:", error);
    return NextResponse.json(
      {
        error: "Failed to load project members",
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
    const { userId: memberUserId, role = "CONTRIBUTOR", isExternal = false } = body;

    if (!memberUserId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // Check if project exists
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      select: { id: true, ownerId: true, createdBy: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Check if user has permission (owner or creator)
    const canManage = project.ownerId === userId || project.createdBy === userId;
    if (!canManage) {
      return NextResponse.json(
        { error: "You don't have permission to manage team members" },
        { status: 403 }
      );
    }

    // Check if user is already a member
    const existingMember = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: params.id,
          userId: memberUserId,
        },
      },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: "User is already a team member" },
        { status: 400 }
      );
    }

    // Add member
    const member = await prisma.projectMember.create({
      data: {
        projectId: params.id,
        userId: memberUserId,
        role: role || "CONTRIBUTOR",
        isExternal: isExternal || false,
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

    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    console.error("❌ Failed to add team member:", error);
    return NextResponse.json(
      {
        error: "Failed to add team member",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

