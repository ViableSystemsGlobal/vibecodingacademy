import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { stageOrders } = body; // Array of { stageId: string, order: number }

    if (!Array.isArray(stageOrders)) {
      return NextResponse.json(
        { error: "stageOrders must be an array" },
        { status: 400 }
      );
    }

    // Update all stages in a transaction
    const updates = stageOrders.map(({ stageId, order }) =>
      prisma.projectStage.update({
        where: { id: stageId },
        data: { order },
      })
    );

    await Promise.all(updates);

    // Return updated stages
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
    console.error("❌ Failed to reorder stages:", error);
    return NextResponse.json(
      {
        error: "Failed to reorder stages",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

