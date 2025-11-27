import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/projects/[id]/daily-reports/[reportId]/images/[imageId] - Get an image
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reportId: string; imageId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId, reportId, imageId } = await params;

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

    // Find the image in the database
    const image = await (prisma as any).dailyReportImage.findFirst({
      where: {
        id: imageId,
        dailyReportId: reportId,
      },
    });

    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    // Construct the full file path
    // filePath is stored as /uploads/daily-reports/[reportId]/[fileName]
    // We need to read from process.cwd()/uploads/daily-reports/[reportId]/[fileName]
    const filePath = join(process.cwd(), image.filePath);

    // Read the file from filesystem
    const fileBuffer = await readFile(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": image.mimeType,
        "Content-Disposition": `inline; filename="${image.originalName}"`,
        "Content-Length": image.fileSize.toString(),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Error serving image:", error);
    return NextResponse.json(
      { error: "Failed to serve image" },
      { status: 500 }
    );
  }
}

