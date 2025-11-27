import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseTableQuery, buildWhereClause, buildOrderBy } from '@/lib/query-builder';

// Helper function to generate invoice number
async function generateInvoiceNumber(): Promise<string> {
  const count = await prisma.invoice.count();
  const nextNumber = count + 1;
  return `INV-${nextNumber.toString().padStart(6, '0')}`;
}

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Invoices API: GET request received');
    
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = (session.user as any).id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = parseTableQuery(request);

    // Custom filter handler
    const customFilters = (filters: Record<string, string | string[] | null>) => {
      const where: any = {};

      if (filters.status) {
        where.status = filters.status;
      }
      
      if (filters.paymentStatus) {
        // Handle comma-separated payment statuses (e.g., "UNPAID,PARTIALLY_PAID")
        const paymentStatus = filters.paymentStatus;
        if (typeof paymentStatus === 'string' && paymentStatus.includes(',')) {
          where.paymentStatus = {
            in: paymentStatus.split(',').map(s => s.trim())
          };
        } else {
          where.paymentStatus = paymentStatus;
        }
      }
      
      if (filters.customerId) {
        where.OR = [
          { accountId: filters.customerId },
          { distributorId: filters.customerId },
          { leadId: filters.customerId }
        ];
      }

      return where;
    };

    const where = buildWhereClause(params, {
      searchFields: ['number', 'subject'],
      customFilters,
      dateField: 'issueDate',
    });

    // Add customer name search if search term exists
    if (params.search) {
      where.OR = [
        ...(where.OR || []), // Preserve existing OR conditions from buildWhereClause
        {
          account: {
            name: { contains: params.search, mode: 'insensitive' }
          }
        },
        {
          distributor: {
            businessName: { contains: params.search, mode: 'insensitive' }
          }
        },
        {
          lead: {
            OR: [
              { firstName: { contains: params.search, mode: 'insensitive' } },
              { lastName: { contains: params.search, mode: 'insensitive' } },
              { company: { contains: params.search, mode: 'insensitive' } }
            ]
          }
        }
      ];
    }

    const orderBy = buildOrderBy(params.sortBy, params.sortOrder);
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    // Get total count and paginated invoices
    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      select: {
        id: true,
        number: true,
        subject: true,
        status: true,
        paymentStatus: true,
        total: true,
        amountPaid: true,
        amountDue: true,
        issueDate: true,
        dueDate: true,
        paidDate: true,
        taxInclusive: true,
        notes: true,
        createdAt: true,
        owner: {
          select: { id: true, name: true, email: true },
        },
        account: {
          select: { id: true, name: true, email: true, phone: true },
        },
        distributor: {
          select: { id: true, businessName: true, email: true, phone: true },
        },
        lead: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true, company: true },
        },
        lines: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, images: true },
            },
          },
        },
        quotation: {
          select: { id: true, number: true, subject: true },
        },
        _count: {
          select: { lines: true },
        },
      },
      }),
      prisma.invoice.count({ where })
    ]);

    // Recalculate payment status for invoices on this page (fixes stale data)
    // Run in parallel for better performance
    await Promise.all(invoices.map(async (invoice) => {
      try {
        // Get both payment allocations AND credit note applications
        const [allAllocations, creditNoteApplications] = await Promise.all([
          prisma.paymentAllocation.findMany({
            where: { invoiceId: invoice.id },
            select: { amount: true }
          }),
          prisma.creditNoteApplication.findMany({
            where: { invoiceId: invoice.id },
            select: { amount: true }
          })
        ]);
        
        // Sum payments from allocations
        const totalPaidFromPayments = allAllocations.reduce((sum, allocation) => sum + Number(allocation.amount), 0);
        
        // Sum credit notes applied
        const totalPaidFromCreditNotes = creditNoteApplications.reduce((sum, app) => sum + Number(app.amount), 0);
        
        // Total paid = payments + credit notes
        const totalPaid = totalPaidFromPayments + totalPaidFromCreditNotes;
        const amountDue = Math.max(0, invoice.total - totalPaid);
        
        let paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
        if (totalPaid === 0) {
          paymentStatus = 'UNPAID';
        } else if (Math.abs(totalPaid - invoice.total) < 0.01 || totalPaid >= invoice.total || amountDue <= 0.01) {
          // Use small tolerance for floating point comparison
          // If amountDue is <= 0.01, consider it PAID
          paymentStatus = 'PAID';
        } else {
          paymentStatus = 'PARTIALLY_PAID';
        }
        
        // Update invoice if payment status or amounts have changed
        if (invoice.paymentStatus !== paymentStatus || 
            Math.abs(invoice.amountPaid - totalPaid) > 0.01 || 
            Math.abs(invoice.amountDue - amountDue) > 0.01) {
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              amountPaid: totalPaid,
              amountDue: amountDue,
              paymentStatus: paymentStatus,
              paidDate: paymentStatus === 'PAID' ? (invoice.paidDate || new Date()) : null
            }
          });
          
          // Update the invoice object to return correct values
          invoice.amountPaid = totalPaid;
          invoice.amountDue = amountDue;
          invoice.paymentStatus = paymentStatus;
          if (paymentStatus === 'PAID' && !invoice.paidDate) {
            invoice.paidDate = new Date();
          }
          
          console.log(`✅ Recalculated invoice ${invoice.number}: ${paymentStatus} (Total: ${invoice.total}, Paid: ${totalPaid}, Due: ${amountDue})`);
        }
      } catch (error) {
        console.error(`❌ Error recalculating invoice ${invoice.id}:`, error);
      }
    }));

    // Get all invoices for stats (without pagination)
    const allInvoices = await prisma.invoice.findMany({
      where,
      select: {
        id: true,
        total: true,
        amountDue: true,
        amountPaid: true,
        status: true,
        paymentStatus: true,
        paidDate: true,
        issueDate: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ 
      invoices, 
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
    console.error('❌ Invoices API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 POST /api/invoices - Starting request');
    
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = (session.user as any).id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    console.log('🔍 POST /api/invoices - Request body:', body);

    const {
      subject,
      accountId,
      distributorId,
      leadId,
      quotationId,
      customerType,
      billingAddressId,
      shippingAddressId,
      dueDate,
      paymentTerms,
      notes,
      taxInclusive = false,
      lines = [],
    } = body;

    // Validation
    if (!subject) {
      console.log('❌ Validation failed: Missing subject');
      return NextResponse.json(
        { error: 'Subject is required' },
        { status: 400 }
      );
    }

    if (!accountId && !distributorId && !leadId) {
      console.log('❌ Validation failed: Missing customer');
      return NextResponse.json(
        { error: 'Customer is required' },
        { status: 400 }
      );
    }

    if (!dueDate) {
      console.log('❌ Validation failed: Missing due date');
      return NextResponse.json(
        { error: 'Due date is required' },
        { status: 400 }
      );
    }

    if (lines.length === 0) {
      console.log('❌ Validation failed: No line items');
      return NextResponse.json(
        { error: 'At least one line item is required' },
        { status: 400 }
      );
    }

    // Verify customer exists
    if (accountId) {
      const account = await prisma.account.findFirst({
        where: { id: accountId },
      });
      if (!account) {
        console.log('❌ Account not found:', accountId);
        return NextResponse.json(
          { error: 'Account not found' },
          { status: 404 }
        );
      }
    }

    if (distributorId) {
      const distributor = await prisma.distributor.findFirst({
        where: { id: distributorId },
      });
      if (!distributor) {
        console.log('❌ Distributor not found:', distributorId);
        return NextResponse.json(
          { error: 'Distributor not found' },
          { status: 404 }
        );
      }
    }

    if (leadId) {
      const lead = await prisma.lead.findFirst({
        where: { id: leadId },
      });
      if (!lead) {
        console.log('❌ Lead not found:', leadId);
        return NextResponse.json(
          { error: 'Lead not found' },
          { status: 404 }
        );
      }
    }

    // Verify quotation exists if provided
    if (quotationId) {
      const quotation = await prisma.quotation.findFirst({
        where: { id: quotationId },
      });
      if (!quotation) {
        console.log('❌ Quotation not found:', quotationId);
        return NextResponse.json(
          { error: 'Quotation not found' },
          { status: 404 }
        );
      }
    }

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber();
    console.log('🔍 Generated invoice number:', invoiceNumber);

    // Fetch product details for each line and calculate totals
    let subtotal = 0;
    let totalTax = 0;
    let totalDiscount = 0;

    for (const line of lines) {
      // Fetch product details if not provided
      if (!line.productName || !line.sku || !line.description) {
        const product = await prisma.product.findUnique({
          where: { id: line.productId },
          select: { name: true, sku: true, description: true }
        });
        
        if (product) {
          line.productName = line.productName || product.name;
          line.sku = line.sku || product.sku;
          line.description = line.description || product.description;
        }
      }

      const baseAmount = line.quantity * line.unitPrice;
      const discountAmount = baseAmount * (line.discount / 100);
      const afterDiscount = baseAmount - discountAmount;
      
      // Calculate line total (after discount + taxes)
      let lineTax = 0;
      if (line.taxes && Array.isArray(line.taxes)) {
        for (const tax of line.taxes) {
          lineTax += tax.amount || 0;
        }
      }
      line.lineTotal = afterDiscount + lineTax;
      
      subtotal += afterDiscount;
      totalDiscount += discountAmount;
      totalTax += lineTax;
    }

    const total = taxInclusive ? subtotal : subtotal + totalTax;
    const amountDue = total;

    console.log('🔍 Calculated totals:', { subtotal, totalTax, totalDiscount, total, amountDue });

    // Create invoice
    const invoice = await prisma.invoice.create({
      data: {
        number: invoiceNumber,
        subject,
        quotationId: quotationId || null,
        accountId: accountId || null,
        distributorId: distributorId || null,
        leadId: leadId || null,
        billingAddressId: billingAddressId || null,
        shippingAddressId: shippingAddressId || null,
        status: 'DRAFT',
        paymentStatus: 'UNPAID',
        issueDate: new Date(),
        dueDate: new Date(dueDate),
        subtotal,
        tax: totalTax,
        discount: totalDiscount,
        total,
        amountPaid: 0,
        amountDue,
        taxInclusive,
        paymentTerms: paymentTerms || null,
        customerType: customerType || 'STANDARD',
        notes: notes || null,
        ownerId: userId,
        lines: {
          create: lines.map((line: any) => ({
            productId: line.productId,
            productName: line.productName,
            sku: line.sku,
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discount: line.discount,
            taxes: line.taxes ? JSON.stringify(line.taxes) : null,
            lineTotal: line.lineTotal,
          })),
        },
      } as any,
      include: {
        account: true,
        distributor: true,
        lead: true,
        quotation: true,
        owner: true,
        lines: {
          include: {
            product: true,
          },
        },
      },
    });

    console.log('✅ Invoice created successfully:', invoice.id);

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    console.error('❌ POST /api/invoices Error:', error);
    return NextResponse.json(
      { error: 'Failed to create invoice' },
      { status: 500 }
    );
  }
}
