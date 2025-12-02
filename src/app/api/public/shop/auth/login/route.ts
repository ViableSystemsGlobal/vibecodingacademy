import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { sign } from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { verifyRecaptcha } from '@/lib/recaptcha';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'adpools-secret-key-2024-production-change-me';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, recaptchaToken } = body;

    // Verify reCAPTCHA (only if enabled in settings)
    const isValidRecaptcha = await verifyRecaptcha(recaptchaToken || '');
    if (!isValidRecaptcha) {
      return NextResponse.json(
        { error: 'reCAPTCHA verification failed. Please try again.' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find customer
    const customer = await prisma.customer.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Check if account is active
    if (!customer.isActive) {
      return NextResponse.json(
        { error: 'Your account has been deactivated. Please contact support.' },
        { status: 401 }
      );
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, customer.password);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Update last login
    await prisma.customer.update({
      where: { id: customer.id },
      data: { lastLoginAt: new Date() },
    });

    // Create JWT token
    const token = sign(
      {
        id: customer.id,
        email: customer.email,
        type: 'customer',
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set('customer_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    return NextResponse.json({
      success: true,
      customer: {
        id: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone,
      },
    });
  } catch (error: any) {
    console.error('Error logging in customer:', error);
    console.error('Error details:', error?.message);
    console.error('Error stack:', error?.stack);
    
    return NextResponse.json(
      { 
        error: 'Failed to login. Please try again.',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined
      },
      { status: 500 }
    );
  }
}

