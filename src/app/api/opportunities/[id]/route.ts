import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logAuditEvent } from '@/lib/audit-log';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    console.log('🔍 Opportunity API: Session check:', { 
      hasSession: !!session, 
      hasUser: !!session?.user, 
      hasUserId: !!session?.user?.id,
      userId: session?.user?.id 
    });
    
    if (!session?.user?.id) {
      console.log('❌ Opportunity API: Unauthorized - no session or user ID');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    
    // Fetch from Opportunity table
    const opportunity = await prisma.opportunity.findUnique({
      where: {
        id: params.id
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
        },
        lead: {
          include: {
            tasks: {
              include: {
                assignee: {
                  select: {
                    id: true,
                    name: true,
                    email: true
                  }
                },
                creator: {
                  select: {
                    id: true,
                    name: true,
                    email: true
                  }
                }
              },
              orderBy: {
                createdAt: 'desc'
              }
            },
            comments: true,
            files: true,
            emails: true,
            sms: true,
            products: {
              include: {
                product: true
              },
              orderBy: {
                createdAt: 'desc'
              }
            },
            meetings: true
          }
        },
        quotations: {
          include: {
            billingContact: true,
            shippingContact: true,
            account: true,
            lines: {
              include: {
                product: true
              }
            }
          }
        },
        invoices: {
          include: {
            account: true,
            lines: {
              include: {
                product: true
              }
            }
          }
        }
      }
    });

    if (!opportunity) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
    }

    return NextResponse.json(opportunity);
  } catch (error) {
    console.error('Error fetching opportunity:', error);
    return NextResponse.json(
      { error: 'Failed to fetch opportunity' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const body = await request.json();
    const {
      name,
      stage,
      value,
      probability,
      closeDate,
      lostReason
    } = body;

    // Validate stage
    const validStages = ['QUOTE_SENT', 'QUOTE_REVIEWED', 'NEGOTIATION', 'WON', 'LOST'];
    if (stage && !validStages.includes(stage)) {
      return NextResponse.json(
        { error: 'Invalid stage' },
        { status: 400 }
      );
    }

    // Validate probability
    if (probability !== null && probability !== undefined) {
      if (probability < 0 || probability > 100) {
        return NextResponse.json(
          { error: 'Probability must be between 0 and 100' },
          { status: 400 }
        );
      }
    }

    // Validate value
    if (value !== null && value !== undefined) {
      if (value < 0) {
        return NextResponse.json(
          { error: 'Value must be positive' },
          { status: 400 }
        );
      }
    }

    // Get existing opportunity for audit trail
    const existingOpportunity = await prisma.opportunity.findUnique({
      where: { id: params.id },
    });

    if (!existingOpportunity) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
    }

    // If stage is being set to WON and value is not provided or is 0, 
    // automatically populate from invoices (preferred) or quotations
    let dealValue = value;
    let dealProbability = probability;
    
    if (stage === 'WON' && (!value || value === 0)) {
      // Get the current opportunity with relations to check for invoices/quotations
      const currentOpportunity = await prisma.opportunity.findUnique({
        where: { id: params.id },
        include: {
          invoices: {
            orderBy: { createdAt: 'desc' },
            take: 1
          },
          quotations: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      });

      if (currentOpportunity) {
        // Prefer invoice total, fallback to quotation total
        if (currentOpportunity.invoices && currentOpportunity.invoices.length > 0) {
          dealValue = currentOpportunity.invoices[0].total;
          console.log(`✅ Setting deal value from invoice: ${dealValue}`);
        } else if (currentOpportunity.quotations && currentOpportunity.quotations.length > 0) {
          dealValue = currentOpportunity.quotations[0].total;
          console.log(`✅ Setting deal value from quotation: ${dealValue}`);
        }
        
        // If we found a value, set probability to 100%
        if (dealValue && dealValue > 0) {
          dealProbability = 100;
        }
      }
    }

    // Update the opportunity
    const opportunity = await prisma.opportunity.update({
      where: {
        id: params.id
      },
      data: {
        ...(name && { name }),
        ...(stage && { stage }),
        ...(dealValue !== undefined && { value: dealValue }),
        ...(dealProbability !== undefined && { probability: dealProbability }),
        ...(closeDate && { closeDate: new Date(closeDate) }),
        ...(lostReason && { lostReason }),
        ...(stage === 'WON' && { wonDate: new Date() })
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
            email: true
          }
        },
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            company: true
          }
        }
      }
    });

    // Log audit trail
    await logAuditEvent({
      userId: (session.user as any).id,
      action: 'opportunity.updated',
      resource: 'Opportunity',
      resourceId: opportunity.id,
      oldData: {
        name: existingOpportunity.name,
        stage: existingOpportunity.stage,
        value: existingOpportunity.value,
        probability: existingOpportunity.probability,
      },
      newData: {
        name: name || existingOpportunity.name,
        stage: stage || existingOpportunity.stage,
        value: dealValue !== undefined ? dealValue : existingOpportunity.value,
        probability: dealProbability !== undefined ? dealProbability : existingOpportunity.probability,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      userAgent: request.headers.get('user-agent') || null,
    });

    return NextResponse.json(opportunity);
  } catch (error) {
    console.error('Error updating opportunity:', error);
    return NextResponse.json(
      { error: 'Failed to update opportunity' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    
    // Check if opportunity has quotations or invoices
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: params.id },
      include: {
        quotations: true,
        invoices: true
      }
    });

    if (!opportunity) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
    }

    // If there are quotations or invoices, unlink them first
    if (opportunity.quotations && opportunity.quotations.length > 0) {
      await prisma.quotation.updateMany({
        where: { opportunityId: params.id },
        data: { opportunityId: null }
      });
      console.log(`🔗 Unlinked ${opportunity.quotations.length} quotations from opportunity`);
    }

    if (opportunity.invoices && opportunity.invoices.length > 0) {
      await prisma.invoice.updateMany({
        where: { opportunityId: params.id },
        data: { opportunityId: null }
      });
      console.log(`🔗 Unlinked ${opportunity.invoices.length} invoices from opportunity`);
    }
    
    // Log audit trail before deletion
    await logAuditEvent({
      userId: (session.user as any).id,
      action: 'opportunity.deleted',
      resource: 'Opportunity',
      resourceId: params.id,
      oldData: {
        name: opportunity.name,
        stage: opportunity.stage,
        value: opportunity.value,
        probability: opportunity.probability,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      userAgent: request.headers.get('user-agent') || null,
    });

    // Now delete the opportunity
    await prisma.opportunity.delete({
      where: {
        id: params.id
      }
    });

    console.log('✅ Opportunity deleted successfully');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting opportunity:', error);
    return NextResponse.json(
      { error: 'Failed to delete opportunity' },
      { status: 500 }
    );
  }
}