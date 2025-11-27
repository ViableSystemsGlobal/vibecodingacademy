import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logAuditEvent } from '@/lib/audit-log';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const contact = await prisma.contact.findUnique({
      where: {
        id: id
      },
      include: {
        account: true
      }
    });

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    return NextResponse.json(contact);
  } catch (error) {
    console.error('Error fetching contact:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contact' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    
    // Get existing contact for audit trail
    const existingContact = await prisma.contact.findUnique({
      where: { id },
    });

    if (!existingContact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      firstName,
      lastName,
      email,
      phone,
      position,
      department,
      role,
      accountId
    } = body;

    const contact = await prisma.contact.update({
      where: {
        id: id
      },
      data: {
        firstName,
        lastName,
        email,
        phone,
        position,
        department,
        role,
        accountId
      },
      include: {
        account: true
      }
    });

    // Log audit trail
    await logAuditEvent({
      userId: (session.user as any).id,
      action: 'contact.updated',
      resource: 'Contact',
      resourceId: contact.id,
      oldData: {
        firstName: existingContact.firstName,
        lastName: existingContact.lastName,
        email: existingContact.email,
        phone: existingContact.phone,
        position: existingContact.position,
      },
      newData: { firstName, lastName, email, phone, position },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      userAgent: request.headers.get('user-agent') || null,
    });

    return NextResponse.json(contact);
  } catch (error) {
    console.error('Error updating contact:', error);
    return NextResponse.json(
      { error: 'Failed to update contact' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    
    // Get existing contact for audit trail
    const existingContact = await prisma.contact.findUnique({
      where: { id },
    });

    if (!existingContact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    await prisma.contact.delete({
      where: {
        id: id
      }
    });

    // Log audit trail
    await logAuditEvent({
      userId: (session.user as any).id,
      action: 'contact.deleted',
      resource: 'Contact',
      resourceId: id,
      oldData: {
        firstName: existingContact.firstName,
        lastName: existingContact.lastName,
        email: existingContact.email,
        phone: existingContact.phone,
        position: existingContact.position,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      userAgent: request.headers.get('user-agent') || null,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting contact:', error);
    return NextResponse.json(
      { error: 'Failed to delete contact' },
      { status: 500 }
    );
  }
}