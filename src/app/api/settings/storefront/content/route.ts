import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_STOREFRONT_CONTENT,
  StorefrontContentKey,
  mergeWithDefaults,
  parseKeysParam,
} from "@/lib/storefront-content";
import { Prisma, PrismaClient } from "@prisma/client";

function getStorefrontClient(): PrismaClient {
  const client = prisma as PrismaClient | undefined;
  if (client && typeof client.storefrontContent?.findMany === "function") {
    return client;
  }

  console.warn(
    "[Storefront Content] Prisma client missing storefrontContent delegate. Reinitializing PrismaClient."
  );

  const fresh = new PrismaClient();
  if (typeof fresh.storefrontContent?.findMany !== "function") {
    throw new Error(
      "Prisma client is missing the storefrontContent model. Run `npx prisma generate` and restart the server."
    );
  }

  (globalThis as { prisma?: PrismaClient }).prisma = fresh;
  return fresh;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const keys = parseKeysParam(searchParams.get("keys"));

    const where = keys
      ? {
          key: {
            in: keys,
          },
        }
      : undefined;

    const client = getStorefrontClient();

    const records = await client.storefrontContent.findMany({
      where,
      orderBy: {
        key: "asc",
      },
    });

    const content = mergeWithDefaults(records, keys);

    return NextResponse.json({
      success: true,
      content,
      defaultsUsed: Object.keys(DEFAULT_STOREFRONT_CONTENT).filter(
        (key) => !records.some((record) => record.key === key)
      ),
    });
  } catch (error) {
    console.error("Error fetching storefront content:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      return NextResponse.json(
        {
          error:
            "Storefront content table is not available. Run the latest database migrations to enable CMS editing.",
        },
        { status: 501 }
      );
    }
    return NextResponse.json(
      {
        error: "Failed to load content",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

interface UpdatePayload {
  sections: Array<{
    key: StorefrontContentKey;
    data: Prisma.JsonValue;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as UpdatePayload;

    if (!body?.sections || !Array.isArray(body.sections) || body.sections.length === 0) {
      return NextResponse.json(
        { error: "Provide at least one section to update" },
        { status: 400 }
      );
    }

    const validKeys = new Set(Object.keys(DEFAULT_STOREFRONT_CONTENT));

    for (const section of body.sections) {
      if (!section?.key || !validKeys.has(section.key)) {
        return NextResponse.json(
          { error: `Invalid section key: ${section?.key ?? "unknown"}` },
          { status: 400 }
        );
      }
    }

    const client = getStorefrontClient();

    await Promise.all(
      body.sections.map((section) =>
        client.storefrontContent.upsert({
          where: { key: section.key },
          update: {
            data: section.data,
            updatedBy: session.user?.id ?? null,
          },
          create: {
            key: section.key,
            data: section.data,
            updatedBy: session.user?.id ?? null,
          },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving storefront content:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      return NextResponse.json(
        {
          error:
            "Storefront content table is not available. Run the latest database migrations to enable CMS editing.",
        },
        { status: 501 }
      );
    }
    return NextResponse.json(
      {
        error: "Failed to save content",
        message: error instanceof Error ? error.message : String(error),
        stack:
          process.env.NODE_ENV !== "production" && error instanceof Error
            ? error.stack
            : undefined,
      },
      { status: 500 }
    );
  }
}
