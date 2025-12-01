import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Customer Search API: Starting request');
    const session = await getServerSession(authOptions);
    console.log('🔍 Customer Search API: Session exists:', !!session);
    
    if (!session?.user) {
      console.log('❌ Customer Search API: No session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    console.log('🔍 Customer Search API: User ID:', userId);
    
    if (!userId) {
      console.log('❌ Customer Search API: No user ID');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    console.log('🔍 Customer Search API: Search term:', search);

    // Fetch all customer types in parallel
    console.log('🔍 Customer Search API: Starting database queries');
    const [accounts, distributors, leads] = await Promise.all([
      // Accounts (CRM Customers)
      prisma.account.findMany({
        where: {
          ownerId: userId,
          ...(search && {
            OR: [
              { name: { contains: search } },
              { email: { contains: search } },
              { phone: { contains: search } },
            ],
          }),
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          type: true,
          address: true,
        },
        take: 10,
      }),

      // Distributors
      prisma.distributor.findMany({
        where: {
          ...(search && {
            OR: [
              { businessName: { contains: search } },
              { email: { contains: search } },
              { phone: { contains: search } },
            ],
          }),
        },
        select: {
          id: true,
          businessName: true,
          email: true,
          phone: true,
          creditLimit: true,
        },
        take: 10,
      }),

      // Leads
      prisma.lead.findMany({
        where: {
          ownerId: userId,
          ...(search && {
            OR: [
              { firstName: { contains: search } },
              { lastName: { contains: search } },
              { email: { contains: search } },
              { company: { contains: search } },
            ],
          }),
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          company: true,
        },
        take: 10,
      }),
    ]);

    console.log('🔍 Customer Search API: Database queries completed');
    console.log('🔍 Customer Search API: Results - Accounts:', accounts.length, 'Distributors:', distributors.length, 'Leads:', leads.length);

    // Format the results consistently
    const customers = [
      // Accounts
      ...accounts.map(account => ({
        id: account.id,
        name: account.name,
        email: account.email,
        phone: account.phone,
        address: account.address,
        type: 'account' as const,
        // Accounts are always STANDARD (credit terms are for Distributors)
        customerType: 'STANDARD' as const,
        displayName: account.name,
        category: 'CRM Customer',
      })),

      // Distributors
      ...distributors.map(distributor => ({
        id: distributor.id,
        name: distributor.businessName,
        email: distributor.email,
        phone: distributor.phone,
        type: 'distributor' as const,
        // Use creditLimit to determine if CREDIT or STANDARD customer
        customerType: (distributor.creditLimit && Number(distributor.creditLimit) > 0) ? 'CREDIT' : 'STANDARD',
        displayName: distributor.businessName,
        category: 'Distributor',
      })),

      // Leads
      ...leads.map(lead => ({
        id: lead.id,
        name: `${lead.firstName} ${lead.lastName}`.trim(),
        email: lead.email,
        phone: lead.phone,
        type: 'lead' as const,
        customerType: 'STANDARD' as const,
        displayName: `${lead.firstName} ${lead.lastName}`.trim() + (lead.company ? ` (${lead.company})` : ''),
        category: 'Lead',
        company: lead.company,
      })),
    ];

    console.log('🔍 Customer Search API: Final customers count:', customers.length);
    return NextResponse.json({ customers });
  } catch (error) {
    console.error('❌ Customer Search API Error:', error);
    console.error('❌ Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
    });
    return NextResponse.json(
      { error: 'Failed to search customers', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
