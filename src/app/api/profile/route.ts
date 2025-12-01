import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";

// GET /api/profile - Get current user's profile
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Profile API: Starting request');
    const session = await getServerSession(authOptions);
    console.log('🔍 Profile API: Session exists:', !!session);
    console.log('🔍 Profile API: Session user exists:', !!session?.user);
    
    if (!session?.user) {
      console.error('❌ Profile API: No session or user');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    console.log('🔍 Profile API: User ID:', userId);
    
    if (!userId) {
      console.error('❌ Profile API: No user ID in session');
      console.log('🔍 Profile API: Session user object:', JSON.stringify(session.user, null, 2));
      return NextResponse.json({ error: "User ID not found in session" }, { status: 401 });
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          image: true,
          role: true,
          isActive: true,
          createdAt: true,
          lastLoginAt: true,
          otpEnabled: true,
          otpMethod: true,
          otpMethods: true,
          loginNotificationsEmail: true,
          loginNotificationsSMS: true,
          newDeviceAlerts: true,
        }
      });

      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      // Ensure all new fields have default values if they're null/undefined
      // Handle otpMethods: if it exists and is an array, use it; otherwise migrate from otpMethod
      let otpMethodsArray: string[] = [];
      if (user.otpMethods && Array.isArray(user.otpMethods)) {
        otpMethodsArray = user.otpMethods;
      } else if (user.otpMethod) {
        // Migrate from old single method
        otpMethodsArray = [user.otpMethod];
      }

      const userWithDefaults = {
        ...user,
        otpEnabled: user.otpEnabled ?? false,
        otpMethod: user.otpMethod || null,
        otpMethods: otpMethodsArray,
        loginNotificationsEmail: user.loginNotificationsEmail ?? true,
        loginNotificationsSMS: user.loginNotificationsSMS ?? true,
        newDeviceAlerts: user.newDeviceAlerts ?? true,
      };

      return NextResponse.json({ user: userWithDefaults });
    } catch (dbError: any) {
      console.error('Database error fetching profile:', dbError);
      // If it's a field error, try fetching without the new fields
      if (dbError.message?.includes('Unknown arg') || dbError.message?.includes('does not exist')) {
        console.warn('New fields not found, fetching basic profile');
        const basicUser = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            image: true,
            role: true,
            isActive: true,
            createdAt: true,
            lastLoginAt: true,
          }
        });
        
        if (basicUser) {
          return NextResponse.json({
            user: {
              ...basicUser,
              otpEnabled: false,
              otpMethod: null,
              loginNotificationsEmail: true,
              loginNotificationsSMS: true,
              newDeviceAlerts: true,
            }
          });
        }
      }
      throw dbError;
    }
  } catch (error: any) {
    console.error('❌ Profile API: Error fetching profile:', error);
    console.error('❌ Profile API: Error message:', error?.message);
    console.error('❌ Profile API: Error stack:', error?.stack);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

// PUT /api/profile - Update current user's profile
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const body = await request.json();
    const { name, email, phone, image, otpEnabled, otpMethod, otpMethods, loginNotificationsEmail, loginNotificationsSMS, newDeviceAlerts } = body;

    // Get current user data
    const currentUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if email is being changed and if it's already taken
    if (email && email !== currentUser.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email }
      });

      if (existingUser) {
        return NextResponse.json(
          { error: "Email already in use" },
          { status: 400 }
        );
      }
    }

    // Update user (users can update name, email, phone, image, and security settings - not role or isActive)
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(image !== undefined && { image }),
        ...(otpEnabled !== undefined && { otpEnabled }),
        ...(otpMethod !== undefined && { otpMethod: otpMethod || null }), // Keep for backward compatibility
        ...(otpMethods !== undefined && { otpMethods: Array.isArray(otpMethods) ? otpMethods : [] }),
        ...(loginNotificationsEmail !== undefined && { loginNotificationsEmail }),
        ...(loginNotificationsSMS !== undefined && { loginNotificationsSMS }),
        ...(newDeviceAlerts !== undefined && { newDeviceAlerts }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        image: true,
        role: true,
        isActive: true,
        otpEnabled: true,
        otpMethod: true,
        otpMethods: true,
        loginNotificationsEmail: true,
        loginNotificationsSMS: true,
        newDeviceAlerts: true,
      }
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}

// PUT /api/profile/password - Change current user's password
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Current password and new password are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long" },
        { status: 400 }
      );
    }

    // Get current user with password
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true, email: true }
    });

    if (!user || !user.password) {
      return NextResponse.json(
        { error: "User not found or password not set" },
        { status: 404 }
      );
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 }
      );
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    return NextResponse.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error('Error changing password:', error);
    return NextResponse.json(
      { error: "Failed to change password" },
      { status: 500 }
    );
  }
}

