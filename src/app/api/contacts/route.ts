import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseTableQuery, buildWhereClause, buildOrderBy } from '@/lib/query-builder';
import { logAuditEvent } from '@/lib/audit-log';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = parseTableQuery(request);

    // Super Admins and Admins can see all contacts, others see only contacts from their accounts
    const isSuperAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';
    
    // Custom filter handler
    const customFilters = (filters: Record<string, string | string[] | null>) => {
      const where: any = {};

      if (filters.accountId) {
        where.accountId = filters.accountId;
      }

      return where;
    };

    const where = buildWhereClause(params, {
      searchFields: ['firstName', 'lastName', 'email', 'phone', 'position'],
      customFilters,
    });

    // Only filter by account owner if user is not Super Admin or Admin
    if (!isSuperAdmin) {
      where.account = {
        ownerId: userId,
      };
    }

    const orderBy = buildOrderBy(params.sortBy, params.sortOrder);
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          account: {
            select: { id: true, name: true, type: true },
          },
        },
      }),
      prisma.contact.count({ where }),
    ]);

    return NextResponse.json({
      contacts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      sort: params.sortBy
        ? {
            field: params.sortBy,
            order: params.sortOrder || 'desc',
          }
        : undefined,
    });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contacts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      firstName,
      lastName,
      email,
      phone,
      position,
      accountId,
    } = body;

    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: 'First name and last name are required' },
        { status: 400 }
      );
    }

    if (!accountId) {
      return NextResponse.json(
        { error: 'Account ID is required' },
        { status: 400 }
      );
    }

    // Verify the account belongs to the user (or user is Super Admin)
    const userRole = (session.user as any).role;
    const isSuperAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';
    
    const accountWhere: any = { id: accountId };
    if (!isSuperAdmin) {
      accountWhere.ownerId = userId;
    }
    
    const account = await prisma.account.findFirst({
      where: accountWhere,
    });

    if (!account) {
      return NextResponse.json(
        { error: 'Account not found or access denied' },
        { status: 404 }
      );
    }

    const contact = await prisma.contact.create({
      data: {
        firstName,
        lastName,
        email,
        phone,
        position,
        accountId,
      },
      include: {
        account: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        entityType: 'Contact',
        entityId: contact.id,
        action: 'created',
        details: { contact: { firstName, lastName, email, position } },
        userId: userId,
      },
    });

    // Log audit trail
    await logAuditEvent({
      userId,
      action: 'contact.created',
      resource: 'Contact',
      resourceId: contact.id,
      newData: { firstName, lastName, email, phone, position, accountId },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      userAgent: request.headers.get('user-agent') || null,
    });

    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    console.error('Error creating contact:', error);
    return NextResponse.json(
      { error: 'Failed to create contact' },
      { status: 500 }
    );
  }
}