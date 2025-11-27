import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PIXEL_ID_KEY = "ecommerce_pixel_id";
const PIXEL_ENABLED_KEY = "ecommerce_pixel_enabled";

export async function GET() {
  try {
    const settings = await prisma.systemSettings.findMany({
      where: {
        key: {
          in: [PIXEL_ID_KEY, PIXEL_ENABLED_KEY],
        },
      },
    });

    const pixelId = settings.find((setting) => setting.key === PIXEL_ID_KEY)?.value || "";
    const enabledRaw = settings.find((setting) => setting.key === PIXEL_ENABLED_KEY)?.value || "false";
    const enabled = enabledRaw === "true";

    return NextResponse.json({
      pixelId,
      enabled,
    });
  } catch (error) {
    console.error("Error fetching public SEO settings:", error);
    return NextResponse.json({ error: "Failed to load SEO settings" }, { status: 500 });
  }
}

