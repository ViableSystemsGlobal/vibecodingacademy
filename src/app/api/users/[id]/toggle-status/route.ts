import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit-log";

// PUT /api/users/[id]/toggle-status - Toggle user active status
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['ADMIN','SUPER_ADMIN'].includes((session.user as any).role as any)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    // Prevent deactivating yourself
    if (id === session.user.id) {
      return NextResponse.json(
        { error: "Cannot deactivate your own account" },
        { status: 400 }
      );
    }

    // Get current user data
    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const wasActive = Boolean((user as any).isActive);

    // Toggle status
    const updatedUser = await prisma.user.update({
      where: { id },
      data: { isActive: !wasActive } as any
    });

    await logAuditEvent({
      userId: (session.user as any).id,
      action: wasActive ? 'user.deactivated' : 'user.activated',
      resource: 'User',
      resourceId: id,
      oldData: { isActive: wasActive },
      newData: { isActive: !wasActive },
    });

    return NextResponse.json({
      user: updatedUser,
      message: `User ${wasActive ? 'deactivated' : 'activated'} successfully`
    });
  } catch (error) {
    console.error('Error toggling user status:', error);
    return NextResponse.json(
      { error: "Failed to toggle user status" },
      { status: 500 }
    );
  }
}
