import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type StorefrontSectionModel = {
  findMany: (args?: Record<string, unknown>) => Promise<any[]>;
  update: (args: Record<string, unknown>) => Promise<any>;
  upsert: (args: Record<string, unknown>) => Promise<any>;
};

function sanitizeString(value: unknown): string | null {
  if (typeof value === "string") {
    return value.trim();
  }
  return null;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const model = (prisma as unknown as {
      storefrontSection?: StorefrontSectionModel;
    }).storefrontSection;

    if (!model) {
      return NextResponse.json({
        sections: [],
        message:
          "Storefront sections table not found. Please run the latest database migrations to enable CMS sections.",
      });
    }

    const sections = await model.findMany({
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({ sections });
  } catch (error) {
    console.error("Error fetching storefront sections:", error);
    return NextResponse.json(
      { error: "Failed to fetch storefront sections" },
      { status: 500 }
    );
  }
}

interface SectionPayload {
  id?: string;
  key: string;
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  ctaText?: string | null;
  ctaLink?: string | null;
  gradient?: string | null;
  media?: unknown;
  content?: unknown;
  sortOrder?: number;
  isActive?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const sections: SectionPayload[] | undefined = body?.sections;

    if (!Array.isArray(sections) || sections.length === 0) {
      return NextResponse.json(
        { error: "Sections payload is required" },
        { status: 400 }
      );
    }

    const model = (prisma as unknown as {
      storefrontSection?: StorefrontSectionModel;
    }).storefrontSection;

    if (!model) {
      return NextResponse.json(
        {
          error:
            "Storefront sections table not found. Please run the latest database migrations to enable CMS sections.",
        },
        { status: 501 }
      );
    }

    const sanitizedSections = sections.map((section) => {
      if (!section.key || typeof section.key !== "string") {
        throw new Error("Each section must have a string key");
      }

      return {
        id: section.id,
        key: section.key.trim(),
        title: sanitizeString(section.title),
        subtitle: sanitizeString(section.subtitle),
        description: sanitizeString(section.description),
        ctaText: sanitizeString(section.ctaText),
        ctaLink: sanitizeString(section.ctaLink),
        gradient: sanitizeString(section.gradient),
        media: section.media ?? null,
        content: section.content ?? null,
        sortOrder:
          typeof section.sortOrder === "number" && Number.isFinite(section.sortOrder)
            ? Math.trunc(section.sortOrder)
            : 0,
        isActive: section.isActive ?? true,
      };
    });

    // For single section saves, use direct operations (faster, no transaction overhead)
    // For multiple sections, use a transaction with increased timeout
    const results = [];
    
    if (sanitizedSections.length === 1) {
      // Single section - no transaction needed, faster for SQLite
      const section = sanitizedSections[0];
      if (section.id) {
        const result = await model.update({
          where: { id: section.id },
          data: {
            key: section.key,
            title: section.title,
            subtitle: section.subtitle,
            description: section.description,
            ctaText: section.ctaText,
            ctaLink: section.ctaLink,
            gradient: section.gradient,
            media: section.media,
            content: section.content,
            sortOrder: section.sortOrder,
            isActive: section.isActive,
          },
        });
        results.push(result);
      } else {
        const result = await model.upsert({
          where: { key: section.key },
          update: {
            title: section.title,
            subtitle: section.subtitle,
            description: section.description,
            ctaText: section.ctaText,
            ctaLink: section.ctaLink,
            gradient: section.gradient,
            media: section.media,
            content: section.content,
            sortOrder: section.sortOrder,
            isActive: section.isActive,
          },
          create: {
            key: section.key,
            title: section.title,
            subtitle: section.subtitle,
            description: section.description,
            ctaText: section.ctaText,
            ctaLink: section.ctaLink,
            gradient: section.gradient,
            media: section.media,
            content: section.content,
            sortOrder: section.sortOrder,
            isActive: section.isActive,
          },
        });
        results.push(result);
      }
    } else {
      // Multiple sections - use transaction with increased timeout
      const transactionResults = await prisma.$transaction(
        async (tx) => {
          const upserts = [] as Promise<unknown>[];

          for (const section of sanitizedSections) {
            if (section.id) {
              upserts.push(
                model.update({
                  where: { id: section.id },
                  data: {
                    key: section.key,
                    title: section.title,
                    subtitle: section.subtitle,
                    description: section.description,
                    ctaText: section.ctaText,
                    ctaLink: section.ctaLink,
                    gradient: section.gradient,
                    media: section.media,
                    content: section.content,
                    sortOrder: section.sortOrder,
                    isActive: section.isActive,
                  },
                })
              );
            } else {
              upserts.push(
                model.upsert({
                  where: { key: section.key },
                  update: {
                    title: section.title,
                    subtitle: section.subtitle,
                    description: section.description,
                    ctaText: section.ctaText,
                    ctaLink: section.ctaLink,
                    gradient: section.gradient,
                    media: section.media,
                    content: section.content,
                    sortOrder: section.sortOrder,
                    isActive: section.isActive,
                  },
                  create: {
                    key: section.key,
                    title: section.title,
                    subtitle: section.subtitle,
                    description: section.description,
                    ctaText: section.ctaText,
                    ctaLink: section.ctaLink,
                    gradient: section.gradient,
                    media: section.media,
                    content: section.content,
                    sortOrder: section.sortOrder,
                    isActive: section.isActive,
                  },
                })
              );
            }
          }

          return Promise.all(upserts);
        },
        {
          maxWait: 10000, // Maximum time to wait for a transaction slot (10 seconds)
          timeout: 20000, // Maximum time the transaction can run (20 seconds)
        }
      );
      results.push(...transactionResults);
    }

    return NextResponse.json({ success: true, sections: results });
  } catch (error) {
    console.error("Error saving storefront sections:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save sections" },
      { status: 500 }
    );
  }
}
