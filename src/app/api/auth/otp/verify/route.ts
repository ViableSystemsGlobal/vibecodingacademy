import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { OtpService } from '@/lib/otp-service';

export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return NextResponse.json(
        { error: 'Email and code are required' },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Verify OTP
    const verification = await OtpService.verifyOtp(user.id, code);

    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.message || 'Invalid OTP code' },
        { status: 401 }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: 'OTP verified successfully'
    });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return NextResponse.json(
      { error: 'Failed to verify OTP' },
      { status: 500 }
    );
  }
}

