import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ReturnStatus } from '@prisma/client';
import { sendEmailViaSMTP, sendSmsViaDeywuro, getCompanyName } from '@/lib/payment-order-notifications';

// Get a single return
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
    const returnRecord = await prisma.return.findUnique({
      where: { id },
      include: {
        account: {
          select: { id: true, name: true, email: true, phone: true }
        },
        salesOrder: {
          select: { id: true, number: true }
        },
        creator: {
          select: { id: true, name: true, email: true }
        },
        approver: {
          select: { id: true, name: true, email: true }
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

    if (!returnRecord) {
      return NextResponse.json({ error: 'Return not found' }, { status: 404 });
    }

    return NextResponse.json(returnRecord);
  } catch (error) {
    console.error('Error fetching return:', error);
    return NextResponse.json({ error: 'Failed to fetch return' }, { status: 500 });
  }
}

// Update a return
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { id } = await params;
    const body = await request.json();
    const { status, refundAmount, refundMethod, notes } = body;

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    if (!Object.values(ReturnStatus).includes(status)) {
      return NextResponse.json({ error: 'Invalid return status' }, { status: 400 });
    }

    // Get the current return to check if status is changing to APPROVED
    const currentReturn = await prisma.return.findUnique({
      where: { id },
      include: {
        account: {
          select: { id: true, name: true, email: true, phone: true }
        },
        salesOrder: {
          select: { id: true, number: true, invoiceId: true }
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

    if (!currentReturn) {
      return NextResponse.json({ error: 'Return not found' }, { status: 404 });
    }

    const isBecomingApproved = status === 'APPROVED' && currentReturn.status !== 'APPROVED';

    const updateData: any = {
      status,
      notes: notes || null,
      updatedAt: new Date()
    };

    // If status is APPROVED, set approver
    if (status === 'APPROVED') {
      updateData.approvedBy = userId;
      updateData.approvedAt = new Date();
    }

    // If status is REFUNDED or COMPLETED, set refund details
    if (status === 'REFUNDED' || status === 'COMPLETED') {
      if (refundAmount) {
        updateData.refundAmount = refundAmount;
      }
      if (refundMethod) {
        updateData.refundMethod = refundMethod;
      }
      if (status === 'COMPLETED') {
        updateData.completedAt = new Date();
      }
    }

    const updatedReturn = await prisma.return.update({
      where: { id },
      data: updateData,
      include: {
        account: {
          select: { id: true, name: true, email: true, phone: true }
        },
        salesOrder: {
          select: { id: true, number: true, invoiceId: true }
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
    });

    // If status is changing to APPROVED, process inventory and create credit note
    if (isBecomingApproved) {
      try {
        // 1. Add inventory back for returned items
        for (const line of updatedReturn.lines) {
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
              reference: `Return ${updatedReturn.number}`,
              reason: `Product return - ${updatedReturn.reason}`,
              notes: `Returned from ${updatedReturn.salesOrder.number}`,
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

        // Only create credit note if there's an invoice
        if (updatedReturn.salesOrder.invoiceId) {
          const creditNote = await prisma.creditNote.create({
            data: {
              number: creditNoteNumber,
              invoiceId: updatedReturn.salesOrder.invoiceId,
              accountId: updatedReturn.accountId,
              amount: updatedReturn.total,
              appliedAmount: 0,
              remainingAmount: updatedReturn.total,
              reason: 'RETURN',
              reasonDetails: `Return ${updatedReturn.number} - ${updatedReturn.reason}`,
              notes: `Credit note for return ${updatedReturn.number}. Return reason: ${updatedReturn.reason}. ${notes || ''}`,
              status: 'PENDING',
              ownerId: userId
            }
          });
          console.log(`✅ Created credit note ${creditNoteNumber} for return ${updatedReturn.number}`);

          // Send notifications
          try {
            const companyName = await getCompanyName();
            
            // Send email notification
            const emailSubject = `Return Approved - Credit Note ${creditNote.number}`;
            const emailMessage = `Dear ${updatedReturn.account.name},

Your return request (${updatedReturn.number}) has been approved and a credit note has been issued.

Credit Note Details:
- Credit Note Number: ${creditNote.number}
- Amount: GH₵${creditNote.amount.toFixed(2)}
- Return Number: ${updatedReturn.number}
- Reason: ${updatedReturn.reason.replace(/_/g, ' ')}

This credit note can be applied to future invoices or refunded to you.

Thank you for your business.

Best regards,
${companyName || 'Team'}`;

            // Send SMS notification (use GHS instead of GH₵ for SMS)
            const smsMessage = `Your return ${updatedReturn.number} has been approved. Credit Note ${creditNote.number} for GHS ${creditNote.amount.toFixed(2)} has been created. ${companyName || ''}`;

            // Send notifications asynchronously
            await Promise.all([
              updatedReturn.account.email ? sendEmailViaSMTP(updatedReturn.account.email, emailSubject, emailMessage) : Promise.resolve({ success: false, error: 'No email' }),
              updatedReturn.account.phone ? sendSmsViaDeywuro(updatedReturn.account.phone, smsMessage) : Promise.resolve({ success: false, error: 'No phone number' })
            ]);

            console.log(`✅ Sent notifications for approved return ${updatedReturn.number}`);
          } catch (notificationError) {
            console.error('Error sending return approval notifications:', notificationError);
            // Don't fail the return update if notifications fail
          }
        } else {
          console.log(`⚠️ No invoice found for sales order ${updatedReturn.salesOrder.id}, skipping credit note creation`);
        }
      } catch (error) {
        console.error('Error processing return approval:', error);
        // Don't fail the return update if processing fails
      }
    }

    // Log activity
    await prisma.activity.create({
      data: {
        entityType: 'Return',
        entityId: updatedReturn.id,
        action: 'updated',
        details: { returnNumber: updatedReturn.number, status: updatedReturn.status },
        userId: userId,
      },
    });

    return NextResponse.json(updatedReturn);
  } catch (error) {
    console.error('Error updating return:', error);
    return NextResponse.json({ error: 'Failed to update return' }, { status: 500 });
  }
}

// Delete a return
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

    // Get return details before deleting
    const returnToDelete = await prisma.return.findUnique({
      where: { id },
      select: { number: true, status: true }
    });

    if (!returnToDelete) {
      return NextResponse.json({ error: 'Return not found' }, { status: 404 });
    }

    // Only allow deletion of pending or rejected returns
    if (returnToDelete.status !== 'PENDING' && returnToDelete.status !== 'REJECTED') {
      return NextResponse.json({ 
        error: 'Only pending or rejected returns can be deleted',
        details: `Current status: ${returnToDelete.status}`
      }, { status: 400 });
    }

    // Delete the return (lines will be deleted automatically due to cascade)
    await prisma.return.delete({
      where: { id }
    });

    // Log activity
    await prisma.activity.create({
      data: {
        entityType: 'Return',
        entityId: id,
        action: 'deleted',
        details: { returnNumber: returnToDelete.number },
        userId: session.user.id,
      },
    });

    return NextResponse.json({ message: 'Return deleted successfully' });
  } catch (error) {
    console.error('Error deleting return:', error);
    return NextResponse.json({ error: 'Failed to delete return' }, { status: 500 });
  }
}

