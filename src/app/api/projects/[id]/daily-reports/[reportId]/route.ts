import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reportId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId, reportId } = await params;

    // Verify project exists and user has access
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { ownerId: session.user.id },
          { createdBy: session.user.id },
          {
            members: {
              some: {
                userId: session.user.id,
              },
            },
          },
        ],
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Fetch daily report
    const dailyReport = await (prisma as any).dailyReport.findFirst({
      where: {
        id: reportId,
        projectId,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        images: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!dailyReport) {
      return NextResponse.json(
        { error: "Daily report not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(dailyReport);
  } catch (error) {
    console.error("Error fetching daily report:", error);
    return NextResponse.json(
      { error: "Failed to fetch daily report" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reportId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId, reportId } = await params;
    const body = await request.json();
    const { title, content, reportDate } = body;

    // Verify project exists and user has access
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { ownerId: session.user.id },
          { createdBy: session.user.id },
          {
            members: {
              some: {
                userId: session.user.id,
              },
            },
          },
        ],
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Verify daily report exists and user is the author
    const existingReport = await (prisma as any).dailyReport.findFirst({
      where: {
        id: reportId,
        projectId,
        createdBy: session.user.id,
      },
    });

    if (!existingReport) {
      return NextResponse.json(
        { error: "Daily report not found or you don't have permission to edit it" },
        { status: 404 }
      );
    }

    // Update daily report
    const dailyReport = await (prisma as any).dailyReport.update({
      where: { id: reportId },
      data: {
        ...(title && { title }),
        ...(content && { content }),
        ...(reportDate && { reportDate: new Date(reportDate) }),
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        images: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return NextResponse.json(dailyReport);
  } catch (error) {
    console.error("Error updating daily report:", error);
    return NextResponse.json(
      { error: "Failed to update daily report" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reportId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId, reportId } = await params;

    // Verify project exists and user has access
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { ownerId: session.user.id },
          { createdBy: session.user.id },
          {
            members: {
              some: {
                userId: session.user.id,
              },
            },
          },
        ],
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Verify daily report exists and user is the author
    const existingReport = await (prisma as any).dailyReport.findFirst({
      where: {
        id: reportId,
        projectId,
        createdBy: session.user.id,
      },
    });

    if (!existingReport) {
      return NextResponse.json(
        { error: "Daily report not found or you don't have permission to delete it" },
        { status: 404 }
      );
    }

    // Delete daily report (images will be cascade deleted)
    await (prisma as any).dailyReport.delete({
      where: { id: reportId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting daily report:", error);
    return NextResponse.json(
      { error: "Failed to delete daily report" },
      { status: 500 }
    );
  }
}

