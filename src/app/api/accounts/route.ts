import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseTableQuery, buildWhereClause, buildOrderBy } from '@/lib/query-builder';

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

    // Super Admins and Admins can see all accounts, others see only their own
    const isSuperAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';
    
    // Custom filter handler
    const customFilters = (filters: Record<string, string | string[] | null>) => {
      const where: any = {};

      if (filters.type) {
        where.type = filters.type;
      }

      return where;
    };

    const where = buildWhereClause(params, {
      searchFields: ['name', 'email', 'phone'],
      customFilters,
    });

    // Ensure owner filter is applied for non-admins
    if (!isSuperAdmin) {
      where.ownerId = userId;
    }

    const orderBy = buildOrderBy(params.sortBy, params.sortOrder);
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const [accounts, total] = await Promise.all([
      prisma.account.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          owner: {
            select: { id: true, name: true, email: true },
          },
          contacts: {
            select: { id: true, firstName: true, lastName: true, email: true, phone: true },
          },
          opportunities: {
            select: { id: true, name: true, stage: true, value: true, closeDate: true },
          },
          quotations: {
            select: { id: true, number: true, status: true, total: true, createdAt: true },
          },
          proformas: {
            select: { id: true, number: true, status: true, total: true, createdAt: true },
          },
          _count: {
            select: { contacts: true, opportunities: true, quotations: true, proformas: true },
          },
        },
      }),
      prisma.account.count({ where }),
    ]);

    return NextResponse.json({
      accounts,
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
    console.error('Error fetching accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch accounts' },
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
      name,
      type = 'INDIVIDUAL',
      email,
      phone,
      website,
      notes,
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Account name is required' },
        { status: 400 }
      );
    }

    const account = await prisma.account.create({
      data: {
        name,
        type,
        email,
        phone,
        website,
        notes,
        ownerId: userId,
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
        contacts: true,
        opportunities: true,
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        entityType: 'Account',
        entityId: account.id,
        action: 'created',
        details: { account: { name, type, email } },
        userId: userId,
      },
    });

    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    console.error('Error creating account:', error);
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
}
