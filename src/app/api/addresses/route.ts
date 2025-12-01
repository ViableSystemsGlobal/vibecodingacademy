import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/addresses - Get all addresses for an account
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');

    console.log('📍 GET /api/addresses called with accountId:', accountId);

    if (!accountId) {
      return NextResponse.json(
        { error: 'Account ID is required' },
        { status: 400 }
      );
    }

    const addresses = await prisma.address.findMany({
      where: { accountId },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    console.log(`📍 Found ${addresses.length} addresses for account ${accountId}`);

    return NextResponse.json({ addresses });
  } catch (error) {
    console.error('❌ Error fetching addresses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch addresses' },
      { status: 500 }
    );
  }
}

// POST /api/addresses - Create a new address
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      accountId,
      label,
      type,
      street,
      city,
      region,
      country,
      postalCode,
      contactPerson,
      phone,
      isDefault
    } = body;

    if (!accountId || !label || !street || !city || !region || !country) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // If this is set as default, unset other defaults for the same account
    if (isDefault) {
      await prisma.address.updateMany({
        where: { accountId },
        data: { isDefault: false }
      });
    }

    const address = await prisma.address.create({
      data: {
        accountId,
        label,
        type: type || 'BOTH',
        street,
        city,
        region,
        country,
        postalCode,
        contactPerson,
        phone,
        isDefault: isDefault || false
      }
    });

    return NextResponse.json({ address }, { status: 201 });
  } catch (error) {
    console.error('Error creating address:', error);
    return NextResponse.json(
      { error: 'Failed to create address' },
      { status: 500 }
    );
  }
}

