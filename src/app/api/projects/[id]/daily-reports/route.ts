import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await params;

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

    // Fetch daily reports with images and author
    console.log("[DAILY-REPORTS] Fetching reports for project:", projectId);
    let dailyReports;
    try {
      // Fetch basic daily reports first
      dailyReports = await (prisma as any).dailyReport.findMany({
        where: { projectId },
        orderBy: { reportDate: "desc" },
      });
      console.log("[DAILY-REPORTS] Found", dailyReports.length, "reports");

      // Fetch relations separately and attach them
      if (dailyReports.length > 0) {
        const reportIds = dailyReports.map((r: any) => r.id) as string[];
        const userIds = [...new Set(dailyReports.map((r: any) => r.createdBy))] as string[];
        
        // Fetch authors
        const authors = await prisma.user.findMany({
          where: {
            id: { in: userIds },
          },
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        });
        const authorMap = new Map(authors.map((a: any) => [a.id, a]));

        // Fetch images
        const images = await (prisma as any).dailyReportImage.findMany({
          where: {
            dailyReportId: { in: reportIds },
          },
        });
        const imagesMap = new Map<string, any[]>();
        images.forEach((img: any) => {
          if (!imagesMap.has(img.dailyReportId)) {
            imagesMap.set(img.dailyReportId, []);
          }
          imagesMap.get(img.dailyReportId)!.push(img);
        });

        // Attach relations to each report
        dailyReports = dailyReports.map((report: any) => ({
          ...report,
          author: authorMap.get(report.createdBy) || null,
          images: (imagesMap.get(report.id) || []).sort((a: any, b: any) => 
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          ),
        }));
      } else {
        // Return empty array with proper structure
        dailyReports = [];
      }
    } catch (prismaError: any) {
      console.error("[DAILY-REPORTS] Prisma error:", prismaError);
      console.error("[DAILY-REPORTS] Prisma error details:", {
        message: prismaError.message,
        code: prismaError.code,
        meta: prismaError.meta,
        stack: prismaError.stack,
      });
      throw prismaError;
    }

    // Sort images by createdAt on the client side (SQLite doesn't support orderBy on relations)
    if (dailyReports && Array.isArray(dailyReports)) {
      dailyReports.forEach((report: any) => {
        if (report.images && Array.isArray(report.images)) {
          report.images.sort((a: any, b: any) => 
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        }
      });
    }

    return NextResponse.json(dailyReports || []);
  } catch (error) {
    console.error("Error fetching daily reports:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });
    return NextResponse.json(
      { 
        error: "Failed to fetch daily reports",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await params;
    const body = await request.json();
    const { title, content, reportDate } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: "Title and content are required" },
        { status: 400 }
      );
    }

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

    // Create daily report
    const dailyReport = await (prisma as any).dailyReport.create({
      data: {
        projectId,
        title,
        content,
        reportDate: reportDate ? new Date(reportDate) : new Date(),
        createdBy: session.user.id,
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
        images: true,
      },
    });

    return NextResponse.json(dailyReport, { status: 201 });
  } catch (error) {
    console.error("Error creating daily report:", error);
    return NextResponse.json(
      { error: "Failed to create daily report" },
      { status: 500 }
    );
  }
}

