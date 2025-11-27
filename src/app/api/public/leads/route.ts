import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function isValidEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      firstName,
      lastName,
      email,
      phone,
      company,
      message,
      source = "Ecommerce Chat",
    } = body ?? {};

    if (!firstName || !lastName) {
      return NextResponse.json(
        {
          success: false,
          error: "First name and last name are required",
        },
        { status: 400 }
      );
    }

    if (!email && !phone) {
      return NextResponse.json(
        {
          success: false,
          error: "Provide at least an email or phone number so our team can reach you",
        },
        { status: 400 }
      );
    }

    if (email && !isValidEmail(email)) {
      return NextResponse.json(
        {
          success: false,
          error: "Please provide a valid email address",
        },
        { status: 400 }
      );
    }

    const leadOwner =
      (await prisma.user.findFirst({
        where: {
          role: {
            in: ["SUPER_ADMIN", "ADMIN"],
          },
          isActive: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      })) ??
      (await prisma.user.findFirst({
        orderBy: {
          createdAt: "asc",
        },
      }));

    if (!leadOwner) {
      return NextResponse.json(
        {
          success: false,
          error: "No active team member available to own the lead",
        },
        { status: 500 }
      );
    }

    const notesSections: string[] = [];
    if (company) {
      notesSections.push(`Company: ${company}`);
    }
    if (message) {
      notesSections.push(`Customer message:\n${message}`);
    }

    const lead = await prisma.lead.create({
      data: {
        firstName,
        lastName,
        email: email?.toLowerCase() ?? null,
        phone: phone ?? null,
        company: company ?? null,
        source,
        status: "NEW",
        leadType: "INDIVIDUAL",
        ownerId: leadOwner.id,
        notes: notesSections.length > 0 ? notesSections.join("\n\n") : null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        lead,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("❌ Error creating public lead:", error);
    return NextResponse.json(
      {
        success: false,
        error: "We could not save your details. Please try again shortly.",
      },
      { status: 500 }
    );
  }
}

