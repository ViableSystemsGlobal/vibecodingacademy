import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LoginNotificationService } from "@/lib/login-notification-service";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const history = await LoginNotificationService.getLoginHistory(userId, 20);

    return NextResponse.json({ history });
  } catch (error) {
    console.error("Error fetching login history:", error);
    return NextResponse.json(
      { error: "Failed to fetch login history" },
      { status: 500 }
    );
  }
}

