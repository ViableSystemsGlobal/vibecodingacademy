import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, source = "Newsletter Popup" } = body ?? {};

    if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
      return NextResponse.json(
        { success: false, error: "Please provide a valid email address." },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = typeof name === "string" ? name.trim() || null : null;
    const trimmedSource = typeof source === "string" && source.trim().length > 0 ? source.trim() : "Newsletter Popup";

    const subscription = await prisma.newsletterSubscription.upsert({
      where: { email: trimmedEmail },
      update: {
        name: trimmedName,
        source: trimmedSource,
        updatedAt: new Date(),
      },
      create: {
        email: trimmedEmail,
        name: trimmedName,
        source: trimmedSource,
      },
      select: {
        id: true,
        email: true,
        name: true,
        source: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ success: true, subscription });
  } catch (error) {
    console.error("❌ Newsletter subscription error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "We couldn't save your subscription right now. Please try again shortly.",
      },
      { status: 500 }
    );
  }
}

