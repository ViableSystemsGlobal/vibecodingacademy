import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  mergeWithDefaults,
  parseKeysParam,
} from "@/lib/storefront-content";

type DynamicFindMany<T = unknown> = {
  findMany: (args?: Record<string, unknown>) => Promise<T>;
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const keys = parseKeysParam(searchParams.get("keys"));

    const where = keys
      ? {
          key: {
            in: keys,
          },
        }
      : undefined;

    const dynamicPrisma = prisma as unknown as {
      storefrontContent?: DynamicFindMany<any[]>;
      storefrontTestimonial?: DynamicFindMany<any[]>;
    };
    const model = dynamicPrisma.storefrontContent;
    const testimonialModel = dynamicPrisma.storefrontTestimonial;

    let contentRecords: any[] = [];
    try {
      contentRecords = model
        ? await model.findMany({
            where,
            orderBy: {
              key: "asc",
            },
          })
        : [];
    } catch (error) {
      console.error("Error fetching storefront content:", error);
      // Continue with empty array if model doesn't exist or query fails
    }

    let testimonialsData: any[] = [];
    try {
      testimonialsData =
        (!keys || keys.includes("testimonials")) && testimonialModel
          ? await testimonialModel.findMany({
              where: {
                isFeatured: true,
              },
              orderBy: [
                { sortOrder: "asc" },
                { createdAt: "desc" },
              ],
            })
          : [];
    } catch (error) {
      console.error("Error fetching testimonials:", error);
      // Continue with empty array if model doesn't exist or query fails
    }

    const content = mergeWithDefaults(contentRecords, keys);

    if ((!keys || keys.includes("testimonials")) && testimonialsData.length > 0) {
      content.testimonials = testimonialsData;
    }

    return NextResponse.json({
      success: true,
      content,
    });
  } catch (error) {
    console.error("Error fetching public storefront content:", error);
    return NextResponse.json(
      { error: "Failed to load content" },
      { status: 500 }
    );
  }
}
