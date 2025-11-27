import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { syncPermissions } from "@/lib/permissions-sync";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await syncPermissions();

    return NextResponse.json({
      message: "Permissions synchronized successfully",
      summary: result,
    });
  } catch (error: any) {
    console.error("Failed to sync permissions:", error);
    console.error("Error details:", {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
    });
    return NextResponse.json(
      {
        error: "Failed to sync permissions",
        details: error instanceof Error ? error.message : "Unknown error",
        code: error?.code,
        meta: error?.meta,
      },
      { status: 500 },
    );
  }
}

