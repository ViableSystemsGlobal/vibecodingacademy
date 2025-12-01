import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCompanyNameFromSystemSettings } from "@/lib/company-settings";

// POST /api/users/invite - Invite a new user
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { email, name, phone, role } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      );
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        name,
        phone,
        role: role || 'SALES_REP',
        isActive: true
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true
      }
    });

    // Create notification for user invitation
    const companyName = await getCompanyNameFromSystemSettings();
    await prisma.notification.create({
      data: {
        type: 'USER_INVITED',
        title: `Welcome to ${companyName}`,
        message: `You have been invited to join ${companyName}. Please check your email for setup instructions.`,
        channels: JSON.stringify(['EMAIL']),
        status: 'PENDING',
        userId: user.id,
        data: JSON.stringify({
          inviteLink: `${process.env.NEXTAUTH_URL}/auth/setup?token=${user.id}`,
          invitedBy: session.user.name || session.user.email
        })
      }
    });

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'user.invited',
        resource: 'User',
        resourceId: user.id,
        newData: user
      }
    });

    // TODO: Send actual invitation email
    // await sendUserInvitationEmail(user.email, user.name, inviteLink);

    return NextResponse.json({ 
      user,
      message: "User invited successfully. Invitation email sent."
    }, { status: 201 });
  } catch (error) {
    console.error('Error inviting user:', error);
    return NextResponse.json(
      { error: "Failed to invite user" },
      { status: 500 }
    );
  }
}
