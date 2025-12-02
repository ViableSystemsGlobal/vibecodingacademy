import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const DEFAULT_PAGE_SIZE = 20;

function parseNumber(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log('🔍 Ecommerce Orders API - Starting request');

    const { searchParams } = new URL(request.url);
    const page = parseNumber(searchParams.get("page"), 1);
    const limit = parseNumber(searchParams.get("limit"), DEFAULT_PAGE_SIZE);
    const status = searchParams.get("status");
    const paymentStatus = searchParams.get("paymentStatus");
    const search = searchParams.get("search");

    const skip = (page - 1) * limit;

    // Query EcommerceOrder table directly
    const where: Prisma.EcommerceOrderWhereInput = {};

    if (status && status !== "all") {
      where.status = status.toUpperCase() as any; // EcommerceOrderStatus
    }

    if (paymentStatus && paymentStatus !== "all") {
      where.paymentStatus = paymentStatus.toUpperCase() as any; // EcommercePaymentStatus
    }

    if (search) {
      const term = search.trim();
      if (term) {
        where.OR = [
          { orderNumber: { contains: term, mode: 'insensitive' } },
          { customerEmail: { contains: term, mode: 'insensitive' } },
          { customerName: { contains: term, mode: 'insensitive' } },
          { customerPhone: { contains: term, mode: 'insensitive' } },
        ];
      }
    }

    const [ecommerceOrders, total] = await Promise.all([
      prisma.ecommerceOrder.findMany({
        where,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          subtotal: true,
          tax: true,
          discount: true,
          total: true,
          shipping: true,
          currency: true,
          shippingAddress: true,
          billingAddress: true,
          notes: true,
          shippedAt: true,
          deliveredAt: true,
          customerId: true,
          customerEmail: true,
          customerName: true,
          customerPhone: true,
          createdAt: true,
          updatedAt: true,
          customer: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
          items: {
            select: {
              id: true,
              productId: true,
              productName: true,
              sku: true,
              quantity: true,
              unitPrice: true,
              totalPrice: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.ecommerceOrder.count({ where }),
    ]);

    // Fetch products separately to handle deleted products gracefully
    const productIds = [...new Set(
      ecommerceOrders.flatMap(order => 
        order.items.map(item => item.productId).filter(Boolean)
      )
    )];
    const existingProducts = productIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, name: true, sku: true, images: true },
        })
      : [];
    const productMap = new Map(existingProducts.map(p => [p.id, p]));

    // Enrich order items with product data
    const enrichedOrders = ecommerceOrders.map(order => ({
      ...order,
      items: order.items.map(item => ({
        ...item,
        product: item.productId ? productMap.get(item.productId) || null : null,
      })),
    }));

    // Fetch linked invoices and sales orders for these orders
    // Note: EcommerceOrder.orderNumber is actually the invoice number (set during checkout)
    const orderNumbers = enrichedOrders.map(o => o.orderNumber).filter(Boolean);
    const customerEmails = enrichedOrders.map(o => o.customerEmail).filter(Boolean) as string[];
    
    let linkedInvoices: any[] = [];
    let linkedSalesOrders: any[] = [];
    
    if (orderNumbers.length > 0 || customerEmails.length > 0) {
      try {
        const whereConditions: any[] = [];
        
        // Match by invoice number (which equals ecommerce order number)
        if (orderNumbers.length > 0) {
          whereConditions.push({
            number: {
              in: orderNumbers,
            },
          });
        }
        
        // Match by Lead with source="ECOMMERCE" and matching email
        if (customerEmails.length > 0) {
          whereConditions.push({
            lead: {
              source: "ECOMMERCE",
              email: {
                in: customerEmails,
              },
            },
          });
        }
        
        // First fetch invoices
        linkedInvoices = await prisma.invoice.findMany({
          where: {
            OR: whereConditions.length > 0 ? whereConditions : [{ id: 'none' }], // Fallback to prevent empty OR
          },
          include: {
            lead: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                company: true,
              },
            },
            payments: {
              include: {
                payment: {
                  select: {
                    id: true,
                    method: true,
                    reference: true,
                    receivedAt: true,
                  },
                },
              },
              orderBy: {
                createdAt: 'desc',
              },
              take: 5, // Get up to 5 most recent payments
            },
          },
        });
        
        // Then fetch linked SalesOrders using invoice IDs
        const invoiceIds = linkedInvoices.map(inv => inv.id);
        if (invoiceIds.length > 0) {
          linkedSalesOrders = await prisma.salesOrder.findMany({
            where: {
              invoiceId: {
                in: invoiceIds,
              },
            },
            select: {
              id: true,
              invoiceId: true,
              status: true,
              deliveredAt: true,
            },
          });
        }
      } catch (error) {
        console.error('Error fetching linked invoices/sales orders:', error);
        // Continue without linked data - will use ecommerce order data
        linkedInvoices = [];
        linkedSalesOrders = [];
      }
    }

    // Create maps for quick lookup
    const invoiceMap = new Map<string, typeof linkedInvoices[0]>();
    const salesOrderMap = new Map<string, typeof linkedSalesOrders[0]>();
    
    linkedInvoices.forEach(inv => {
      // Match by invoice number (which is the ecommerce order number)
      if (orderNumbers.includes(inv.number)) {
        invoiceMap.set(inv.number, inv);
      } else {
        // Fallback: match by email and creation time
        const matchingOrder = enrichedOrders.find(
          o => o.customerEmail === inv.lead?.email &&
          Math.abs(new Date(inv.createdAt).getTime() - new Date(o.createdAt).getTime()) < 60000
        );
        if (matchingOrder) {
          invoiceMap.set(matchingOrder.orderNumber, inv);
        }
      }
    });
    
    // Map sales orders by invoice ID
    linkedSalesOrders.forEach(so => {
      if (so.invoiceId) {
        const invoice = linkedInvoices.find(inv => inv.id === so.invoiceId);
        if (invoice && invoice.number) {
          salesOrderMap.set(invoice.number, so);
        }
      }
    });

    const data = enrichedOrders.map((order) => {
      // Check if there's a linked invoice for this order
      const linkedInvoice = invoiceMap.get(order.orderNumber) || 
        linkedInvoices.find(inv => 
          inv.lead?.email === order.customerEmail && 
          Math.abs(new Date(inv.createdAt).getTime() - new Date(order.createdAt).getTime()) < 60000 // Created within 1 minute
        );
      const items = order.items.map((item: any) => {
        let productImages: string[] = [];
        if (item.product?.images) {
          try {
            const parsed =
              typeof item.product.images === "string"
                ? JSON.parse(item.product.images)
                : item.product.images;
            if (Array.isArray(parsed)) {
              productImages = parsed;
            } else if (typeof parsed === "string") {
              productImages = [parsed];
            }
          } catch {
            productImages = [item.product.images as string];
          }
        }

        return {
          id: item.id,
          productId: item.productId,
          productName: item.productName || item.product?.name || "Product Deleted",
          productSku: item.sku || item.product?.sku || item.productId || "N/A",
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          tax: 0, // EcommerceOrderItem doesn't have tax field
          discount: 0, // EcommerceOrderItem doesn't have discount field
          lineTotal: Number(item.totalPrice),
          primaryImage: productImages[0] || null,
        };
      });

      // Parse shipping address if it's a JSON string
      let deliveryAddress = null;
      try {
        if (order.shippingAddress) {
          deliveryAddress = typeof order.shippingAddress === "string" 
            ? JSON.parse(order.shippingAddress) 
            : order.shippingAddress;
        }
      } catch {
        deliveryAddress = order.shippingAddress;
      }

      // Determine status: prioritize SalesOrder status, then deliveredAt, then ecommerce order status
      const linkedSalesOrder = salesOrderMap.get(order.orderNumber);
      let finalStatus = order.status;
      
      // If SalesOrder exists and has DELIVERED status, use that
      if (linkedSalesOrder && (linkedSalesOrder.status === 'DELIVERED' || linkedSalesOrder.status === 'COMPLETED')) {
        finalStatus = 'DELIVERED' as any;
      } 
      // If deliveredAt is set, status should be DELIVERED
      else if (order.deliveredAt) {
        finalStatus = 'DELIVERED' as any;
      }
      // If SalesOrder has deliveredAt set, also mark as DELIVERED
      else if (linkedSalesOrder && linkedSalesOrder.deliveredAt) {
        finalStatus = 'DELIVERED' as any;
      }

      return {
        id: order.id,
        number: order.orderNumber,
        status: finalStatus,
        subtotal: Number(order.subtotal),
        tax: Number(order.tax),
        discount: Number(order.discount),
        total: Number(order.total),
        deliveryAddress: deliveryAddress,
        deliveryNotes: order.notes || null,
        deliveryDate: order.shippedAt || order.deliveredAt || null,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        account: order.customer
          ? {
              id: order.customer.id,
              name: `${order.customer.firstName || ""} ${order.customer.lastName || ""}`.trim() || order.customerName,
              email: order.customer.email || order.customerEmail,
              phone: order.customer.phone || order.customerPhone,
              type: "INDIVIDUAL" as const,
            }
          : {
              id: null,
              name: order.customerName,
              email: order.customerEmail,
              phone: order.customerPhone,
              type: "INDIVIDUAL" as const,
            },
        owner: null, // EcommerceOrder doesn't have owner
        invoice: linkedInvoice ? {
          id: linkedInvoice.id,
          number: linkedInvoice.number,
          paymentStatus: linkedInvoice.paymentStatus,
          status: linkedInvoice.status,
          dueDate: linkedInvoice.dueDate.toISOString(),
          amountDue: Number(linkedInvoice.amountDue || 0),
          amountPaid: Number(linkedInvoice.amountPaid || 0),
          payments: linkedInvoice.payments.map(pa => ({
            id: pa.payment.id,
            amount: Number(pa.amount),
            method: pa.payment.method || 'UNKNOWN',
            reference: pa.payment.reference,
            createdAt: pa.payment.receivedAt?.toISOString() || pa.createdAt.toISOString(),
          })),
          lead: linkedInvoice.lead ? {
            id: linkedInvoice.lead.id,
            name: `${linkedInvoice.lead.firstName || ""} ${linkedInvoice.lead.lastName || ""}`.trim() || order.customerName,
            email: linkedInvoice.lead.email || order.customerEmail,
            phone: linkedInvoice.lead.phone || order.customerPhone,
            company: linkedInvoice.lead.company,
          } : (order.customer
            ? {
                id: order.customer.id,
                name: `${order.customer.firstName || ""} ${order.customer.lastName || ""}`.trim() || order.customerName,
                email: order.customer.email || order.customerEmail,
                phone: order.customer.phone || order.customerPhone,
                company: null,
              }
            : {
                id: null,
                name: order.customerName,
                email: order.customerEmail,
                phone: order.customerPhone,
                company: null,
              }),
        } : {
          id: order.id, // Use order ID as invoice reference
          number: order.orderNumber, // Use order number as invoice number
          // Map EcommercePaymentStatus to Invoice PaymentStatus
          // EcommercePaymentStatus: PENDING, PAID, FAILED, REFUNDED
          // Invoice PaymentStatus: UNPAID, PARTIALLY_PAID, PAID
          paymentStatus: (() => {
            const status = (order.paymentStatus || 'PENDING').toUpperCase();
            if (status === 'PAID') return 'PAID' as const;
            if (status === 'PENDING') return 'UNPAID' as const;
            return 'UNPAID' as const; // FAILED, REFUNDED, etc. default to UNPAID
          })(),
          status: order.status,
          dueDate: order.createdAt, // Use created date as due date
          // Calculate amounts based on payment status
          // EcommerceOrder doesn't have amountPaid/amountDue fields, so we calculate from paymentStatus
          amountDue: (order.paymentStatus === 'PAID') 
            ? 0 
            : Number(order.total),
          amountPaid: (order.paymentStatus === 'PAID')
            ? Number(order.total)
            : 0,
          payments: [], // EcommerceOrder doesn't have direct payment relation yet
          lead: order.customer
            ? {
                id: order.customer.id,
                name: `${order.customer.firstName || ""} ${order.customer.lastName || ""}`.trim() || order.customerName,
                email: order.customer.email || order.customerEmail,
                phone: order.customer.phone || order.customerPhone,
                company: null,
              }
            : {
                id: null,
                name: order.customerName,
                email: order.customerEmail,
                phone: order.customerPhone,
                company: null,
              },
        },
        lastPayment: null, // EcommerceOrder doesn't have direct payment relation
        items,
      };
    });

    console.log('✅ Ecommerce Orders API - Returning data:', {
      ordersCount: data.length,
      total,
      page,
      limit,
    });

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("❌ Error fetching ecommerce orders:", error);
    console.error("❌ Error stack:", error instanceof Error ? error.stack : "No stack trace");
    console.error("❌ Error details:", error instanceof Error ? {
      message: error.message,
      name: error.name,
    } : error);
    
    return NextResponse.json(
      {
        error: "Failed to fetch ecommerce orders",
        details:
          process.env.NODE_ENV === "development" && error instanceof Error
              ? error.message
            : undefined,
        stack:
          process.env.NODE_ENV === "development" && error instanceof Error
            ? error.stack
            : undefined,
      },
      { status: 500 }
    );
  }
}
