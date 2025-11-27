import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { leadId, userId, role, notes } = body;

    if (!leadId || !userId) {
      return NextResponse.json(
        { error: 'Lead ID and User ID are required' },
        { status: 400 }
      );
    }

    // Verify the lead exists
    const lead = await prisma.lead.findUnique({
      where: {
        id: leadId,
      },
    });

    if (!lead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }

    // Check if user has access (owner, assigned user, or admin)
    const assignedUsers = (lead as any).assignedTo ? 
      (typeof (lead as any).assignedTo === 'string' ? JSON.parse((lead as any).assignedTo) : (lead as any).assignedTo) : [];
    
    const isOwner = lead.ownerId === session.user.id;
    const isAssigned = assignedUsers.some((user: any) => user.id === session.user.id);
    const userRole = (session.user as any).role;
    const isAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';
    
    if (!isOwner && !isAssigned && !isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Verify the user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get current assigned users from the lead
    const currentAssignedTo = (lead as any).assignedTo ? 
      (typeof (lead as any).assignedTo === 'string' ? JSON.parse((lead as any).assignedTo) : (lead as any).assignedTo) : [];
    
    // Check if user is already assigned
    const isAlreadyAssigned = currentAssignedTo.some((assignedUser: any) => 
      assignedUser.id === userId
    );
    
    if (isAlreadyAssigned) {
      return NextResponse.json(
        { error: 'User is already assigned to this lead' },
        { status: 400 }
      );
    }
    
    // Add the new user to the assignedTo array
    const updatedAssignedTo = [
      ...currentAssignedTo,
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: role || 'ASSIGNED',
        notes: notes || null,
        assignedBy: session.user.id,
        assignedAt: new Date().toISOString(),
      }
    ];
    
    // Update the lead with the new assigned users
    await prisma.lead.update({
      where: { id: leadId },
      data: { assignedTo: JSON.stringify(updatedAssignedTo) } as any
    });

    // Send SMS notification to the assigned user (except if they assigned themselves)
    if (userId !== session.user.id && user.phone) {
      try {
        const smsMessage = `You have been assigned to lead: ${lead.company || 'New Lead'}. Role: ${role || 'ASSIGNED'}. Please check your dashboard for details.`;
        
        // Send SMS using the same logic as lead-sms API
        const smsResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/lead-sms`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('cookie') || '',
          },
          body: JSON.stringify({
            leadId,
            to: user.phone,
            message: smsMessage,
            type: 'ASSIGNMENT_NOTIFICATION'
          })
        });

        if (!smsResponse.ok) {
          console.error('Failed to send assignment SMS notification:', await smsResponse.text());
        }
      } catch (smsError) {
        console.error('Error sending assignment SMS notification:', smsError);
        // Don't fail the assignment if SMS fails
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'User assigned successfully',
      data: {
        leadId,
        userId,
        role: role || 'ASSIGNED',
        notes: notes || null,
        assignedBy: session.user.id,
        assignedAt: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('Error assigning user to lead:', error);
    return NextResponse.json(
      { error: 'Failed to assign user' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get('leadId');

    if (!leadId) {
      return NextResponse.json(
        { error: 'Lead ID is required' },
        { status: 400 }
      );
    }

    // Verify the lead exists
    const lead = await prisma.lead.findUnique({
      where: {
        id: leadId,
      },
    });

    if (!lead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }

    // Check if user has access (owner, assigned user, or admin)
    // Parse assigned users from the lead
    const assignedUsers = (lead as any).assignedTo ? 
      (typeof (lead as any).assignedTo === 'string' ? JSON.parse((lead as any).assignedTo) : (lead as any).assignedTo) : [];
    
    const isOwner = lead.ownerId === session.user.id;
    const isAssigned = assignedUsers.some((user: any) => user.id === session.user.id);
    const userRole = (session.user as any).role;
    const isAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';
    
    if (!isOwner && !isAssigned && !isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Return the assigned users from the lead (reuse the already parsed assignedUsers)
    
    // Get all users for the assignment popup (excluding already assigned users)
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
      },
      orderBy: { name: 'asc' }
    });

    // Filter out already assigned users
    const assignedUserIds = assignedUsers.map((user: any) => user.id);
    const availableUsers = allUsers.filter(user => !assignedUserIds.includes(user.id));

    return NextResponse.json({ 
      assignedUsers,
      availableUsers 
    });
  } catch (error) {
    console.error('Error fetching lead users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assigned users' },
      { status: 500 }
    );
  }
}
