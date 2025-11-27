import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ModuleManager } from "@/lib/module-manager";
import { logAuditEvent } from "@/lib/audit-log";

/**
 * POST /api/modules/[slug]/disable
 * Disable a module
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission
    const userRole = (session.user as any).role;
    if (userRole !== "SUPER_ADMIN" && userRole !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const resolvedParams = await params;
    const userId = (session.user as any).id;

    // Disable the module
    const module = await ModuleManager.disable(resolvedParams.slug, userId);

    // Log audit event
    await logAuditEvent({
      userId,
      action: "module.disabled",
      resource: "Module",
      resourceId: module.id,
      newData: { slug: module.slug, isEnabled: false },
      ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null,
      userAgent: request.headers.get("user-agent") || null,
    });

    // Note: Menu cache will automatically refresh on next navigation or within 5 minutes
    // The sidebar fetches enabled modules on each menu generation

    return NextResponse.json({
      success: true,
      message: `Module ${module.name} disabled`,
      module,
    });
  } catch (error: any) {
    console.error("Error disabling module:", error);
    return NextResponse.json(
      { error: error.message || "Failed to disable module" },
      { status: 500 }
    );
  }
}

