import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ReturnReason, ReturnStatus } from '@prisma/client';
import { sendEmailViaSMTP, sendSmsViaDeywuro, getCompanyName } from '@/lib/payment-order-notifications';

// Helper function to generate return number
async function generateReturnNumber(): Promise<string> {
  const count = await prisma.return.count();
  const nextNumber = count + 1;
  return `RET-${nextNumber.toString().padStart(6, '0')}`;
}

// Get returns with optional filtering
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
    const accountId = searchParams.get('accountId');
    const status = searchParams.get('status');
    const reason = searchParams.get('reason');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    const where: any = {};

    if (accountId) {
      where.accountId = accountId;
    }
    if (status) {
      where.status = status;
    }
    if (reason) {
      where.reason = reason;
    }
    if (search) {
      where.OR = [
        { number: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { account: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [returns, total] = await prisma.$transaction([
      prisma.return.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          account: {
            select: { id: true, name: true, email: true, phone: true }
          },
          salesOrder: {
            select: { id: true, number: true }
          },
          creator: {
            select: { id: true, name: true }
          },
          approver: {
            select: { id: true, name: true }
          },
          lines: {
            include: {
              product: {
                select: { id: true, name: true, sku: true }
              }
            }
          }
        }
      }),
      prisma.return.count({ where })
    ]);

    return NextResponse.json({ returns, total });
  } catch (error) {
    console.error('Error fetching returns:', error);
    return NextResponse.json({ error: 'Failed to fetch returns' }, { status: 500 });
  }
}

// Create a new return
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json();
    const {
      salesOrderId,
      accountId,
      reason,
      notes,
      lines = []
    } = body;

    if (!salesOrderId || !accountId || !reason) {
      return NextResponse.json({ error: 'Sales order, account, and reason are required' }, { status: 400 });
    }

    if (!Object.values(ReturnReason).includes(reason)) {
      return NextResponse.json({ error: 'Invalid return reason' }, { status: 400 });
    }

    if (lines.length === 0) {
      return NextResponse.json({ error: 'At least one return line is required' }, { status: 400 });
    }

    // Check if a return already exists for this sales order
    const existingReturn = await prisma.return.findFirst({
      where: { salesOrderId },
      select: { id: true, number: true, status: true }
    });

    if (existingReturn) {
      return NextResponse.json({ 
        error: `A return already exists for this sales order (Return #${existingReturn.number})`,
        existingReturnId: existingReturn.id
      }, { status: 400 });
    }

    // Calculate totals
    const subtotal = lines.reduce((sum: number, line: any) => sum + line.lineTotal, 0);
    const tax = subtotal * 0.15; // 15% tax (adjust as needed)
    const total = subtotal + tax;

    // Check if user is super admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    const isSuperAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';
    const returnStatus = isSuperAdmin ? 'APPROVED' : 'PENDING';
    const approvedBy = isSuperAdmin ? userId : null;
    const approvedAt = isSuperAdmin ? new Date() : null;

    // Generate return number
    const returnNumber = await generateReturnNumber();

    // Create the return
    const returnRecord = await prisma.return.create({
      data: {
        number: returnNumber,
        salesOrderId,
        accountId,
        reason,
        status: returnStatus,
        approvedBy: approvedBy,
        approvedAt: approvedAt,
        subtotal,
        tax,
        total,
        refundAmount: 0,
        notes: notes || null,
        createdBy: userId,
        lines: {
          create: lines.map((line: any) => ({
            productId: line.productId,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            lineTotal: line.lineTotal,
            reason: line.reason || null
          }))
        }
      },
      include: {
        account: {
          select: { id: true, name: true, email: true }
        },
        salesOrder: {
          select: { id: true, number: true }
        },
        creator: {
          select: { id: true, name: true }
        },
        lines: {
          include: {
            product: {
              select: { id: true, name: true, sku: true }
            }
          }
        }
      }
    });

    // Only process inventory and credit note if status is APPROVED
    if (returnStatus === 'APPROVED') {
      try {
      // 1. Add inventory back for returned items
      for (const line of returnRecord.lines) {
        // Find or create stock item (default warehouse)
        let stockItem = await prisma.stockItem.findFirst({
          where: {
            productId: line.productId,
            warehouseId: null // Default warehouse
          }
        });

        if (!stockItem) {
          stockItem = await prisma.stockItem.create({
            data: {
              productId: line.productId,
              quantity: 0,
              reserved: 0,
              available: 0,
              averageCost: line.unitPrice,
              totalValue: 0,
              warehouseId: null
            }
          });
        }

        // Calculate new average cost
        const currentTotal = (stockItem.averageCost || 0) * stockItem.quantity;
        const returnedTotal = line.unitPrice * line.quantity;
        const newQuantity = stockItem.quantity + line.quantity;
        const newAverageCost = newQuantity > 0 ? (currentTotal + returnedTotal) / newQuantity : line.unitPrice;

        // Update stock item
        await prisma.stockItem.update({
          where: { id: stockItem.id },
          data: {
            quantity: newQuantity,
            available: newQuantity - stockItem.reserved,
            averageCost: newAverageCost,
            totalValue: newAverageCost * newQuantity
          }
        });

        // Create stock movement for return
        await prisma.stockMovement.create({
          data: {
            productId: line.productId,
            stockItemId: stockItem.id,
            type: 'RETURN',
            quantity: line.quantity,
            unitCost: line.unitPrice,
            totalCost: line.lineTotal,
            reference: `Return ${returnRecord.number}`,
            reason: `Product return - ${returnRecord.reason}`,
            notes: `Returned from ${returnRecord.salesOrder.number}`,
            userId: userId,
            warehouseId: null
          }
        });
      }

      // 2. Create credit note for the return
      const lastCreditNote = await prisma.creditNote.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { number: true }
      });

      let nextNumber = 1;
      if (lastCreditNote?.number) {
        const match = lastCreditNote.number.match(/CN-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }

      const creditNoteNumber = `CN-${nextNumber.toString().padStart(6, '0')}`;

      // Get the invoice associated with the sales order
      const salesOrder = await prisma.salesOrder.findUnique({
        where: { id: salesOrderId },
        select: { invoiceId: true }
      });

      // Only create credit note if there's an invoice
      if (salesOrder?.invoiceId) {
        const creditNote = await prisma.creditNote.create({
          data: {
            number: creditNoteNumber,
            invoiceId: salesOrder.invoiceId,
            accountId: accountId,
            amount: total,
            appliedAmount: 0,
            remainingAmount: total,
            reason: 'RETURN',
            reasonDetails: `Return ${returnRecord.number} - ${reason}`,
            notes: `Credit note for return ${returnRecord.number}. Return reason: ${reason}. ${notes || ''}`,
            status: 'PENDING',
            ownerId: userId
          }
        });
        console.log(`✅ Created credit note ${creditNoteNumber} for return ${returnRecord.number}`);
        
        // Send notifications if credit note was created
        try {
          const account = await prisma.account.findUnique({
            where: { id: accountId },
            select: { name: true, email: true, phone: true }
          });

          if (account) {
            const companyName = await getCompanyName();
            const creditNote = await prisma.creditNote.findFirst({
              where: { number: creditNoteNumber },
              select: { number: true, amount: true }
            });

            if (creditNote) {
              // Send email notification
              const emailSubject = `Return Approved - Credit Note ${creditNote.number}`;
              const emailMessage = `Dear ${account.name},

Your return request (${returnRecord.number}) has been approved and a credit note has been issued.

Credit Note Details:
- Credit Note Number: ${creditNote.number}
- Amount: GH₵${creditNote.amount.toFixed(2)}
- Return Number: ${returnRecord.number}
- Reason: ${reason.replace(/_/g, ' ')}

This credit note can be applied to future invoices or refunded to you.

Thank you for your business.

Best regards,
${companyName || 'Team'}`;

              // Send SMS notification (use GHS instead of GH₵ for SMS)
              const smsMessage = `Your return ${returnRecord.number} has been approved. Credit Note ${creditNote.number} for GHS ${creditNote.amount.toFixed(2)} has been created. ${companyName || ''}`;

              // Send notifications asynchronously
              await Promise.all([
                sendEmailViaSMTP(account.email || '', emailSubject, emailMessage),
                account.phone ? sendSmsViaDeywuro(account.phone, smsMessage) : Promise.resolve({ success: false, error: 'No phone number' })
              ]);

              console.log(`✅ Sent notifications for approved return ${returnRecord.number}`);
            }
          }
        } catch (notificationError) {
          console.error('Error sending return approval notifications:', notificationError);
          // Don't fail the return creation if notifications fail
        }
      } else {
        console.log(`⚠️ No invoice found for sales order ${salesOrderId}, skipping credit note creation`);
      }
      } catch (error) {
        console.error('Error processing return approval:', error);
        // Don't fail the return creation, just log the error
      }
    }

    // Log activity
    await prisma.activity.create({
      data: {
        entityType: 'Return',
        entityId: returnRecord.id,
        action: 'created',
        details: { returnNumber: returnRecord.number, total: returnRecord.total, reason: returnRecord.reason },
        userId: userId,
      },
    });

    return NextResponse.json(returnRecord, { status: 201 });
  } catch (error) {
    console.error('Error creating return:', error);
    return NextResponse.json({ error: 'Failed to create return' }, { status: 500 });
  }
}

