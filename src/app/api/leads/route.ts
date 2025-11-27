import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NotificationService, SystemNotificationTriggers } from '@/lib/notification-service';
import { parseTableQuery, buildTableQuery, buildWhereClause, buildOrderBy } from '@/lib/query-builder';
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
    
    // Super Admins and Admins can see all leads, others see only their own
    const isSuperAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';
    
    // Custom filter handler
    const customFilters = (filters: Record<string, string | string[] | null>) => {
      const where: any = {};

      if (filters.status) {
        // If a specific status is requested, use it
        where.status = filters.status;
      } else if (!params.filters?.status) {
        // If no status filter, exclude leads that have been converted to opportunities
        // Keep QUOTE_SENT leads visible since they haven't been fully converted yet
        where.status = {
          notIn: ['CONVERTED_TO_OPPORTUNITY', 'NEW_OPPORTUNITY', 'NEGOTIATION', 'CONTRACT_SIGNED', 'WON', 'LOST']
        };
      }

      return where;
    };

    const where = buildWhereClause(params, {
      searchFields: ['firstName', 'lastName', 'email', 'company', 'phone', 'subject'],
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

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          owner: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.lead.count({ where }),
    ]);

    // Parse JSON fields for each lead
    const parsedLeads = leads.map(lead => ({
      ...lead,
      assignedTo: (lead as any).assignedTo ? (() => {
        try {
          return JSON.parse((lead as any).assignedTo);
        } catch (e) {
          console.error('Error parsing assignedTo for lead', lead.id, ':', e);
          return null;
        }
      })() : null,
      interestedProducts: (lead as any).interestedProducts ? (() => {
        try {
          return JSON.parse((lead as any).interestedProducts);
        } catch (e) {
          console.error('Error parsing interestedProducts for lead', lead.id, ':', e);
          return null;
        }
      })() : null,
    }));

    return NextResponse.json({
      leads: parsedLeads,
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
    console.error('Error fetching leads:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leads' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('POST /api/leads - Starting request');
    const session = await getServerSession(authOptions);
    console.log('Session:', session);
    
    if (!session?.user) {
      console.log('No session or user found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    console.log('User ID:', userId);
    
    if (!userId) {
      console.log('No user ID found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    console.log('Request body:', body);
    
    const {
      firstName,
      lastName,
      email,
      phone,
      company,
      source,
      status = 'NEW',
      score = 0,
      notes,
      subject,
      leadType = 'INDIVIDUAL',
      assignedTo,
      interestedProducts,
      followUpDate,
      hasBillingAddress,
      hasShippingAddress,
      sameAsBilling,
      billingAddress,
      shippingAddress,
    } = body;

    if (!firstName || !lastName) {
      console.log('Missing required fields:', { firstName, lastName });
      return NextResponse.json(
        { error: 'First name and last name are required' },
        { status: 400 }
      );
    }

    console.log('Creating lead with data:', {
      firstName,
      lastName,
      email,
      phone,
      company,
      source,
      status,
      score,
      notes,
      ownerId: userId,
    });

    const lead = await prisma.lead.create({
      data: {
        firstName,
        lastName,
        email,
        phone,
        company,
        source,
        status,
        score,
        notes,
        subject: subject as any,
        leadType: leadType as any,
        assignedTo: assignedTo && Array.isArray(assignedTo) && assignedTo.length > 0 ? JSON.stringify(assignedTo) : null,
        interestedProducts: interestedProducts && Array.isArray(interestedProducts) && interestedProducts.length > 0 ? JSON.stringify(interestedProducts) : null,
        followUpDate: followUpDate ? new Date(followUpDate) : null,
        ownerId: userId,
        // Address fields
        hasBillingAddress: hasBillingAddress || false,
        hasShippingAddress: hasShippingAddress || false,
        sameAsBilling: sameAsBilling !== undefined ? sameAsBilling : true,
        billingAddress: billingAddress ? billingAddress : null,
        shippingAddress: shippingAddress ? shippingAddress : null,
      } as any,
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    console.log('Lead created successfully:', lead);

    // Log activity
    try {
      await prisma.activity.create({
        data: {
          entityType: 'Lead',
          entityId: lead.id,
          action: 'created',
          details: { lead: { firstName, lastName, email, company } },
          userId: userId,
        },
      });
      console.log('Activity logged successfully');
    } catch (activityError) {
      console.error('Error logging activity:', activityError);
      // Don't fail the request if activity logging fails
    }

    // Log audit trail
    await logAuditEvent({
      userId,
      action: 'lead.created',
      resource: 'Lead',
      resourceId: lead.id,
      newData: {
        firstName,
        lastName,
        email,
        phone,
        company,
        source,
        status,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      userAgent: request.headers.get('user-agent') || null,
    });

    // Parse JSON fields
    const parsedLead = {
      ...lead,
      assignedTo: (lead as any).assignedTo ? (() => {
        try {
          return JSON.parse((lead as any).assignedTo);
        } catch (e) {
          console.error('Error parsing assignedTo:', e);
          return null;
        }
      })() : null,
      interestedProducts: (lead as any).interestedProducts ? (() => {
        try {
          return JSON.parse((lead as any).interestedProducts);
        } catch (e) {
          console.error('Error parsing interestedProducts:', e);
          return null;
        }
      })() : null,
    };

    // Create a task automatically if follow-up date is provided
    if (followUpDate) {
      try {
        const followUpDateObj = new Date(followUpDate);
        const taskTitle = `Follow-up with ${firstName} ${lastName}`;
        const taskDescription = `Follow-up task for ${company || 'lead'}. ${notes ? `Notes: ${notes}` : ''}`;
        
        // Determine assignee - use first assigned user or the lead owner
        let taskAssignee = userId; // Default to lead owner
        if (parsedLead.assignedTo && Array.isArray(parsedLead.assignedTo) && parsedLead.assignedTo.length > 0) {
          const firstAssignedUser = parsedLead.assignedTo[0];
          taskAssignee = typeof firstAssignedUser === 'string' ? firstAssignedUser : firstAssignedUser.id;
        }

        // Create the task
        await (prisma as any).task.create({
          data: {
            title: taskTitle,
            description: taskDescription,
            priority: 'MEDIUM',
            dueDate: followUpDateObj,
            assignedTo: taskAssignee,
            createdBy: userId,
            leadId: lead.id,
            status: 'PENDING',
            assignmentType: 'INDIVIDUAL',
            assignees: {
              create: [{
                userId: taskAssignee,
                status: 'PENDING',
              }],
            },
          },
        });
        console.log('✅ Follow-up task created automatically for lead:', lead.id);
      } catch (taskError) {
        console.error('Error creating follow-up task:', taskError);
        // Don't fail the lead creation if task creation fails
      }
    }

    // Send notifications for lead creation
    try {
      await sendLeadNotifications(lead, parsedLead, userId);
    } catch (notificationError) {
      console.error('Error sending lead notifications:', notificationError);
      // Don't fail the request if notifications fail
    }

    return NextResponse.json(parsedLead, { status: 201 });
  } catch (error) {
    console.error('Error creating lead:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: 'Failed to create lead' },
      { status: 500 }
    );
  }
}

// Helper function to send lead creation notifications
async function sendLeadNotifications(lead: any, parsedLead: any, creatorId: string) {
  try {
    console.log('🚀 Starting to send lead notifications...');
    console.log('Lead details:', { 
      name: `${lead.firstName} ${lead.lastName}`, 
      email: lead.email, 
      phone: lead.phone,
      assignedTo: parsedLead.assignedTo,
      ownerId: lead.ownerId 
    });
    
    const leadName = `${lead.firstName} ${lead.lastName}`;
    const leadEmail = lead.email || '';
    const creator = await prisma.user.findUnique({
      where: { id: creatorId },
      select: { name: true, email: true }
    });
    const creatorName = creator?.name || creator?.email || 'Unknown User';
    console.log('Creator:', creatorName);

    // 1. Notify assigned users
    if (parsedLead.assignedTo && Array.isArray(parsedLead.assignedTo) && parsedLead.assignedTo.length > 0) {
      for (const assignedUser of parsedLead.assignedTo) {
        try {
          // Extract user ID from the object
          const assignedUserId = typeof assignedUser === 'string' ? assignedUser : assignedUser.id;
          
          const trigger = SystemNotificationTriggers.leadAssigned(
            leadName,
            leadEmail,
            creatorName,
            lead.source || ''
          );
          // Add phone number to trigger data for SMS
          if (lead.phone) {
            trigger.data = { ...trigger.data, phone: lead.phone };
          }
          await NotificationService.sendToUser(assignedUserId, trigger);
          console.log(`Lead assignment notification sent to user ${assignedUserId}`);
        } catch (error) {
          console.error(`Error sending assignment notification:`, error);
        }
      }
    }

    // 2. Notify admins about new lead creation
    const adminTrigger = SystemNotificationTriggers.leadCreated(
      leadName,
      leadEmail,
      creatorName,
      parsedLead.assignedTo
    );
    // Add phone number to trigger data for SMS
    if (lead.phone) {
      adminTrigger.data = { ...adminTrigger.data, phone: lead.phone };
    }
    await NotificationService.sendToAdmins(adminTrigger);
    console.log('Lead creation notification sent to admins');

    // 3. Notify lead owner if different from creator
    if (lead.ownerId !== creatorId) {
      try {
        const trigger = SystemNotificationTriggers.leadOwnerNotification(
          leadName,
          leadEmail,
          creatorName,
          {
            company: lead.company,
            source: lead.source,
            status: lead.status
          }
        );
        // Add phone number to trigger data for SMS
        if (lead.phone) {
          trigger.data = { ...trigger.data, phone: lead.phone };
        }
        await NotificationService.sendToUser(lead.ownerId, trigger);
        console.log(`Lead owner notification sent to user ${lead.ownerId}`);
      } catch (error) {
        console.error(`Error sending owner notification to user ${lead.ownerId}:`, error);
      }
    }

    // 4. Send welcome email to lead if they provided email
    if (lead.email) {
      try {
        // Extract the first assigned user's ID
        const firstAssignedUserId = parsedLead.assignedTo && parsedLead.assignedTo.length > 0
          ? (typeof parsedLead.assignedTo[0] === 'string' ? parsedLead.assignedTo[0] : parsedLead.assignedTo[0].id)
          : null;
        
        const assignedUser = firstAssignedUserId 
          ? await prisma.user.findUnique({
              where: { id: firstAssignedUserId },
              select: { name: true }
            })
          : null;

        const companyName = 'AD Pools Group'; // This could be made configurable
        const trigger = SystemNotificationTriggers.leadWelcome(
          leadName,
          companyName,
          assignedUser?.name || undefined
        );

        // Send directly to lead's email
        if (lead.email) {
          await NotificationService.sendToEmail(lead.email, trigger);
        }
        console.log(`Welcome email sent to lead ${lead.email}`);
      } catch (error) {
        console.error(`Error sending welcome email to lead ${lead.email}:`, error);
      }
    }

  } catch (error) {
    console.error('Error in sendLeadNotifications:', error);
    throw error;
  }
}
