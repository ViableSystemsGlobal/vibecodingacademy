import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    
    if (!query || query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const searchTerm = query.trim();
    const userRole = (session.user as any).role;
    const isSuperAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';

    // Search across multiple entities in parallel
    const [products, invoices, quotations, orders, accounts, leads] = await Promise.all([
      // Products
      prisma.product.findMany({
        where: {
          OR: [
            { name: { contains: searchTerm } },
            { sku: { contains: searchTerm } },
            { description: { contains: searchTerm } },
          ],
        },
        select: {
          id: true,
          name: true,
          sku: true,
        },
        take: 5,
      }),

      // Invoices
      prisma.invoice.findMany({
        where: {
          OR: [
            { number: { contains: searchTerm } },
            { subject: { contains: searchTerm } },
          ],
          ...(isSuperAdmin ? {} : { ownerId: userId }),
        },
        select: {
          id: true,
          number: true,
          subject: true,
        },
        take: 5,
      }),

      // Quotations
      prisma.quotation.findMany({
        where: {
          OR: [
            { number: { contains: searchTerm } },
            { subject: { contains: searchTerm } },
          ],
          ...(isSuperAdmin ? {} : { ownerId: userId }),
        },
        select: {
          id: true,
          number: true,
          subject: true,
        },
        take: 5,
      }),

      // Orders
      prisma.salesOrder.findMany({
        where: {
          OR: [
            { number: { contains: searchTerm } },
            { notes: { contains: searchTerm } },
          ],
          ...(isSuperAdmin ? {} : { ownerId: userId }),
        },
        select: {
          id: true,
          number: true,
          notes: true,
        },
        take: 5,
      }),

      // Accounts
      prisma.account.findMany({
        where: {
          OR: [
            { name: { contains: searchTerm } },
            { email: { contains: searchTerm } },
          ],
          ...(isSuperAdmin ? {} : { ownerId: userId }),
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
        take: 5,
      }),

      // Leads
      prisma.lead.findMany({
        where: {
          OR: [
            { firstName: { contains: searchTerm } },
            { lastName: { contains: searchTerm } },
            { email: { contains: searchTerm } },
            { company: { contains: searchTerm } },
          ],
          ...(isSuperAdmin ? {} : { ownerId: userId }),
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          company: true,
        },
        take: 5,
      }),
    ]);

    // Format results
    const results = [
      ...products.map(p => ({
        type: 'product',
        id: p.id,
        title: p.name,
        subtitle: p.sku ? `SKU: ${p.sku}` : '',
        url: `/products/${p.id}`,
      })),
      ...invoices.map(i => ({
        type: 'invoice',
        id: i.id,
        title: i.number,
        subtitle: i.subject,
        url: `/invoices/${i.id}`,
      })),
      ...quotations.map(q => ({
        type: 'quotation',
        id: q.id,
        title: q.number,
        subtitle: q.subject,
        url: `/quotations/${q.id}`,
      })),
      ...orders.map(o => ({
        type: 'order',
        id: o.id,
        title: o.number,
        subtitle: o.notes || '',
        url: `/orders/${o.id}`,
      })),
      ...accounts.map(a => ({
        type: 'account',
        id: a.id,
        title: a.name,
        subtitle: a.email || '',
        url: `/crm/accounts/${a.id}`,
      })),
      ...leads.map(l => ({
        type: 'lead',
        id: l.id,
        title: `${l.firstName} ${l.lastName}`.trim() || l.company || 'Lead',
        subtitle: l.email || l.company || '',
        url: `/crm/leads/${l.id}`,
      })),
    ];

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Failed to perform search' },
      { status: 500 }
    );
  }
}

