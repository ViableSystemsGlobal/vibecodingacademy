"use server";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type StorefrontTestimonialModel = {
  findMany: (args?: Record<string, unknown>) => Promise<any[]>;
  update: (args: Record<string, unknown>) => Promise<any>;
  create: (args: Record<string, unknown>) => Promise<any>;
  deleteMany: (args: Record<string, unknown>) => Promise<any>;
  delete: (args: Record<string, unknown>) => Promise<any>;
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
      storefrontTestimonial?: StorefrontTestimonialModel;
    }).storefrontTestimonial;

    if (!model) {
      return NextResponse.json({
        testimonials: [],
        message:
          "Storefront testimonials table not found. Please run the latest database migrations to enable testimonial management.",
      });
    }

    const testimonials = await model.findMany({
      orderBy: [
        { sortOrder: "asc" },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json({ testimonials });
  } catch (error) {
    console.error("Error fetching storefront testimonials:", error);
    return NextResponse.json(
      { error: "Failed to load testimonials" },
      { status: 500 }
    );
  }
}

interface TestimonialPayload {
  id?: string;
  name?: string;
  role?: string | null;
  rating?: number;
  quote?: string;
  avatarColor?: string | null;
  avatarImage?: string | null;
  isFeatured?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as { testimonials?: TestimonialPayload[] };
    const testimonials = body?.testimonials;

    if (!Array.isArray(testimonials) || testimonials.length === 0) {
      return NextResponse.json(
        { error: "Provide at least one testimonial to save" },
        { status: 400 }
      );
    }

    const model = (prisma as unknown as {
      storefrontTestimonial?: StorefrontTestimonialModel;
    }).storefrontTestimonial;

    if (!model) {
      return NextResponse.json(
        {
          error:
            "Storefront testimonials table not found. Please run the latest database migrations to enable testimonial management.",
        },
        { status: 501 }
      );
    }

    const sanitized = testimonials.map((testimonial) => {
      const name = sanitizeString(testimonial.name);
      const quote = sanitizeString(testimonial.quote);

      if (!name) {
        throw new Error("Each testimonial must have a name");
      }

      if (!quote) {
        throw new Error("Each testimonial must include a quote");
      }

      return {
        id: testimonial.id,
        name,
        role: sanitizeString(testimonial.role),
        rating:
          typeof testimonial.rating === "number" && testimonial.rating >= 1 && testimonial.rating <= 5
            ? Math.round(testimonial.rating)
            : 5,
        quote,
        avatarColor: sanitizeString(testimonial.avatarColor),
        avatarImage: sanitizeString(testimonial.avatarImage),
        isFeatured: testimonial.isFeatured ?? false,
        isActive: testimonial.isActive ?? true,
        sortOrder:
          typeof testimonial.sortOrder === "number" && Number.isFinite(testimonial.sortOrder)
            ? Math.trunc(testimonial.sortOrder)
            : 0,
      };
    });

    await prisma.$transaction(async (tx) => {
      // Remove testimonials not present in payload (by id)
      const idsToKeep = sanitized.filter((item) => item.id).map((item) => item.id!);
      await tx.storefrontTestimonial.deleteMany({
        where: {
          id: {
            notIn: idsToKeep,
          },
        },
      });

      for (const testimonial of sanitized) {
        if (testimonial.id) {
          await tx.storefrontTestimonial.update({
            where: { id: testimonial.id },
            data: {
              name: testimonial.name,
              role: testimonial.role,
              rating: testimonial.rating,
              quote: testimonial.quote,
              avatarColor: testimonial.avatarColor,
              avatarImage: testimonial.avatarImage,
              isFeatured: testimonial.isFeatured,
              isActive: testimonial.isActive,
              sortOrder: testimonial.sortOrder,
            },
          });
        } else {
          await tx.storefrontTestimonial.create({
            data: {
              name: testimonial.name,
              role: testimonial.role,
              rating: testimonial.rating,
              quote: testimonial.quote,
              avatarColor: testimonial.avatarColor,
              avatarImage: testimonial.avatarImage,
              isFeatured: testimonial.isFeatured,
              isActive: testimonial.isActive,
              sortOrder: testimonial.sortOrder,
            },
          });
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving storefront testimonials:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to save testimonials",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Testimonial id is required" }, { status: 400 });
    }

    const model = (prisma as unknown as {
      storefrontTestimonial?: StorefrontTestimonialModel;
    }).storefrontTestimonial;

    if (!model) {
      return NextResponse.json(
        {
          error:
            "Storefront testimonials table not found. Please run the latest database migrations to enable testimonial management.",
        },
        { status: 501 }
      );
    }

    await model.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting storefront testimonial:", error);
    return NextResponse.json(
      { error: "Failed to delete testimonial" },
      { status: 500 }
    );
  }
}

