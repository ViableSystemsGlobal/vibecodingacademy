import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateInvoiceQRData, generateQRCode } from '@/lib/qrcode';
import { logAuditEvent } from '@/lib/audit-log';

// Helper function to generate sales order number
async function generateSalesOrderNumber(): Promise<string> {
  let attempts = 0;
  const maxAttempts = 10;
  let baseNumber = 1;

  // Get the highest existing sales order number
  const lastOrder = await prisma.salesOrder.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { number: true }
  });

  if (lastOrder?.number) {
    // Extract number from format SO-000001
    const match = lastOrder.number.match(/\d+$/);
    if (match) {
      baseNumber = parseInt(match[0], 10) + 1;
    }
  }

  while (attempts < maxAttempts) {
    const orderNumber = `SO-${baseNumber.toString().padStart(6, '0')}`;
    
    // Check if this number already exists
    const exists = await prisma.salesOrder.findUnique({
      where: { number: orderNumber },
      select: { id: true }
    });
    
    if (!exists) {
      return orderNumber;
    }
    
    attempts++;
    baseNumber++;
  }

  // Fallback: use timestamp
  return `SO-${Date.now().toString().slice(-6)}`;
}

// Helper function to create sales order from invoice
async function createSalesOrderFromInvoice(invoiceId: string, ownerId: string): Promise<void> {
  // Check if sales order already exists for this invoice
  const existingOrder = await prisma.salesOrder.findFirst({
    where: { invoiceId },
    select: { id: true, number: true }
  });

  if (existingOrder) {
    console.log(`ℹ️ Sales order already exists for invoice ${invoiceId}: ${existingOrder.number}`);
    return;
  }

  // Fetch invoice with lines and account
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      lines: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true
            }
          }
        }
      },
      account: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  if (!invoice) {
    throw new Error('Invoice not found');
  }

  if (!invoice.accountId) {
    console.log(`ℹ️ Invoice ${invoice.number} has no accountId, skipping sales order creation`);
    return;
  }

  // Generate sales order number
  const orderNumber = await generateSalesOrderNumber();

  // Create sales order with lines
  const salesOrder = await prisma.salesOrder.create({
    data: {
      number: orderNumber,
      invoiceId: invoiceId,
      accountId: invoice.accountId,
      ownerId: ownerId,
      status: 'PENDING',
      source: 'INTERNAL',
      subtotal: invoice.subtotal,
      tax: invoice.tax,
      discount: invoice.discount || 0,
      total: invoice.total,
      notes: `Auto-created from invoice ${invoice.number}`,
      lines: {
        create: invoice.lines.map(line => {
          // Calculate tax from taxes JSON array if available
          let taxAmount = 0;
          if (line.taxes) {
            try {
              const taxes = typeof line.taxes === 'string' ? JSON.parse(line.taxes) : line.taxes;
              if (Array.isArray(taxes)) {
                taxAmount = taxes.reduce((sum: number, tax: any) => sum + (Number(tax.amount) || 0), 0);
              }
            } catch (e) {
              console.warn('Error parsing taxes:', e);
            }
          }
          
          return {
            productId: line.productId,
            description: line.productName || line.description || '',
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discount: line.discount || 0,
            tax: taxAmount,
            lineTotal: line.lineTotal
          };
        })
      }
    },
    include: {
      lines: {
        include: {
          product: true
        }
      }
    }
  });

  console.log(`✅ Created sales order ${salesOrder.number} from invoice ${invoice.number}`);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log('🔍 GET invoice API - Starting request for ID:', id);

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = (session.user as any).id;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
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
        quotation: {
          select: { id: true, number: true, subject: true },
        },
        lines: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, price: true, images: true }
            }
          }
        },
        creditNotes: {
          select: {
            id: true,
            number: true,
            amount: true,
            appliedAmount: true,
            remainingAmount: true,
            reason: true,
            status: true,
            issueDate: true,
            appliedDate: true,
            voidedDate: true,
            applications: {
              select: {
                id: true,
                amount: true,
                appliedAt: true,
                notes: true,
              }
            }
          }
        },
        payments: {
          include: {
            payment: {
              select: {
                id: true,
                number: true,
                amount: true,
                method: true,
                reference: true,
                receivedAt: true,
                receiptUrl: true,
                notes: true,
                receiver: {
                  select: {
                    id: true,
                    name: true,
                    email: true
                  }
                }
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Recalculate payment status from actual allocations AND credit notes (fixes stale data)
    const [allAllocations, creditNoteApplications] = await Promise.all([
      prisma.paymentAllocation.findMany({
        where: { invoiceId: id },
        select: { amount: true }
      }),
      prisma.creditNoteApplication.findMany({
        where: { invoiceId: id },
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
    
    console.log(`🔍 Recalculating invoice ${invoice.number}:`, {
      invoiceTotal: invoice.total,
      paymentAllocations: allAllocations.map(a => Number(a.amount)),
      creditNoteApplications: creditNoteApplications.map(a => Number(a.amount)),
      totalPaidFromPayments,
      totalPaidFromCreditNotes,
      totalPaid,
      amountDue,
      currentStatus: invoice.paymentStatus,
      currentAmountPaid: invoice.amountPaid,
      currentAmountDue: invoice.amountDue
    });
    
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
    
    // Check if status is changing to PAID
    const isBecomingPaid = paymentStatus === 'PAID' && invoice.paymentStatus !== 'PAID';
    
    // Update invoice if payment status or amounts have changed
    if (invoice.paymentStatus !== paymentStatus || 
        Math.abs(invoice.amountPaid - totalPaid) > 0.01 || 
        Math.abs(invoice.amountDue - amountDue) > 0.01) {
      await prisma.invoice.update({
        where: { id },
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
      
      console.log(`✅ Recalculated payment status for invoice ${invoice.number}: ${paymentStatus} (Total: ${invoice.total}, Paid: ${totalPaid}, Due: ${amountDue})`);
      
      // Create sales order when invoice becomes paid (only if accountId exists)
      if (isBecomingPaid && invoice.accountId) {
        try {
          await createSalesOrderFromInvoice(invoice.id, invoice.ownerId);
        } catch (error) {
          console.error(`❌ Error creating sales order from invoice ${invoice.number}:`, error);
          // Don't fail the invoice update if order creation fails
        }
      }
    } else {
      console.log(`ℹ️ Invoice ${invoice.number} status is already correct: ${paymentStatus}`);
    }

    // Generate QR code if it doesn't exist
    if (!invoice.qrCodeData) {
      try {
        const customerName = invoice.account?.name || 
                            invoice.distributor?.businessName || 
                            (invoice.lead ? `${invoice.lead.firstName} ${invoice.lead.lastName}`.trim() : '') ||
                            'Company';
        const qrData = generateInvoiceQRData(invoice.number, {
          companyName: customerName
        });
        const qrCodeDataUrl = await generateQRCode(qrData);
        
        // Update invoice with QR code
        await prisma.invoice.update({
          where: { id },
          data: {
            qrCodeData: qrCodeDataUrl,
            qrCodeGeneratedAt: new Date()
          }
        });
        
        invoice.qrCodeData = qrCodeDataUrl;
        invoice.qrCodeGeneratedAt = new Date();
        
        console.log('✅ Generated QR code for invoice');
      } catch (qrError) {
        console.error('⚠️ Failed to generate QR code:', qrError);
        // Continue without QR code - not critical
      }
    }

    console.log('✅ Invoice found:', invoice.number);

    return NextResponse.json({ invoice });
  } catch (error) {
    console.error('❌ GET invoice API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoice' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log('🔍 PUT invoice API - Starting request for ID:', id);

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = (session.user as any).id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    console.log('🔍 PUT invoice API - Request body:', body);

    const {
      subject,
      accountId,
      distributorId,
      leadId,
      customerType,
      dueDate,
      paymentTerms,
      notes,
      taxInclusive,
      status,
      paymentStatus,
      currency,
      lines,
    } = body;

    // Check if invoice exists
    const existingInvoice = await prisma.invoice.findFirst({
      where: { id },
    });

    if (!existingInvoice) {
      console.log('❌ Invoice not found:', id);
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Calculate totals if lines are provided
    let updateData: any = {};
    
    // Only update fields that are provided
    if (subject !== undefined) updateData.subject = subject;
    if (accountId !== undefined) updateData.accountId = accountId || null;
    if (distributorId !== undefined) updateData.distributorId = distributorId || null;
    if (leadId !== undefined) updateData.leadId = leadId || null;
    if (customerType !== undefined) updateData.customerType = customerType || 'STANDARD';
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : undefined;
    if (paymentTerms !== undefined) updateData.paymentTerms = paymentTerms;
    if (notes !== undefined) updateData.notes = notes;
    if (taxInclusive !== undefined) updateData.taxInclusive = taxInclusive;
    if (status !== undefined) updateData.status = status;
    if (paymentStatus !== undefined) updateData.paymentStatus = paymentStatus;
    if (currency !== undefined) updateData.currency = currency;

    if (lines && Array.isArray(lines)) {
      let subtotal = 0;
      let totalTax = 0;
      let totalDiscount = 0;

      for (const line of lines) {
        const baseAmount = line.quantity * line.unitPrice;
        const discountAmount = baseAmount * (line.discount / 100);
        const afterDiscount = baseAmount - discountAmount;
        
        subtotal += afterDiscount;
        totalDiscount += discountAmount;

        // Calculate taxes for this line
        if (line.taxes && Array.isArray(line.taxes)) {
          for (const tax of line.taxes) {
            totalTax += tax.amount || 0;
          }
        }
      }

      const total = taxInclusive ? subtotal : subtotal + totalTax;
      const amountDue = total - (existingInvoice.amountPaid || 0);

      updateData.subtotal = subtotal;
      updateData.tax = totalTax;
      updateData.discount = totalDiscount;
      updateData.total = total;
      updateData.amountDue = amountDue;
    }

    // Update invoice
    const invoice = await prisma.invoice.update({
      where: { id },
      data: updateData,
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

    // Update lines if provided
    if (lines && Array.isArray(lines)) {
      // Delete existing lines
      await prisma.invoiceLine.deleteMany({
        where: { invoiceId: id },
      });

      // Create new lines
      await prisma.invoiceLine.createMany({
        data: lines.map((line: any) => ({
          invoiceId: id,
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
      });
    }

    console.log('✅ Invoice updated successfully:', invoice.number);

    // Log audit trail
    await logAuditEvent({
      userId,
      action: 'invoice.updated',
      resource: 'Invoice',
      resourceId: invoice.id,
      oldData: {
        subject: existingInvoice.subject,
        status: existingInvoice.status,
        paymentStatus: existingInvoice.paymentStatus,
        total: existingInvoice.total,
      },
      newData: {
        subject: subject || existingInvoice.subject,
        status: status || existingInvoice.status,
        paymentStatus: paymentStatus || existingInvoice.paymentStatus,
        total: invoice.total,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      userAgent: request.headers.get('user-agent') || null,
    });

    return NextResponse.json({ invoice });
  } catch (error) {
    console.error('❌ PUT invoice API Error:', error);
    return NextResponse.json(
      { error: 'Failed to update invoice' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log('🔍 DELETE invoice API - Starting request for ID:', id);

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = (session.user as any).id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if invoice exists
    const existingInvoice = await prisma.invoice.findFirst({
      where: { id },
    });

    if (!existingInvoice) {
      console.log('❌ Invoice not found:', id);
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Log audit trail before deletion
    await logAuditEvent({
      userId,
      action: 'invoice.deleted',
      resource: 'Invoice',
      resourceId: id,
      oldData: {
        number: existingInvoice.number,
        subject: existingInvoice.subject,
        status: existingInvoice.status,
        paymentStatus: existingInvoice.paymentStatus,
        total: existingInvoice.total,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      userAgent: request.headers.get('user-agent') || null,
    });

    // Delete invoice (cascade will handle lines)
    await prisma.invoice.delete({
      where: { id },
    });

    console.log('✅ Invoice deleted successfully:', existingInvoice.number);

    return NextResponse.json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    console.error('❌ DELETE invoice API Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete invoice' },
      { status: 500 }
    );
  }
}
