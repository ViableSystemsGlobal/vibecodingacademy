import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function ensureProjectTables() {
  return true;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tablesReady = await ensureProjectTables();
    if (!tablesReady) {
      return NextResponse.json({
        projects: [],
        summary: {
          total: 0,
          upcoming: 0,
          overdue: 0,
          byStatus: {},
        },
      });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const visibility = searchParams.get("visibility");

    const where: Record<string, unknown> = {};
    if (status) {
      where.status = status;
    }
    if (visibility) {
      where.visibility = visibility;
    }

    const projects = await prisma.project.findMany({
      where,
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        _count: {
          select: {
            members: true,
            tasks: true,
            incidents: true,
            resourceRequests: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const summary = projects.reduce(
      (acc, project) => {
        acc.total += 1;
        acc.byStatus[project.status] = (acc.byStatus[project.status] || 0) + 1;
        if (project.dueDate) {
          const due = new Date(project.dueDate);
          const now = new Date();
          const diff = due.getTime() - now.getTime();
          if (diff > 0 && diff <= 1000 * 60 * 60 * 24 * 14) {
            acc.upcoming += 1;
          }
          if (diff < 0 && project.status !== "COMPLETED" && project.status !== "ARCHIVED") {
            acc.overdue += 1;
          }
        }
        return acc;
      },
      {
        total: 0,
        upcoming: 0,
        overdue: 0,
        byStatus: {} as Record<string, number>,
      }
    );

    return NextResponse.json({
      projects,
      summary,
    });
  } catch (error) {
    console.error("❌ Failed to load projects:", error);
    return NextResponse.json(
      {
        error: "Failed to load projects",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tablesReady = await ensureProjectTables();
    if (!tablesReady) {
      return NextResponse.json(
        { error: "Projects table not available" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const name = (body?.name || "").trim();

    if (!name) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }

    const userId = (session.user as any)?.id;
    if (!userId) {
      return NextResponse.json({ error: "Missing user context" }, { status: 401 });
    }

    const startDate = body?.startDate ? new Date(body.startDate) : null;
    const dueDate = body?.dueDate ? new Date(body.dueDate) : null;
    const budgetValue = typeof body?.budget === "number" && !Number.isNaN(body.budget)
      ? body.budget
      : null;

    const project = await prisma.project.create({
      data: {
        name,
        code: body?.code?.trim() || null,
        description: body?.description?.trim() || null,
        status: body?.status || "ACTIVE",
        visibility: body?.visibility || "INTERNAL",
        startDate,
        dueDate,
        budget: budgetValue,
        budgetCurrency: body?.budgetCurrency?.trim() || null,
        ownerId: userId,
        createdBy: userId,
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            members: true,
            tasks: true,
            incidents: true,
            resourceRequests: true,
          },
        },
      },
    });

    try {
      await prisma.projectMember.create({
        data: {
          projectId: project.id,
          userId,
        },
      });
    } catch (error) {
      console.warn("⚠️ Failed to create initial project membership:", error);
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error("❌ Failed to create project:", error);
    return NextResponse.json(
      {
        error: "Failed to create project",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

