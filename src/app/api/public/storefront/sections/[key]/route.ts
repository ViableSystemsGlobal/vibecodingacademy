import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type DynamicFindUnique<T = unknown> = {
  findUnique: (args: Record<string, unknown>) => Promise<T>;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;

    const dynamicPrisma = prisma as unknown as {
      storefrontSection?: DynamicFindUnique<any>;
    };
    const model = dynamicPrisma.storefrontSection;

    if (!model) {
      return NextResponse.json({ section: null });
    }

    const section = await model.findUnique({
      where: { key },
    });

    if (!section || !section.isActive) {
      return NextResponse.json({ section: null });
    }

    // Parse media and content JSON fields if they exist
    const parsedSection = {
      ...section,
      media: section.media ? (typeof section.media === 'string' ? JSON.parse(section.media) : section.media) : null,
      content: section.content ? (typeof section.content === 'string' ? JSON.parse(section.content) : section.content) : null,
    };

    return NextResponse.json({ section: parsedSection });
  } catch (error) {
    console.error("Error fetching storefront section:", error);
    return NextResponse.json(
      {
        error: "Failed to load storefront section",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

