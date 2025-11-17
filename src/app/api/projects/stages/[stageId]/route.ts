import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: { stageId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const name = (body?.name || "").trim();

    if (!name) {
      return NextResponse.json({ error: "Stage name is required" }, { status: 400 });
    }

    const stage = await prisma.projectStage.update({
      where: { id: params.stageId },
      data: {
        name,
        color: body?.color || "#6366F1",
        order: body?.order !== undefined ? body.order : undefined,
      },
      include: {
        _count: {
          select: {
            tasks: true,
            incidents: true,
          },
        },
      },
    });

    return NextResponse.json({ stage });
  } catch (error) {
    console.error("❌ Failed to update stage:", error);
    return NextResponse.json(
      {
        error: "Failed to update stage",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { stageId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await prisma.projectStage.delete({
      where: { id: params.stageId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ Failed to delete stage:", error);
    return NextResponse.json(
      {
        error: "Failed to delete stage",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

