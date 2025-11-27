import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateQuoteQRData, generateQRCode } from '@/lib/qrcode';
import { parseTableQuery, buildWhereClause, buildOrderBy } from '@/lib/query-builder';
import { logAuditEvent } from '@/lib/audit-log';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Quotations GET API - Starting request');
    
    const session = await getServerSession(authOptions);
    console.log('🔍 Session:', session ? 'Found' : 'Not found');
    
    if (!session?.user) {
      console.log('❌ No session or user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    console.log('🔍 User ID:', userId);
    
    if (!userId) {
      console.log('❌ No user ID');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user role for Super Admin checks
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });
    
    console.log('🔍 User role:', user?.role);
    const isSuperAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

    const params = parseTableQuery(request);

    // Custom filter handler
    const customFilters = (filters: Record<string, string | string[] | null>) => {
      const where: any = {};
      if (filters.status && filters.status !== 'ALL') {
        where.status = filters.status;
      }
      return where;
    };

    const where = buildWhereClause(params, {
      searchFields: ['number', 'subject'],
      customFilters,
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

    // Super Admins can see all quotations, others only their own
    if (!isSuperAdmin) {
      where.ownerId = userId;
    }

    const orderBy = buildOrderBy(params.sortBy, params.sortOrder);
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;
    
    console.log('🔍 Query parameters:', { where, skip, limit, page });
    
    const [quotations, total] = await Promise.all([
      prisma.quotation.findMany({
        where,
        skip,
        take: limit,
        orderBy: orderBy,
        select: {
          id: true,
          number: true,
          subject: true,
          status: true,
          total: true,
          subtotal: true,
          tax: true,
          taxInclusive: true,
          currency: true,
          notes: true,
          validUntil: true,
          qrCodeData: true,
          qrCodeGeneratedAt: true,
          createdAt: true,
          updatedAt: true,
          owner: {
            select: { id: true, name: true, email: true },
          },
          account: {
            select: { id: true, name: true, type: true, email: true, phone: true },
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
          _count: {
            select: { lines: true, proformas: true },
          },
        },
      }),
      prisma.quotation.count({ where })
    ]);
    
    console.log('✅ Found quotations:', quotations.length, 'Total:', total);

    return NextResponse.json({ 
      quotations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      sort: params.sortBy
        ? {
            field: params.sortBy,
            order: params.sortOrder || 'desc',
          }
        : undefined,
    });
  } catch (error: any) {
    console.error('❌ Error fetching quotations:', error);
    console.error('❌ Error message:', error?.message);
    console.error('❌ Error stack:', error?.stack);
    return NextResponse.json(
      { error: 'Failed to fetch quotations', details: error?.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Quotations API - Starting POST request');
    
    const session = await getServerSession(authOptions);
    console.log('🔍 Session:', session ? 'Found' : 'Not found');
    
    if (!session?.user) {
      console.log('❌ No session or user found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    console.log('🔍 User ID:', userId);
    
    if (!userId) {
      console.log('❌ No user ID found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    console.log('🔍 Request body:', JSON.stringify(body, null, 2));
    
    const {
      subject,
      validUntil,
      notes,
      accountId,
      distributorId,
      leadId,
      customerType,
      billingAddressId,
      billingAddressSnapshot,
      shippingAddressId,
      shippingAddressSnapshot,
      lines = [],
      taxInclusive = false,
      currency,
    } = body;

    console.log('🔍 Parsed data:', { subject, accountId, distributorId, customerType, linesCount: lines.length, validUntil });

    if (!subject || (!accountId && !distributorId && !leadId)) {
      console.log('❌ Validation failed: Missing subject or customer');
      return NextResponse.json(
        { error: 'Subject and customer are required' },
        { status: 400 }
      );
    }

    // Verify customer exists (either account or distributor)
    // Get user role first for Super Admin checks
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });
    
    const isSuperAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';
    
    if (accountId) {
      // Super Admins and Admins can access any account, others only their own
      const accountWhere: any = { id: accountId };
      if (!isSuperAdmin) {
        accountWhere.ownerId = userId;
      }
      
      const account = await prisma.account.findFirst({
        where: accountWhere,
      });

      if (!account) {
        console.log('❌ Account not found or access denied:', accountId);
        return NextResponse.json(
          { error: 'Account not found or access denied' },
          { status: 404 }
        );
      }
    }

    if (distributorId) {
      const distributor = await prisma.distributor.findUnique({
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
      // Super Admins and Admins can access any lead, others only their own
      const leadWhere: any = { id: leadId };
      if (!isSuperAdmin) {
        leadWhere.ownerId = userId;
      }
      
      const lead = await prisma.lead.findFirst({
        where: leadWhere,
      });

      if (!lead) {
        console.log('❌ Lead not found:', leadId);
        return NextResponse.json(
          { error: 'Lead not found' },
          { status: 404 }
        );
      }
    }

    // Generate unique quotation number
    let number: string;
    let attempts = 0;
    const maxAttempts = 10;
    
    do {
      const count = await prisma.quotation.count();
      number = `QT-${String(count + 1 + attempts).padStart(6, '0')}`;
      
      // Check if this number already exists
      const existing = await prisma.quotation.findUnique({
        where: { number }
      });
      
      if (!existing) break;
      
      attempts++;
    } while (attempts < maxAttempts);
    
    if (attempts >= maxAttempts) {
      // Fallback to timestamp-based number
      number = `QT-${Date.now().toString().slice(-6)}`;
    }

    // Calculate totals with flexible taxes
    let subtotal = 0;
    let totalTax = 0;
    const taxesByType: { [key: string]: number } = {};
    
    const processedLines = lines.map((line: any) => {
      const lineSubtotal = (line.quantity || 0) * (line.unitPrice || 0);
      const discountAmount = lineSubtotal * ((line.discount || 0) / 100);
      const afterDiscount = lineSubtotal - discountAmount;
      
      // Calculate taxes for this line
      let lineTax = 0;
      if (line.taxes && Array.isArray(line.taxes)) {
        line.taxes.forEach((tax: any) => {
          const taxAmount = afterDiscount * (tax.rate / 100);
          lineTax += taxAmount;
          taxesByType[tax.name] = (taxesByType[tax.name] || 0) + taxAmount;
        });
      }
      
      const lineTotal = afterDiscount + lineTax;
      subtotal += afterDiscount;
      totalTax += lineTax;
      
      return {
        ...line,
        lineTotal,
      };
    });

    const quotation = await prisma.quotation.create({
      data: {
        number,
        subject,
        validUntil: validUntil && validUntil.trim() && validUntil !== '' ? (() => {
          // Parse date string (YYYY-MM-DD) and create date at midnight in local timezone
          const dateStr = validUntil.trim();
          // Validate date format (YYYY-MM-DD)
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            console.warn('📅 Invalid date format for validUntil:', dateStr);
            return null;
          }
          const [year, month, day] = dateStr.split('-').map(Number);
          // Validate date values
          if (isNaN(year) || isNaN(month) || isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31) {
            console.warn('📅 Invalid date values for validUntil:', { year, month, day });
            return null;
          }
          const date = new Date(year, month - 1, day);
          // Validate the date is valid
          if (isNaN(date.getTime())) {
            console.warn('📅 Invalid date object created from validUntil:', dateStr);
            return null;
          }
          console.log('📅 Parsing validUntil:', { dateStr, parsedDate: date.toISOString() });
          return date;
        })() : null,
        notes,
        currency: currency || 'GHS',
        subtotal,
        tax: totalTax,
        total: subtotal + totalTax,
        taxInclusive,
        accountId: accountId && accountId !== 'test123' ? accountId : null,
        distributorId: distributorId || null,
        leadId: leadId || null,
        customerType: customerType || 'STANDARD',
        billingAddressId: billingAddressId || null,
        billingAddressSnapshot: billingAddressSnapshot || null,
        shippingAddressId: shippingAddressId || null,
        shippingAddressSnapshot: shippingAddressSnapshot || null,
        ownerId: userId,
        lines: {
          create: processedLines.map((line: any) => ({
            productId: line.productId || 'dummy-product-id',
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discount: line.discount || 0,
            lineTotal: line.lineTotal,
          })),
        },
      } as any,
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
        account: {
          select: { id: true, name: true, type: true, email: true },
        },
        distributor: {
          select: { id: true, businessName: true, email: true },
        },
        lines: {
          include: {
            product: {
              select: { id: true, name: true, sku: true },
            },
          },
        },
      },
    });

    // Create opportunity if this is for an account (with or without lead)
    if (accountId) {
      // Check if opportunity already exists for this account and quotation
      let opportunity = await prisma.opportunity.findFirst({
        where: {
          accountId: accountId,
          quotations: {
            some: {
              id: quotation.id
            }
          }
        }
      });

      // If no opportunity exists, create one
      if (!opportunity) {
        // Get account details for opportunity name
        const account = await prisma.account.findUnique({
          where: { id: accountId },
          select: { name: true }
        });

        let opportunityName = account?.name || subject || 'Untitled Opportunity';

        // If there's a lead, use lead details for name and update lead status
        if (leadId) {
          const lead = await prisma.lead.findUnique({
            where: { id: leadId },
            select: { firstName: true, lastName: true, company: true, assignedTo: true },
          });

          opportunityName = lead?.company || `${lead?.firstName} ${lead?.lastName}` || opportunityName;

          // Update lead status to CONVERTED_TO_OPPORTUNITY, preserving assignedTo
          await prisma.lead.update({
            where: { id: leadId },
            data: {
              status: 'CONVERTED_TO_OPPORTUNITY',
              dealValue: subtotal + totalTax,
              probability: 25, // Default probability when quote is sent
              assignedTo: lead?.assignedTo || undefined, // Preserve assignedTo field
            },
          });
        }

        opportunity = await prisma.opportunity.create({
          data: {
            name: opportunityName,
            stage: 'QUOTE_SENT',
            value: subtotal + totalTax,
            probability: 25,
            accountId: accountId,
            leadId: leadId || null,
            ownerId: userId,
          },
        });

        console.log('✅ Created opportunity from quotation:', opportunity.id);
      }

      // Link the quotation to the opportunity (if not already linked)
      if (quotation.id && (!(quotation as any).opportunityId || (quotation as any).opportunityId !== opportunity.id)) {
        await prisma.quotation.update({
          where: { id: quotation.id },
          data: { opportunityId: opportunity.id },
        });
      }
    } else if (leadId) {
      // If only leadId (no account), just update lead status and values
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          status: 'QUOTE_SENT',
          dealValue: subtotal + totalTax,
          probability: 25,
        },
      });
    }

    // Generate QR code for the quotation
    try {
      const qrData = generateQuoteQRData(number, {
        companyName: quotation.account?.name || quotation.distributor?.businessName || 'Company'
      });
      const qrCodeDataUrl = await generateQRCode(qrData);
      
      // Update quotation with QR code
      await prisma.quotation.update({
        where: { id: quotation.id },
        data: {
          qrCodeData: qrCodeDataUrl,
          qrCodeGeneratedAt: new Date()
        } as any
      });
      
      console.log('✅ Generated QR code for quotation:', number);
    } catch (qrError) {
      console.error('⚠️ Failed to generate QR code:', qrError);
      // Continue without QR code - not critical
    }

    // Log activity
    await prisma.activity.create({
      data: {
        entityType: 'Quotation',
        entityId: quotation.id,
        action: 'created',
        details: { quotation: { number, subject, total: subtotal + totalTax, accountId } },
        userId: userId,
      },
    });

    // Log audit trail
    await logAuditEvent({
      userId,
      action: 'quotation.created',
      resource: 'Quotation',
      resourceId: quotation.id,
      newData: { number, subject, total: subtotal + totalTax, status: 'DRAFT', accountId },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      userAgent: request.headers.get('user-agent') || null,
    });

    // Fetch the updated quotation with QR code
    const updatedQuotation = await prisma.quotation.findUnique({
      where: { id: quotation.id },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
        account: {
          select: { id: true, name: true, type: true, email: true },
        },
        lines: {
          include: {
            product: {
              select: { id: true, name: true, sku: true },
            },
          },
        },
      },
    });

    return NextResponse.json(updatedQuotation, { status: 201 });
  } catch (error) {
    console.error('❌ Error creating quotation:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { error: 'Failed to create quotation', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
