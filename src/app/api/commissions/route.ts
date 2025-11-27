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
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // const session = await getServerSession(authOptions);
    // if (!session?.user?.id) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const params = parseTableQuery(request);

    // Custom filter handler
    const customFilters = (filters: Record<string, string | string[] | null>) => {
      const where: any = {};

      if (filters.status) {
        where.status = filters.status;
      }
      
      if (filters.type || filters.commissionType) {
        where.commissionType = filters.type || filters.commissionType;
      }
      
      if (filters.agentId) {
        where.agentId = filters.agentId;
      }
      
      if (filters.dateFrom || filters.dateTo) {
        where.createdAt = {};
        if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom as string);
        if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo as string);
      }

      return where;
    };

    const where = buildWhereClause(params, {
      searchFields: [], // We'll handle search manually for related fields
      customFilters,
    });

    // Add search for agent name, agent code, invoice/quote/order numbers
    if (params.search) {
      where.OR = [
        ...(where.OR || []),
        {
          agent: {
            OR: [
              { agentCode: { contains: params.search, mode: 'insensitive' } },
              {
                user: {
                  OR: [
                    { name: { contains: params.search, mode: 'insensitive' } },
                    { email: { contains: params.search, mode: 'insensitive' } },
                  ]
                }
              }
            ]
          }
        },
        {
          invoice: {
            number: { contains: params.search, mode: 'insensitive' }
          }
        },
        {
          quotation: {
            number: { contains: params.search, mode: 'insensitive' }
          }
        },
        {
          order: {
            orderNumber: { contains: params.search, mode: 'insensitive' }
          }
        }
      ];
    }

    const orderBy = buildOrderBy(params.sortBy, params.sortOrder);
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const [commissions, total] = await Promise.all([
      prisma.commission.findMany({
        where,
        include: {
          agent: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true
                }
              }
            }
          },
          invoice: {
            select: {
              id: true,
              number: true,
              total: true,
              account: {
                select: { id: true, name: true }
              }
            }
          },
          quotation: {
            select: {
              id: true,
              number: true,
              total: true,
              account: {
                select: { id: true, name: true }
              }
            }
          },
          order: {
            select: {
              id: true,
              orderNumber: true,
              totalAmount: true,
              distributor: {
                select: { id: true, businessName: true }
              }
            }
          },
          opportunity: {
            select: {
              id: true,
              name: true,
              value: true,
              account: {
                select: { id: true, name: true }
              }
            }
          }
        },
        orderBy,
        skip,
        take: limit
      }),
      prisma.commission.count({ where })
    ]);

    return NextResponse.json({
      commissions,
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
    console.error('Error fetching commissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch commissions' },
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
    // const session = await getServerSession(authOptions);
    // if (!session?.user?.id) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const body = await request.json();
    const {
      agentId,
      commissionType,
      calculationType,
      status = 'PENDING',
      invoiceId,
      quotationId,
      orderId,
      opportunityId,
      baseAmount,
      commissionRate,
      commissionAmount,
      notes
    } = body;

    // Validation
    if (!agentId || !commissionType || !calculationType || !baseAmount || !commissionRate || !commissionAmount) {
      return NextResponse.json(
        { error: 'Agent ID, commission type, calculation type, base amount, rate, and commission amount are required' },
        { status: 400 }
      );
    }

    // Check if agent exists
    const agent = await prisma.agent.findUnique({
      where: { id: agentId }
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Create commission
    const commission = await prisma.commission.create({
      data: {
        agentId,
        commissionType,
        calculationType,
        status,
        invoiceId: invoiceId || null,
        quotationId: quotationId || null,
        orderId: orderId || null,
        opportunityId: opportunityId || null,
        baseAmount,
        commissionRate,
        commissionAmount,
        notes: notes || null
      },
      include: {
        agent: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    });

    console.log(`✅ Commission created: ${commission.id} for agent ${agent.agentCode}`);

    return NextResponse.json(commission, { status: 201 });
  } catch (error) {
    console.error('Error creating commission:', error);
    return NextResponse.json(
      { error: 'Failed to create commission' },
      { status: 500 }
    );
  }
}

