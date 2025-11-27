import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { OrderStatus, EcommerceOrderStatus } from '@prisma/client';
import { sendOrderStatusChangeNotifications, sendOrderCreatedNotifications } from '@/lib/payment-order-notifications';

// Get a single order
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('🔍 GET /api/orders/[id] - Starting request');
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.error('❌ Unauthorized access to order API');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    console.log('📦 Fetching order with ID:', id);
    
    // Try to find as Order first
    console.log('🔍 Searching for Order...');
    let order = await prisma.order.findUnique({
      where: { id },
      include: {
        distributor: {
          select: {
            id: true,
            businessName: true,
            email: true,
            phone: true,
            creditLimit: true,
            currentCreditUsed: true,
            creditStatus: true
          }
        },
        account: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        },
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true
          }
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                price: true
              }
            }
          }
        },
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    console.log('Order found?', !!order);
    if (order) {
      console.log('✅ Order found:', order.orderNumber);
    }

    // If not found as Order, try SalesOrder
    if (!order) {
      console.log('⚠️ Order not found, searching for SalesOrder...');
      const salesOrder = await prisma.salesOrder.findUnique({
        where: { id },
        include: {
          account: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true
            }
          },
          invoice: {
            select: {
              id: true,
              paymentStatus: true
            }
          },
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
          owner: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      if (!salesOrder) {
        console.error('❌ SalesOrder also not found for ID:', id);
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      console.log('✅ SalesOrder found:', salesOrder.number);

      // Get payment method from invoice if available
      let paymentMethod = 'credit'; // Default
      if (salesOrder.invoice?.id) {
        try {
          // Query PaymentAllocation to get the latest payment method
          const latestAllocation = await prisma.paymentAllocation.findFirst({
            where: { invoiceId: salesOrder.invoice.id },
            include: {
              payment: {
                select: {
                  method: true
                }
              }
            },
            orderBy: {
              createdAt: 'desc'
            }
          });

          if (latestAllocation?.payment?.method) {
            paymentMethod = latestAllocation.payment.method;
          }
        } catch (error) {
          console.error('Error fetching payment method:', error);
          // Keep default 'credit' if there's an error
        }
      }

      // Transform SalesOrder to Order-like format
      order = {
        id: salesOrder.id,
        orderNumber: salesOrder.number,
        totalAmount: Number(salesOrder.total),
        status: salesOrder.status,
        paymentMethod: paymentMethod,
        customerType: 'account',
        notes: salesOrder.notes,
        deliveryAddress: salesOrder.deliveryAddress,
        deliveryDate: salesOrder.deliveryDate?.toISOString(),
        createdAt: salesOrder.createdAt.toISOString(),
        updatedAt: salesOrder.updatedAt.toISOString(),
        distributor: null,
        account: salesOrder.account,
        contact: null,
        items: salesOrder.lines.map(line => ({
          id: line.id,
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
          totalPrice: Number(line.lineTotal),
          notes: line.description,
          product: {
            id: line.product.id,
            name: line.product.name,
            sku: line.product.sku,
            sellingPrice: 0,
            stockQuantity: 0
          }
        })),
        createdByUser: {
          id: salesOrder.owner.id,
          name: salesOrder.owner.name,
          email: salesOrder.owner.email || ''
        }
      } as any;
    }

    console.log('✅ Order fetched successfully:', order?.orderNumber || order?.id);
    return NextResponse.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('❌ Error fetching order:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('Error details:', { 
      errorMessage, 
      errorStack,
      errorType: error?.constructor?.name,
      errorString: String(error)
    });
    
    // Ensure we always return valid JSON
    try {
      return NextResponse.json(
        { 
          error: 'Failed to fetch order',
          details: errorMessage,
          success: false
        },
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (jsonError) {
      console.error('❌ Failed to create error response:', jsonError);
      // Fallback: create a simple text response
      return new NextResponse(
        JSON.stringify({ 
          error: 'Failed to fetch order',
          details: errorMessage,
          success: false
        }),
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }
  }
}

// Update an order
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
    const body = await request.json();
    const { 
      status, 
      paymentMethod, 
      notes, 
      deliveryAddress, 
      deliveryDate 
    } = body;

    // Validate required fields
    if (!status) {
      return NextResponse.json({ 
        error: 'Status is required' 
      }, { status: 400 });
    }

    console.log('🔄 Updating order:', id);
    console.log('📝 Update data:', { status, paymentMethod, notes, deliveryAddress, deliveryDate });

    // Try to find as Order first
    let existingOrder = await prisma.order.findUnique({
      where: { id },
      select: { id: true, status: true }
    });

    if (existingOrder) {
      // Get old status for notifications
      const oldStatus = existingOrder.status;

      // Validate status for Order
      if (!Object.values(OrderStatus).includes(status as OrderStatus)) {
        return NextResponse.json({ 
          error: 'Invalid order status' 
        }, { status: 400 });
      }

      // Only send notification if status actually changed
      const statusChanged = oldStatus !== status;

      // Update the order
      const updatedOrder = await prisma.order.update({
        where: { id },
        data: {
          status: status as OrderStatus,
          paymentMethod: paymentMethod || undefined,
          notes: notes !== undefined ? notes : undefined,
          deliveryAddress: deliveryAddress !== undefined ? deliveryAddress : undefined,
          deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
          updatedAt: new Date()
        },
        include: {
          distributor: {
            select: {
              id: true,
              businessName: true,
              email: true,
              phone: true
            }
          },
          account: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true
            }
          },
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true
            }
          },
          items: {
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
          createdByUser: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      console.log('✅ Order updated successfully:', updatedOrder.orderNumber);

      // Auto-fulfill linked resource requests when order is delivered
      if (statusChanged && status === 'DELIVERED') {
        try {
          const linkedRequests = await prisma.resourceRequest.findMany({
            where: { orderId: id, status: { not: 'FULFILLED' } }
          });
          
          for (const request of linkedRequests) {
            await prisma.resourceRequest.update({
              where: { id: request.id },
              data: {
                status: 'FULFILLED',
                fulfilledAt: new Date()
              }
            });
            
            // Create status history event
            await prisma.resourceRequestEvent.create({
              data: {
                requestId: request.id,
                userId: session.user.id,
                status: 'FULFILLED',
                notes: `Auto-fulfilled when linked order ${updatedOrder.orderNumber} was delivered`
              }
            });
            
            console.log(`✅ Auto-fulfilled resource request ${request.id} from order delivery`);
          }
        } catch (fulfillError) {
          console.error('Error auto-fulfilling resource requests:', fulfillError);
          // Don't fail the order update if fulfillment fails
        }
      }

      // Send status change notifications if status changed
      if (statusChanged) {
        try {
          const customer = updatedOrder.account || updatedOrder.distributor || updatedOrder.contact;
          if (customer) {
            // Check if this order is related to an ecommerce order (via invoice if available)
            let isEcommerce = false;
            if (updatedOrder.invoiceId) {
              try {
                const invoice = await prisma.invoice.findUnique({
                  where: { id: updatedOrder.invoiceId },
                  select: { number: true }
                });
                if (invoice) {
                  const ecommerceOrder = await prisma.ecommerceOrder.findFirst({
                    where: { orderNumber: invoice.number },
                    select: { id: true }
                  });
                  isEcommerce = !!ecommerceOrder;
                }
              } catch (e) {
                // Ignore errors checking for ecommerce order
              }
            }

            await sendOrderStatusChangeNotifications(
              updatedOrder,
              oldStatus,
              status,
              customer,
              isEcommerce
            );
          }
        } catch (notificationError) {
          console.error('❌ Error sending order status change notifications:', notificationError);
          // Don't fail the order update if notifications fail
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Order updated successfully',
        data: updatedOrder
      });
    } else {
      // Try to update as SalesOrder
      const existingSalesOrder = await prisma.salesOrder.findUnique({
        where: { id },
        select: { id: true, status: true, invoiceId: true }
      });

      if (!existingSalesOrder) {
        return NextResponse.json({ 
          error: 'Order not found' 
        }, { status: 404 });
      }

      // Get old status for notifications
      const oldStatus = existingSalesOrder.status;
      const invoiceId = existingSalesOrder.invoiceId;

      // Validate status for SalesOrder
      const validSalesOrderStatuses = ['PENDING', 'CONFIRMED', 'PROCESSING', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED'];
      if (!validSalesOrderStatuses.includes(status)) {
        return NextResponse.json({ 
          error: 'Invalid sales order status' 
        }, { status: 400 });
      }

      // Only send notification if status actually changed
      const statusChanged = oldStatus !== status;

      // Update the sales order
      const updatedSalesOrder = await prisma.salesOrder.update({
        where: { id },
        data: {
          status: status as any,
          notes: notes !== undefined ? notes : undefined,
          deliveryAddress: deliveryAddress !== undefined ? deliveryAddress : undefined,
          deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
          updatedAt: new Date()
        },
        include: {
          account: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true
            }
          },
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
          owner: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      console.log('✅ SalesOrder updated successfully:', updatedSalesOrder.number);

      // Sync status to Ecommerce Order if this Sales Order came from ecommerce
      if (statusChanged && invoiceId) {
        try {
          // Get the invoice to find the ecommerce order (ecommerce order orderNumber = invoice number)
          const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            select: { number: true }
          });

          if (invoice) {
            // Find the ecommerce order by orderNumber (which equals invoice.number)
            const ecommerceOrder = await prisma.ecommerceOrder.findUnique({
              where: { orderNumber: invoice.number }
            });

            if (ecommerceOrder) {
              // Map Sales Order status to Ecommerce Order status
              let ecommerceStatus: EcommerceOrderStatus;
              switch (status.toUpperCase()) {
                case 'DELIVERED':
                  ecommerceStatus = EcommerceOrderStatus.DELIVERED;
                  break;
                case 'COMPLETED':
                  ecommerceStatus = EcommerceOrderStatus.DELIVERED; // Completed = Delivered for ecommerce
                  break;
                case 'SHIPPED':
                  ecommerceStatus = EcommerceOrderStatus.SHIPPED;
                  break;
                case 'READY_TO_SHIP':
                  ecommerceStatus = EcommerceOrderStatus.SHIPPED;
                  break;
                case 'PROCESSING':
                  ecommerceStatus = EcommerceOrderStatus.PROCESSING;
                  break;
                case 'CONFIRMED':
                  ecommerceStatus = EcommerceOrderStatus.CONFIRMED;
                  break;
                case 'CANCELLED':
                  ecommerceStatus = EcommerceOrderStatus.CANCELLED;
                  break;
                case 'PENDING':
                default:
                  ecommerceStatus = EcommerceOrderStatus.PENDING;
                  break;
              }

              // Update ecommerce order status and delivery date if delivered
              await prisma.ecommerceOrder.update({
                where: { id: ecommerceOrder.id },
                data: {
                  status: ecommerceStatus,
                  ...(status.toUpperCase() === 'DELIVERED' || status.toUpperCase() === 'COMPLETED' 
                    ? { 
                        deliveredAt: new Date(),
                        // Also update deliveredAt if it's not already set
                      }
                    : {})
                }
              });

              console.log(`✅ Synced Sales Order status "${status}" to Ecommerce Order ${ecommerceOrder.orderNumber} as "${ecommerceStatus}"`);
            }
          }
        } catch (syncError) {
          console.error('❌ Error syncing status to Ecommerce Order:', syncError);
          // Don't fail the sales order update if sync fails
        }
      }

      // Send status change notifications if status changed
      if (statusChanged && updatedSalesOrder.account) {
        try {
          // Check if this is an ecommerce order (has invoice with ecommerce order)
          let isEcommerce = false;
          if (invoiceId) {
            try {
              const invoice = await prisma.invoice.findUnique({
                where: { id: invoiceId },
                select: { number: true }
              });
              if (invoice) {
                const ecommerceOrder = await prisma.ecommerceOrder.findFirst({
                  where: { orderNumber: invoice.number },
                  select: { id: true }
                });
                isEcommerce = !!ecommerceOrder;
              }
            } catch (e) {
              // Ignore errors checking for ecommerce order
            }
          }

          await sendOrderStatusChangeNotifications(
            updatedSalesOrder,
            oldStatus,
            status,
            updatedSalesOrder.account,
            isEcommerce
          );
        } catch (notificationError) {
          console.error('❌ Error sending order status change notifications:', notificationError);
          // Don't fail the order update if notifications fail
        }
      }

      // Transform to Order-like format for response
      const transformedOrder = {
        id: updatedSalesOrder.id,
        orderNumber: updatedSalesOrder.number,
        totalAmount: Number(updatedSalesOrder.total),
        status: updatedSalesOrder.status,
        paymentMethod: paymentMethod || 'credit',
        customerType: 'account',
        notes: updatedSalesOrder.notes,
        deliveryAddress: updatedSalesOrder.deliveryAddress,
        deliveryDate: updatedSalesOrder.deliveryDate?.toISOString(),
        createdAt: updatedSalesOrder.createdAt.toISOString(),
        updatedAt: updatedSalesOrder.updatedAt.toISOString(),
        distributor: null,
        account: updatedSalesOrder.account,
        contact: null,
        items: updatedSalesOrder.lines.map(line => ({
          id: line.id,
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
          totalPrice: Number(line.lineTotal),
          notes: line.description,
          product: {
            id: line.product.id,
            name: line.product.name,
            sku: line.product.sku,
            price: 0,
            stockQuantity: 0
          }
        })),
        createdByUser: {
          id: updatedSalesOrder.owner.id,
          name: updatedSalesOrder.owner.name,
          email: updatedSalesOrder.owner.email || ''
        }
      };

      return NextResponse.json({
        success: true,
        message: 'Order updated successfully',
        data: transformedOrder
      });
    }

  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update order',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}

// Delete an order
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

    console.log('🗑️ Deleting order:', id);

    // First, get the order details for logging and credit reversal
    const orderToDelete = await prisma.order.findUnique({
      where: { id },
      include: {
        distributor: {
          select: {
            id: true,
            businessName: true,
            currentCreditUsed: true
          }
        }
      }
    });

    if (!orderToDelete) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Check if order can be deleted (only pending orders should be deletable)
    if (orderToDelete.status !== 'PENDING') {
      return NextResponse.json({ 
        error: 'Only pending orders can be deleted',
        details: `Current status: ${orderToDelete.status}`
      }, { status: 400 });
    }

    // Delete the order (items will be deleted automatically due to cascade)
    await prisma.order.delete({
      where: { id }
    });

    // If payment method was credit, reverse the credit usage
    if (orderToDelete.paymentMethod === 'credit') {
      console.log('💳 Reversing credit usage...');
      
      const distributor = await prisma.distributor.findUnique({
        where: { id: orderToDelete.distributorId }
      });

      if (distributor) {
        const currentUsed = Number(distributor.currentCreditUsed || 0);
        const orderAmount = Number(orderToDelete.totalAmount);
        const newCreditUsed = Math.max(0, currentUsed - orderAmount);
        
        await prisma.distributor.update({
          where: { id: orderToDelete.distributorId },
          data: {
            currentCreditUsed: newCreditUsed,
            updatedAt: new Date()
          }
        });

        // Log credit reversal in credit history
        await prisma.distributorCreditHistory.create({
          data: {
            distributorId: orderToDelete.distributorId,
            action: 'CREDIT_REVERSED',
            previousLimit: distributor.creditLimit || 0,
            newLimit: distributor.creditLimit || 0,
            previousUsed: distributor.currentCreditUsed || 0,
            newUsed: newCreditUsed,
            amount: -orderToDelete.totalAmount, // Negative amount for reversal
            reason: `Order deleted: ${orderToDelete.orderNumber}`,
            notes: `Order total: GHS ${orderToDelete.totalAmount.toLocaleString()}`,
            performedBy: session.user.id,
            performedAt: new Date()
          }
        });

        console.log('✅ Credit usage reversed');
      }
    }

    console.log('✅ Order deleted successfully:', orderToDelete.orderNumber);

    return NextResponse.json({
      success: true,
      message: 'Order deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting order:', error);
    return NextResponse.json(
      { 
        error: 'Failed to delete order',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}
