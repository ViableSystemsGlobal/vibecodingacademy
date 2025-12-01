import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CommissionService } from '@/lib/commission-service';
import { sendPaymentNotifications, sendOrderCreatedNotifications } from '@/lib/payment-order-notifications';

// Helper function to generate payment number
// Uses a retry mechanism to ensure uniqueness even under race conditions
async function generatePaymentNumber(): Promise<string> {
  let attempts = 0;
  const maxAttempts = 10;
  let baseNumber = 1;
  
  // Get the highest existing payment number as starting point
  const lastPayment = await prisma.payment.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { number: true }
  });
  
  if (lastPayment?.number) {
    // Extract number from format PAY-000001
    const match = lastPayment.number.match(/\d+$/);
    if (match) {
      baseNumber = parseInt(match[0], 10) + 1;
    }
  }
  
  while (attempts < maxAttempts) {
    const paymentNumber = `PAY-${baseNumber.toString().padStart(6, '0')}`;
    
    // Check if this number already exists (race condition protection)
    const exists = await prisma.payment.findUnique({
      where: { number: paymentNumber },
      select: { id: true }
    });
    
    if (!exists) {
      return paymentNumber;
    }
    
    // If it exists, increment and try again
    attempts++;
    baseNumber++;
  }
  
  // Fallback: use timestamp if all attempts fail
  const timestamp = Date.now();
  return `PAY-${timestamp.toString().slice(-6)}`;
}

// Helper function to generate sales order number
async function generateSalesOrderNumber(): Promise<string> {
  let attempts = 0;
  const maxAttempts = 10;
  let baseNumber = 1;

  const lastOrder = await prisma.salesOrder.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { number: true }
  });

  if (lastOrder?.number) {
    const match = lastOrder.number.match(/\d+$/);
    if (match) {
      baseNumber = parseInt(match[0], 10) + 1;
    }
  }

  while (attempts < maxAttempts) {
    const orderNumber = `SO-${baseNumber.toString().padStart(6, '0')}`;
    const exists = await prisma.salesOrder.findUnique({
      where: { number: orderNumber },
      select: { id: true }
    });
    if (!exists) return orderNumber;
    attempts++;
    baseNumber++;
  }

  return `SO-${Date.now().toString().slice(-6)}`;
}

// Helper function to create sales order from invoice
async function createSalesOrderFromInvoice(invoiceId: string, ownerId: string): Promise<any> {
  const existingOrder = await prisma.salesOrder.findFirst({
    where: { invoiceId },
    select: { id: true, number: true }
  });

  if (existingOrder) {
    console.log(`ℹ️ Sales order already exists for invoice ${invoiceId}: ${existingOrder.number}`);
    return null;
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      lines: {
        include: {
          product: {
            select: { id: true, name: true, sku: true }
          }
        }
      },
      account: {
        select: { id: true, name: true }
      }
    }
  });

  if (!invoice || !invoice.accountId) {
    console.log(`ℹ️ Invoice ${invoiceId} not found or has no accountId, skipping sales order creation`);
    return;
  }

  const orderNumber = await generateSalesOrderNumber();

  const salesOrder = await prisma.salesOrder.create({
    data: {
      number: orderNumber,
      invoiceId: invoiceId,
      accountId: invoice.accountId,
      ownerId: ownerId,
      status: 'PENDING',
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
    }
  });

  console.log(`✅ Created sales order ${salesOrder.number} from invoice ${invoice.number}`);
  return salesOrder;
}

// Helper function to update invoice payment status
async function updateInvoicePaymentStatus(invoiceId: string, userId?: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { total: true, paymentStatus: true }
  });

  if (!invoice) return;

  const previousPaymentStatus = invoice.paymentStatus;
  
  // Get both payment allocations AND credit note applications
  const [allAllocations, creditNoteApplications] = await Promise.all([
    prisma.paymentAllocation.findMany({
      where: { invoiceId },
      select: { amount: true }
    }),
    prisma.creditNoteApplication.findMany({
      where: { invoiceId },
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

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      amountPaid: totalPaid,
      amountDue: amountDue,
      paymentStatus: paymentStatus,
      paidDate: paymentStatus === 'PAID' ? new Date() : null
    }
  });

  // Auto-create commissions when invoice becomes PAID
  if (paymentStatus === 'PAID' && previousPaymentStatus !== 'PAID') {
    try {
      console.log(`🎯 Invoice ${invoiceId} is now PAID, creating commissions...`);
      const createdCommissions = await CommissionService.createCommissionsForInvoice(
        invoiceId,
        userId
      );
      if (createdCommissions.length > 0) {
        console.log(`✅ Created ${createdCommissions.length} commission(s) for invoice ${invoiceId}`);
      } else {
        console.log(`ℹ️ No commissions created for invoice ${invoiceId} (no agents found or commission disabled)`);
      }
    } catch (error) {
      console.error(`❌ Error creating commissions for invoice ${invoiceId}:`, error);
      // Don't fail the payment if commission creation fails
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const invoiceId = searchParams.get('invoiceId');
    const method = searchParams.get('method');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    // Build where clause
    const where: any = {};
    
    if (accountId) {
      where.accountId = accountId;
    }
    
    if (method) {
      where.method = method;
    }
    
    if (dateFrom || dateTo) {
      where.receivedAt = {};
      if (dateFrom) where.receivedAt.gte = new Date(dateFrom);
      if (dateTo) where.receivedAt.lte = new Date(dateTo);
    }

    // If invoiceId is specified, get payments for that specific invoice
    if (invoiceId) {
      where.allocations = {
        some: {
          invoiceId: invoiceId
        }
      };
    }

    // Get total count
    const total = await prisma.payment.count({ where });

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get paginated payments
    const payments = await prisma.payment.findMany({
      where,
      include: {
        account: {
          select: { id: true, name: true, email: true }
        },
        receiver: {
          select: { id: true, name: true, email: true }
        },
        allocations: {
          include: {
            invoice: {
              select: { id: true, number: true, total: true }
            }
          }
        }
      },
      orderBy: { receivedAt: 'desc' },
      skip,
      take: limit
    });

    // Get all payments for metrics (without pagination)
    const allPayments = await prisma.payment.findMany({
      where,
      select: {
        id: true,
        amount: true,
        receivedAt: true
      },
      orderBy: { receivedAt: 'desc' }
    });

    return NextResponse.json({ 
      payments, 
      total,
      page,
      limit,
      allPayments 
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payments' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    
    const {
      accountId,
      amount,
      method,
      reference,
      notes,
      invoiceAllocations = [] // Array of { invoiceId, amount }
    } = body;

    // Validation
    if (!accountId || !amount || !method) {
      return NextResponse.json(
        { error: 'Account ID, amount, and payment method are required' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Payment amount must be greater than 0' },
        { status: 400 }
      );
    }

    // Validate allocations don't exceed payment amount
    const totalAllocated = invoiceAllocations.reduce((sum: number, alloc: any) => sum + alloc.amount, 0);
    if (totalAllocated > amount) {
      return NextResponse.json(
        { error: 'Total allocated amount cannot exceed payment amount' },
        { status: 400 }
      );
    }

    // Generate payment number
    const paymentNumber = await generatePaymentNumber();

    // Track invoices that become paid to create orders
    const invoicesToCreateOrders: Array<{ invoiceId: string; ownerId: string }> = [];

    // Create payment with allocations in a transaction
    const payment = await prisma.$transaction(async (tx) => {
      // Create the payment
      const newPayment = await tx.payment.create({
        data: {
          number: paymentNumber,
          accountId,
          amount,
          method,
          reference: reference || null,
          notes: notes || null,
          receivedBy: userId
        },
        include: {
          account: {
            select: { id: true, name: true, email: true }
          },
          receiver: {
            select: { id: true, name: true, email: true }
          }
        }
      });

      // Create payment allocations
      if (invoiceAllocations.length > 0) {
        await tx.paymentAllocation.createMany({
          data: invoiceAllocations.map((alloc: any) => ({
            paymentId: newPayment.id,
            invoiceId: alloc.invoiceId,
            amount: alloc.amount,
            notes: alloc.notes || null
          }))
        });

        // Update invoice payment statuses directly in transaction
        for (const alloc of invoiceAllocations) {
          // Get invoice with current total
          const invoice = await tx.invoice.findUnique({
            where: { id: alloc.invoiceId },
            select: { total: true }
          });

          if (invoice) {
            // Get both payment allocations AND credit note applications
            const [allAllocations, creditNoteApplications] = await Promise.all([
              tx.paymentAllocation.findMany({
                where: { invoiceId: alloc.invoiceId },
                select: { amount: true }
              }),
              tx.creditNoteApplication.findMany({
                where: { invoiceId: alloc.invoiceId },
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

            // Get the invoice before updating to check if it's becoming paid
            const invoiceBeforeUpdate = await tx.invoice.findUnique({
              where: { id: alloc.invoiceId },
              select: { paymentStatus: true, accountId: true, ownerId: true }
            });

            const isBecomingPaid = paymentStatus === 'PAID' && invoiceBeforeUpdate?.paymentStatus !== 'PAID';

            await tx.invoice.update({
              where: { id: alloc.invoiceId },
              data: {
                amountPaid: totalPaid,
                amountDue: amountDue,
                paymentStatus: paymentStatus,
                paidDate: paymentStatus === 'PAID' ? new Date() : null
              }
            });

            // Track invoices that become paid to create orders after transaction
            if (isBecomingPaid && invoiceBeforeUpdate?.accountId && invoiceBeforeUpdate?.ownerId) {
              invoicesToCreateOrders.push({
                invoiceId: alloc.invoiceId,
                ownerId: invoiceBeforeUpdate.ownerId
              });
            }

            // Deduct stock when invoice becomes paid
            if (isBecomingPaid) {
              try {
                console.log(`📦 Deducting stock for paid invoice ${alloc.invoiceId}`);
                // Get invoice lines to deduct stock
                const invoiceLines = await tx.invoiceLine.findMany({
                  where: { invoiceId: alloc.invoiceId },
                  include: {
                    product: {
                      select: { id: true }
                    }
                  }
                });

                if (invoiceLines.length > 0) {
                  const lineItems = invoiceLines.map(line => ({
                    productId: line.productId,
                    quantity: Number(line.quantity),
                    warehouseId: undefined // Will use any warehouse with reserved stock
                  }));

                  // Deduct stock using the service
                  const { StockReservationService } = await import('@/lib/stock-reservation-service');
                  const deductResult = await StockReservationService.deductStock(
                    alloc.invoiceId,
                    lineItems,
                    userId
                  );

                  if (deductResult.success) {
                    console.log(`✅ Stock deducted successfully for invoice ${alloc.invoiceId}`);
                  } else {
                    console.error(`⚠️ Failed to deduct stock for invoice ${alloc.invoiceId}:`, deductResult.message);
                  }
                }
              } catch (stockError) {
                console.error(`❌ Error deducting stock for invoice ${alloc.invoiceId}:`, stockError);
                // Don't fail the payment if stock deduction fails
              }
            }

            // Update linked opportunity when invoice is fully paid
            if (paymentStatus === 'PAID') {
              const invoiceWithDetails = await tx.invoice.findUnique({
                where: { id: alloc.invoiceId },
                select: { 
                  quotationId: true,
                  total: true
                }
              });

              if (invoiceWithDetails?.quotationId) {
                const quotationWithOpportunity = await tx.quotation.findUnique({
                  where: { id: invoiceWithDetails.quotationId },
                  select: { opportunityId: true }
                });

                if (quotationWithOpportunity?.opportunityId) {
                  await tx.opportunity.update({
                    where: { id: quotationWithOpportunity.opportunityId },
                    data: {
                      stage: 'WON',
                      value: invoiceWithDetails.total, // Set value from invoice total
                      probability: 100,
                      wonDate: new Date(),
                      closeDate: new Date()
                    }
                  });
                  console.log(`✅ Updated opportunity to WON with value: ${invoiceWithDetails.total} and 100% probability:`, quotationWithOpportunity.opportunityId);
                }
              }
            }
          }
        }
      }

      return newPayment;
    }, {
      timeout: 10000 // Increase timeout to 10 seconds
    });

    // Send payment notifications for each invoice allocation
    if (invoiceAllocations.length > 0) {
      for (const alloc of invoiceAllocations) {
        try {
          const invoice = await prisma.invoice.findUnique({
            where: { id: alloc.invoiceId },
            include: {
              account: {
                select: { id: true, name: true, email: true, phone: true }
              }
            }
          });

          if (invoice && invoice.account) {
            await sendPaymentNotifications(invoice, payment, invoice.account);
          }
        } catch (error) {
          console.error(`❌ Error sending payment notifications for invoice ${alloc.invoiceId}:`, error);
          // Don't fail the payment if notifications fail
        }
      }
    }

    // Create sales orders for invoices that became paid
    for (const { invoiceId, ownerId } of invoicesToCreateOrders) {
      try {
        const salesOrder = await createSalesOrderFromInvoice(invoiceId, ownerId);
        
        // Send order creation notifications
        if (salesOrder) {
          try {
            // Get the account/customer for the order
            const invoiceWithAccount = await prisma.invoice.findUnique({
              where: { id: invoiceId },
              include: {
                account: {
                  select: { id: true, name: true, email: true, phone: true }
                }
              }
            });

            if (invoiceWithAccount?.account) {
              await sendOrderCreatedNotifications(salesOrder, invoiceWithAccount.account);
            }
          } catch (notificationError) {
            console.error(`❌ Error sending order creation notifications:`, notificationError);
            // Don't fail order creation if notifications fail
          }
        }
      } catch (error) {
        console.error(`❌ Error creating sales order from invoice ${invoiceId}:`, error);
        // Don't fail the payment if order creation fails
      }
    }

    // Auto-create commissions for invoices that became PAID
    if (invoiceAllocations.length > 0) {
      for (const alloc of invoiceAllocations) {
        try {
          const invoice = await prisma.invoice.findUnique({
            where: { id: alloc.invoiceId },
            select: { paymentStatus: true }
          });
          
          if (invoice?.paymentStatus === 'PAID') {
            console.log(`🎯 Invoice ${alloc.invoiceId} is PAID, checking for commissions...`);
            const createdCommissions = await CommissionService.createCommissionsForInvoice(
              alloc.invoiceId,
              userId
            );
            if (createdCommissions.length > 0) {
              console.log(`✅ Created ${createdCommissions.length} commission(s) for invoice ${alloc.invoiceId}`);
            }
          }
        } catch (error) {
          console.error(`❌ Error creating commissions for invoice ${alloc.invoiceId}:`, error);
          // Don't fail the payment if commission creation fails
        }
      }
    }

    // Log activity
    await prisma.activity.create({
      data: {
        entityType: 'Payment',
        entityId: payment.id,
        action: 'created',
        details: { 
          paymentNumber: payment.number,
          amount: payment.amount,
          method: payment.method,
          allocations: invoiceAllocations
        },
        userId: userId
      }
    });

    return NextResponse.json(payment, { status: 201 });
  } catch (error: any) {
    console.error('❌ Error creating payment:', error);
    console.error('❌ Error details:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack
    });
    
    // Return more detailed error message
    const errorMessage = error?.message || 'Failed to create payment';
    return NextResponse.json(
      { 
        error: errorMessage,
        details: error?.meta || error?.code || 'Unknown error'
      },
      { status: 500 }
    );
  }
}
