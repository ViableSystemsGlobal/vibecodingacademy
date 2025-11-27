import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendOrderCreatedNotifications } from '@/lib/payment-order-notifications';
import { parseTableQuery, buildWhereClause, buildOrderBy } from '@/lib/query-builder';

// Helper function to get setting value from database
async function getSettingValue(key: string, defaultValue: string = ''): Promise<string> {
  try {
    const setting = await prisma.systemSettings.findUnique({
      where: { key },
      select: { value: true }
    });
    return setting?.value || defaultValue;
  } catch (error) {
    console.error(`Error fetching setting ${key}:`, error);
    return defaultValue;
  }
}

// Check if distributor has sufficient credit for order
async function checkDistributorCredit(distributorId: string, orderAmount: number): Promise<{
  hasCredit: boolean;
  availableCredit: number;
  creditLimit: number;
  currentUsed: number;
  message: string;
}> {
  try {
    const distributor = await prisma.distributor.findUnique({
      where: { id: distributorId },
      select: {
        id: true,
        businessName: true,
        creditLimit: true,
        currentCreditUsed: true,
        creditStatus: true
      }
    });

    if (!distributor) {
      return {
        hasCredit: false,
        availableCredit: 0,
        creditLimit: 0,
        currentUsed: 0,
        message: 'Distributor not found'
      };
    }

    const creditLimit = parseFloat(distributor.creditLimit?.toString() || '0');
    const currentUsed = parseFloat(distributor.currentCreditUsed?.toString() || '0');
    const availableCredit = creditLimit - currentUsed;

    // Check if credit is suspended
    if (distributor.creditStatus === 'SUSPENDED') {
      return {
        hasCredit: false,
        availableCredit,
        creditLimit,
        currentUsed,
        message: 'Credit account is suspended'
      };
    }

    // Check if order amount exceeds available credit
    if (orderAmount > availableCredit) {
      return {
        hasCredit: false,
        availableCredit,
        creditLimit,
        currentUsed,
        message: `Order amount (GHS ${orderAmount.toLocaleString()}) exceeds available credit (GHS ${availableCredit.toLocaleString()})`
      };
    }

    return {
      hasCredit: true,
      availableCredit,
      creditLimit,
      currentUsed,
      message: 'Credit check passed'
    };

  } catch (error) {
    console.error('Error checking distributor credit:', error);
    return {
      hasCredit: false,
      availableCredit: 0,
      creditLimit: 0,
      currentUsed: 0,
      message: 'Error checking credit status'
    };
  }
}

// Create a new order
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      customerType = 'distributor',
      customerId, // Can be distributorId, accountId, or contactId
      distributorId, // Legacy support
      accountId,
      contactId,
      items, 
      totalAmount, 
      paymentMethod = 'credit',
      notes = '',
      deliveryAddress = '',
      deliveryDate = null
    } = body;

    // Determine the actual customer ID and type
    const actualCustomerType = customerType || 'distributor';
    const actualCustomerId = customerId || distributorId;
    const actualDistributorId = actualCustomerType === 'distributor' ? actualCustomerId : (distributorId || actualCustomerId);
    const actualAccountId = actualCustomerType === 'account' ? actualCustomerId : accountId;
    const actualContactId = actualCustomerType === 'contact' ? actualCustomerId : contactId;

    // Validate required fields
    if (!actualCustomerId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ 
        error: 'Customer ID and order items are required' 
      }, { status: 400 });
    }

    if (!totalAmount || totalAmount <= 0) {
      return NextResponse.json({ 
        error: 'Total amount must be greater than 0' 
      }, { status: 400 });
    }

    console.log('🚀 Creating order for customer:', { type: actualCustomerType, id: actualCustomerId });
    console.log('📦 Order details:', { totalAmount, items: items.length, paymentMethod });

    // Check if credit checking is enabled (only for distributors)
    const creditCheckingEnabled = await getSettingValue('CREDIT_CHECKING_ENABLED', 'true');
    
    if (creditCheckingEnabled === 'true' && paymentMethod === 'credit' && actualCustomerType === 'distributor') {
      console.log('🔍 Running credit check...');
      
      // Perform credit check
      const creditCheck = await checkDistributorCredit(actualDistributorId, totalAmount);
      
      console.log('💳 Credit check result:', creditCheck);

      if (!creditCheck.hasCredit) {
        return NextResponse.json({
          error: 'Credit check failed',
          details: creditCheck.message,
          creditInfo: {
            availableCredit: creditCheck.availableCredit,
            creditLimit: creditCheck.creditLimit,
            currentUsed: creditCheck.currentUsed
          }
        }, { status: 400 });
      }

      console.log('✅ Credit check passed');
    }

    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    // Create the order
    const order = await prisma.order.create({
      data: {
        orderNumber,
        distributorId: actualDistributorId,
        customerType: actualCustomerType,
        accountId: actualAccountId,
        contactId: actualContactId,
        totalAmount,
        status: 'PENDING',
        paymentMethod,
        notes,
        deliveryAddress,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        createdBy: session.user.id,
        items: {
          create: items.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            notes: item.notes || ''
          }))
        }
      },
      include: {
        distributor: {
          select: {
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
                name: true,
                sku: true
              }
            }
          }
        }
      }
    });

    // If payment method is credit and customer is distributor, update credit usage
    if (paymentMethod === 'credit' && actualCustomerType === 'distributor') {
      console.log('💳 Updating distributor credit usage...');
      
      const distributor = await prisma.distributor.findUnique({
        where: { id: actualDistributorId }
      });

      if (distributor) {
        const newCreditUsed = (distributor.currentCreditUsed || 0) + totalAmount;
        
        await prisma.distributor.update({
          where: { id: actualDistributorId },
          data: {
            currentCreditUsed: newCreditUsed,
            updatedAt: new Date()
          }
        });

        // Log credit usage in credit history
        await prisma.distributorCreditHistory.create({
          data: {
            distributorId: actualDistributorId,
            action: 'CREDIT_USED',
            previousLimit: distributor.creditLimit || 0,
            newLimit: distributor.creditLimit || 0,
            previousUsed: distributor.currentCreditUsed || 0,
            newUsed: newCreditUsed,
            amount: totalAmount,
            reason: `Order created: ${orderNumber}`,
            notes: `Order total: GHS ${totalAmount.toLocaleString()}`,
            performedBy: session.user.id,
            performedAt: new Date()
          }
        });

        console.log('✅ Credit usage updated');
      }
    }

    console.log('✅ Order created successfully:', orderNumber);

    // Send order creation notifications
    try {
      const customer = order.account || order.distributor || order.contact;
      if (customer) {
        await sendOrderCreatedNotifications(order, customer);
      }
    } catch (notificationError) {
      console.error('❌ Error sending order creation notifications:', notificationError);
      // Don't fail the order creation if notifications fail
    }

    return NextResponse.json({
      success: true,
      message: 'Order created successfully',
      data: {
        id: order.id,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        status: order.status,
        paymentMethod: order.paymentMethod,
        distributor: order.distributor,
        items: order.items,
        createdAt: order.createdAt
      }
    });

  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create order',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}

// Get orders with optional filtering
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = parseTableQuery(request);

    // Custom filter handler
    const customFilters = (filters: Record<string, string | string[] | null>) => {
      const where: any = {};
      if (filters.distributorId) where.distributorId = filters.distributorId;
      if (filters.status) where.status = filters.status;
      return where;
    };

    // Build where clause for Order model
    const where = buildWhereClause(params, {
      searchFields: ['orderNumber'],
      customFilters,
    });

    // Add customer name search to Order where clause if search term exists
    if (params.search) {
      // Search in customer-related fields (distributor, account, contact)
      const searchTerm = params.search.toLowerCase();
      where.OR = [
        ...(where.OR || []), // Preserve existing OR conditions from buildWhereClause
        {
          distributor: {
            businessName: { contains: params.search, mode: 'insensitive' }
          }
        },
        {
          account: {
            name: { contains: params.search, mode: 'insensitive' }
          }
        },
        {
          contact: {
            OR: [
              { firstName: { contains: params.search, mode: 'insensitive' } },
              { lastName: { contains: params.search, mode: 'insensitive' } }
            ]
          }
        }
      ];
    }

    // Build where clause for SalesOrder
    const salesOrderWhere: any = {};
    if (params.filters?.accountId) salesOrderWhere.accountId = params.filters.accountId;
    if (params.filters?.status) salesOrderWhere.status = params.filters.status;
    
    // Add search to salesOrderWhere if search term exists
    if (params.search) {
      salesOrderWhere.OR = [
        { number: { contains: params.search, mode: 'insensitive' } },
        {
          account: {
            name: { contains: params.search, mode: 'insensitive' }
          }
        }
      ];
    }

    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;
    const orderBy = buildOrderBy(params.sortBy, params.sortOrder) || { createdAt: 'desc' };

    // Get both Order and SalesOrder models
    const [ordersResult, salesOrdersResult, ordersCount, salesOrdersCount] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          distributor: {
            select: {
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
                  name: true,
                  sku: true
                }
              }
            }
          }
        },
        orderBy: orderBy
      }),
      prisma.salesOrder.findMany({
        where: salesOrderWhere,
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
              paymentStatus: true,
              amountPaid: true,
              amountDue: true,
              payments: {
                include: {
                  payment: {
                    select: {
                      method: true
                    }
                  }
                },
                orderBy: {
                  createdAt: 'desc'
                },
                take: 1
              }
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
              name: true
            }
          }
        },
        orderBy: orderBy
      }),
      prisma.order.count({ where }),
      prisma.salesOrder.count({ where: salesOrderWhere })
    ]);

    // Combine and transform orders - convert SalesOrder to Order-like format
    const allOrders = [
      ...ordersResult.map((order: any) => ({
        ...order,
        orderNumber: order.orderNumber,
        type: 'order' as const
      })),
      ...salesOrdersResult.map((salesOrder: any) => {
        // Get payment method and status from invoice if available
        let paymentMethod = null;
        let paymentStatus = null;
        let amountPaid = 0;
        let amountDue = 0;
        
        if (salesOrder.invoice) {
          paymentStatus = salesOrder.invoice.paymentStatus;
          amountPaid = Number(salesOrder.invoice.amountPaid || 0);
          const invoiceTotal = Number(salesOrder.invoice.total || salesOrder.total || 0);
          amountDue = Number(salesOrder.invoice.amountDue ?? (invoiceTotal - amountPaid));
          
          // If paymentStatus is not set or is PENDING, calculate it from amounts
          if (!paymentStatus || paymentStatus === 'PENDING') {
            if (amountPaid >= invoiceTotal) {
              paymentStatus = 'PAID';
              amountDue = 0;
            } else if (amountPaid > 0) {
              paymentStatus = 'PARTIALLY_PAID';
              amountDue = invoiceTotal - amountPaid;
            } else {
              paymentStatus = 'UNPAID';
              amountDue = invoiceTotal;
            }
          }
          
          if (salesOrder.invoice.payments && salesOrder.invoice.payments.length > 0) {
            const latestPayment = salesOrder.invoice.payments[0];
            if (latestPayment.payment) {
              paymentMethod = latestPayment.payment.method || null;
            }
          }
        } else {
          // No invoice, default to UNPAID with full amount outstanding
          paymentStatus = 'UNPAID';
          amountPaid = 0;
          amountDue = Number(salesOrder.total);
        }
        
        console.log('📦 Order payment data:', {
          orderNumber: salesOrder.number,
          hasInvoice: !!salesOrder.invoice,
          paymentStatus,
          amountPaid,
          amountDue,
          total: salesOrder.total,
          paymentMethod
        });
        
        return {
          id: salesOrder.id,
          orderNumber: salesOrder.number,
          totalAmount: Number(salesOrder.total),
          status: salesOrder.status,
          paymentMethod: paymentMethod,
          paymentStatus: paymentStatus,
          amountPaid: amountPaid,
          amountDue: amountDue,
          customerType: 'account',
          notes: salesOrder.notes,
          deliveryAddress: salesOrder.deliveryAddress,
          deliveryDate: salesOrder.deliveryDate,
          createdAt: salesOrder.createdAt,
          updatedAt: salesOrder.updatedAt,
          distributor: null,
          account: salesOrder.account,
          contact: null,
          items: salesOrder.lines.map((line: any) => ({
            id: line.id,
            quantity: Number(line.quantity),
            unitPrice: Number(line.unitPrice),
            totalPrice: Number(line.lineTotal),
            notes: line.description,
            product: line.product
          })),
          createdByUser: {
            id: salesOrder.ownerId,
            name: salesOrder.owner?.name || 'System'
          },
          type: 'salesOrder' as const
        };
      })
    ];

    // Apply sorting if needed (already sorted by orderBy in queries, but handle client-side sorting if sortBy is on a combined field)
    if (params.sortBy && !['createdAt', 'orderNumber'].includes(params.sortBy)) {
      // For other fields, sort after combining
      allOrders.sort((a, b) => {
        const aVal = (a as any)[params.sortBy!];
        const bVal = (b as any)[params.sortBy!];
        if (aVal < bVal) return params.sortOrder === 'asc' ? -1 : 1;
        if (aVal > bVal) return params.sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    // Apply pagination
    const paginatedOrders = allOrders.slice(offset, offset + limit);

    const totalCount = ordersCount + salesOrdersCount;

    return NextResponse.json({
      success: true,
      data: {
        orders: paginatedOrders,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        },
        sort: params.sortBy
          ? {
              field: params.sortBy,
              order: params.sortOrder || 'desc',
            }
          : undefined,
      }
    });

  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch orders',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}
