import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseTableQuery, buildWhereClause, buildOrderBy } from '@/lib/query-builder';

// Helper function to generate agent code
async function generateAgentCode(): Promise<string> {
  const count = await prisma.agent.count();
  const nextNumber = count + 1;
  return `AG-${nextNumber.toString().padStart(4, '0')}`;
}

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
      
      if (filters.territory) {
        where.territory = filters.territory;
      }
      
      if (filters.team) {
        where.team = filters.team;
      }
      
      if (filters.managerId) {
        where.managerId = filters.managerId;
      }

      return where;
    };

    const where = buildWhereClause(params, {
      searchFields: ['agentCode'],
      customFilters,
    });

    // Add search for user name and email
    if (params.search) {
      where.OR = [
        ...(where.OR || []),
        {
          user: {
            OR: [
              { name: { contains: params.search, mode: 'insensitive' } },
              { email: { contains: params.search, mode: 'insensitive' } },
            ]
          }
        },
        {
          territory: { contains: params.search, mode: 'insensitive' }
        },
        {
          team: { contains: params.search, mode: 'insensitive' }
        }
      ];
    }

    const orderBy = buildOrderBy(params.sortBy, params.sortOrder);
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const agents = await prisma.agent.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            image: true,
            role: true
          }
        },
        manager: {
          select: {
            id: true,
            agentCode: true,
            user: {
              select: {
                name: true,
                email: true
              }
            }
          }
        },
        _count: {
          select: {
            commissions: true
          }
        }
      },
      orderBy,
      skip,
      take: limit
    });

    // Get total count
    const total = await prisma.agent.count({ where });

    // Calculate total commissions for each agent
    const agentsWithStats = await Promise.all(
      agents.map(async (agent) => {
        const commissionStats = await prisma.commission.aggregate({
          where: { agentId: agent.id },
          _sum: {
            commissionAmount: true
          },
          _count: true
        });

        const pendingCommissions = await prisma.commission.aggregate({
          where: { 
            agentId: agent.id,
            status: 'PENDING'
          },
          _sum: {
            commissionAmount: true
          }
        });

        const paidCommissions = await prisma.commission.aggregate({
          where: { 
            agentId: agent.id,
            status: 'PAID'
          },
          _sum: {
            commissionAmount: true
          }
        });

        return {
          ...agent,
          totalCommissions: commissionStats._sum.commissionAmount || 0,
          commissionCount: commissionStats._count || 0,
          pendingCommissions: pendingCommissions._sum.commissionAmount || 0,
          paidCommissions: paidCommissions._sum.commissionAmount || 0
        };
      })
    );

    return NextResponse.json({
      agents: agentsWithStats,
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
    console.error('❌ Error fetching agents:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { 
        error: 'Failed to fetch agents',
        details: error instanceof Error ? error.message : String(error)
      },
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
    
    const authenticatedUserId = (session.user as any).id;
    if (!authenticatedUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      userId: targetUserId,
      status = 'ACTIVE',
      hireDate,
      territory,
      team,
      managerId,
      commissionRate = 0,
      targetMonthly,
      targetQuarterly,
      targetAnnual,
      notes
    } = body;

    // Validation
    if (!targetUserId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: targetUserId }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user is already an agent
    const existingAgent = await prisma.agent.findUnique({
      where: { userId: targetUserId }
    });

    if (existingAgent) {
      return NextResponse.json(
        { error: 'User is already an agent' },
        { status: 400 }
      );
    }

    // Generate agent code
    const agentCode = await generateAgentCode();

    // Create agent
    const agent = await prisma.agent.create({
      data: {
        userId: targetUserId,
        agentCode,
        status,
        hireDate: hireDate ? new Date(hireDate) : new Date(),
        territory: territory || null,
        team: team || null,
        managerId: managerId || null,
        commissionRate,
        targetMonthly: targetMonthly || null,
        targetQuarterly: targetQuarterly || null,
        targetAnnual: targetAnnual || null,
        notes: notes || null
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true
          }
        },
        manager: {
          select: {
            id: true,
            agentCode: true,
            user: {
              select: {
                name: true,
                email: true
              }
            }
          }
        }
      }
    });

    console.log(`✅ Agent created: ${agent.agentCode} for user ${user.name}`);

    return NextResponse.json(agent, { status: 201 });
  } catch (error) {
    console.error('Error creating agent:', error);
    return NextResponse.json(
      { error: 'Failed to create agent' },
      { status: 500 }
    );
  }
}

