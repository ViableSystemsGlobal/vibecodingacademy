import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ModuleManager } from "@/lib/module-manager";

/**
 * GET /api/modules/enabled
 * Get all enabled modules (optionally filtered by user)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    // Get enabled modules
    const modules = userId
      ? await ModuleManager.getForUser(userId)
      : await ModuleManager.getEnabled();

    return NextResponse.json({ modules });
  } catch (error) {
    console.error("Error fetching enabled modules:", error);
    return NextResponse.json(
      { error: "Failed to fetch enabled modules" },
      { status: 500 }
    );
  }
}

