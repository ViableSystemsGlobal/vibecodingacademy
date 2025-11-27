import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_STOREFRONT_CONTENT,
  mergeWithDefaults,
} from "@/lib/storefront-content";

async function fetchStorefrontContentRecords() {
  const client: any = prisma as any;
  if (typeof client.storefrontContent?.findMany === "function") {
    return client.storefrontContent.findMany({
      orderBy: {
        key: "asc",
      },
    });
  }

  // Fallback for environments where Prisma client hasn't been regenerated yet
  const rows = await prisma.$queryRawUnsafe<
    Array<{ id: string; key: string; data: string; updatedBy: string | null; createdAt: string; updatedAt: string }>
  >(`SELECT id, key, data, updatedBy, createdAt, updatedAt FROM storefront_content ORDER BY key ASC`);

  return rows.map((row) => ({
    id: row.id,
    key: row.key,
    data: (() => {
      try {
        return JSON.parse(typeof row.data === "string" ? row.data : JSON.stringify(row.data));
      } catch (error) {
        console.warn("Failed to parse storefront content JSON for key", row.key, error);
        return DEFAULT_STOREFRONT_CONTENT[row.key as keyof typeof DEFAULT_STOREFRONT_CONTENT] ?? {};
      }
    })(),
    updatedBy: row.updatedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

export async function GET() {
  try {
    const records = await fetchStorefrontContentRecords();

    const content = mergeWithDefaults(records as any);

    const sections = Object.entries(content).map(([key, value], index) => {
      const data = (typeof value === "object" && value !== null ? value : {}) as Record<string, any>;
      return {
        id: key,
        key,
        title: data.title ?? null,
        subtitle: data.eyebrow ?? null,
        description: data.description ?? null,
        ctaText: data.ctaText ?? null,
        ctaLink: data.ctaHref ?? null,
        gradient: data.gradient ?? null,
        media: data.image ?? null,
        content: data,
        sortOrder: index,
        isActive: true,
      };
    });

    return NextResponse.json({
      sections,
      defaultsUsed: Object.keys(DEFAULT_STOREFRONT_CONTENT).filter(
        (key) => !records.some((record: any) => record.key === key)
      ),
    });
  } catch (error) {
    console.error("Error fetching storefront sections:", error);
    return NextResponse.json(
      {
        error: "Failed to load storefront sections",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
