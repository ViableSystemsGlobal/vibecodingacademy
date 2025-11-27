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

    // Super Admins and Admins can see all opportunities, others see only their own
    const isSuperAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';

    const params = parseTableQuery(request);

    // Custom filter handler
    const customFilters = (filters: Record<string, string | string[] | null>) => {
      const where: any = {};
      
      if (filters.status) {
        where.stage = filters.status;
      }

      return where;
    };

    const where = buildWhereClause(params, {
      searchFields: ['name'],
      customFilters,
    });

    // Add customer name search if search term exists
    // Note: SQLite doesn't support 'mode: insensitive', so we use contains only
    // For case-insensitive search in SQLite, we'd need to use raw SQL or handle in application layer
    if (params.search) {
      where.OR = [
        ...(where.OR || []), // Preserve existing OR conditions from buildWhereClause
        {
          account: {
            OR: [
              { name: { contains: params.search } },
              { email: { contains: params.search } }
            ]
          }
        },
        {
          lead: {
            OR: [
              { firstName: { contains: params.search } },
              { lastName: { contains: params.search } },
              { company: { contains: params.search } }
            ]
          }
        }
      ];
    }

    // Only filter by owner if user is not Super Admin or Admin
    if (!isSuperAdmin) {
      where.ownerId = userId;
    }

    const orderBy = buildOrderBy(params.sortBy, params.sortOrder);
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const [opportunities, total] = await Promise.all([
      prisma.opportunity.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          account: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              type: true,
            },
          },
          lead: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              company: true,
            },
          },
          quotations: {
            select: {
              id: true,
              number: true,
              status: true,
              total: true,
              createdAt: true,
            },
          },
          invoices: {
            select: {
              id: true,
              number: true,
              status: true,
              total: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.opportunity.count({ where })
    ]);

    return NextResponse.json({
      opportunities,
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
    console.error('Error in opportunities API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
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
    const { name, accountId, stage, value, probability, closeDate, lostReason } = body;

    // Validate required fields
    if (!name || !accountId) {
      return NextResponse.json(
        { error: 'Name and account are required' },
        { status: 400 }
      );
    }

    // Verify account exists
    const account = await prisma.account.findUnique({
      where: { id: accountId }
    });

    if (!account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // Validate stage
    const validStages = ['QUOTE_SENT', 'QUOTE_REVIEWED', 'NEGOTIATION', 'WON', 'LOST'];
    const opportunityStage = stage || 'QUOTE_SENT';
    if (!validStages.includes(opportunityStage)) {
      return NextResponse.json(
        { error: 'Invalid stage' },
        { status: 400 }
      );
    }

    // Validate probability
    let oppProbability = probability !== undefined ? parseInt(probability) : 25;
    if (oppProbability < 0 || oppProbability > 100) {
      return NextResponse.json(
        { error: 'Probability must be between 0 and 100' },
        { status: 400 }
      );
    }

    // If stage is WON, automatically set probability to 100%
    if (opportunityStage === 'WON') {
      oppProbability = 100;
    }

    // Determine the deal value
    let dealValue = value !== undefined && value !== null ? parseFloat(value) : null;
    
    // If stage is WON but no value provided, try to get from account's invoices/quotations
    if (opportunityStage === 'WON' && (!dealValue || dealValue === 0)) {
      // Get the account's latest invoice or quotation
      const latestInvoice = await prisma.invoice.findFirst({
        where: { accountId },
        orderBy: { createdAt: 'desc' }
      });
      
      if (latestInvoice) {
        dealValue = latestInvoice.total;
        console.log(`✅ Setting deal value from latest invoice: ${dealValue}`);
      } else {
        const latestQuotation = await prisma.quotation.findFirst({
          where: { accountId },
          orderBy: { createdAt: 'desc' }
        });
        
        if (latestQuotation) {
          dealValue = latestQuotation.total;
          console.log(`✅ Setting deal value from latest quotation: ${dealValue}`);
        }
      }
    }

    // Create the opportunity
    const opportunity = await prisma.opportunity.create({
      data: {
        name,
        accountId,
        stage: opportunityStage,
        value: dealValue,
        probability: oppProbability,
        closeDate: closeDate ? new Date(closeDate) : null,
        lostReason: lostReason || null,
        ownerId: userId,
        ...(opportunityStage === 'WON' && { wonDate: new Date() })
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        account: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            type: true
          }
        }
      }
    });

    console.log('✅ Created opportunity from account:', opportunity.id);

    // Log audit trail
    await logAuditEvent({
      userId,
      action: 'opportunity.created',
      resource: 'Opportunity',
      resourceId: opportunity.id,
      newData: { name, accountId, stage: opportunityStage, value: dealValue, probability: oppProbability },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      userAgent: request.headers.get('user-agent') || null,
    });

    return NextResponse.json(opportunity, { status: 201 });
  } catch (error) {
    console.error('Error creating opportunity:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}