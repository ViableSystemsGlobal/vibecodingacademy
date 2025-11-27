import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verify } from "jsonwebtoken";

const JWT_SECRET =
  process.env.NEXTAUTH_SECRET || "adpools-secret-key-2024-production-change-me";

type CustomerSummary = {
  id?: string | null;
  email?: string | null;
};

function buildCustomerFilter(customer: CustomerSummary) {
  const emailCandidates = Array.from(
    new Set(
      [
        customer.email,
        customer.email?.trim(),
        customer.email?.toLowerCase(),
        customer.email?.trim().toLowerCase(),
        customer.email?.toUpperCase(),
        customer.email?.trim().toUpperCase(),
      ].filter(Boolean) as string[]
    )
  );

  const conditions: any[] = [];

  if (customer.id) {
    conditions.push({ customerId: customer.id });
  }

  if (emailCandidates.length > 0) {
    conditions.push({
      customerEmail: {
        in: emailCandidates,
      },
    });
  }

  if (conditions.length === 0) {
    return null;
  }

  return conditions.length === 1 ? conditions[0] : { OR: conditions };
}

function parseJsonValue(value: any) {
  if (!value) return null;

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  return value;
}

function extractImages(value?: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => typeof item === "string");
    }
    if (typeof parsed === "string") {
      return [parsed];
    }
  } catch {
    // ignore JSON parse error; treat as raw string
  }
  return [value];
}

function mapDisplayStatus(rawStatus: string, paymentStatus: string) {
  const normalizedStatus = rawStatus.toUpperCase();
  const normalizedPayment = paymentStatus.toUpperCase();

  if (["CANCELLED", "REFUNDED"].includes(normalizedStatus)) {
    return "CANCELLED";
  }

  // COMPLETED should only be shown when order is actually delivered
  if (["DELIVERED", "COMPLETED"].includes(normalizedStatus)) {
    return "COMPLETED";
  }

  // Processing status - order is being prepared/shipped
  if (["PROCESSING", "SHIPPED", "CONFIRMED"].includes(normalizedStatus)) {
    return "PROCESSING";
  }

  // Paid but still pending processing (should show as PROCESSING)
  if (normalizedPayment === "PAID" && normalizedStatus === "PENDING") {
    return "PROCESSING";
  }

  // Default to PENDING
  return "PENDING";
}

function calculatePaymentAmounts(total: number, paymentStatus: string) {
  const normalized = paymentStatus.toUpperCase();
  const isPaid = ["PAID", "REFUNDED", "PARTIALLY_REFUNDED"].includes(normalized);

  const amountPaid = isPaid ? total : 0;
  const amountDue = Math.max(total - amountPaid, 0);

  return { amountPaid, amountDue };
}

function transformOrder(order: any) {
  const subtotal = Number(order.subtotal ?? 0);
  const tax = Number(order.tax ?? 0);
  const discount = Number(order.discount ?? 0);
  const total = Number(order.total ?? 0);

  const items = (order.items ?? []).map((item: any) => {
    const unitPrice = Number(item.unitPrice ?? 0);
    const lineTotal = Number(item.totalPrice ?? unitPrice * (item.quantity ?? 0));
    const images = extractImages(item.product?.images);

    return {
      id: item.id,
      productId: item.productId,
      productName: item.productName || item.product?.name || "Product",
      productSku: item.sku || item.product?.sku || "",
      quantity: item.quantity ?? 0,
      unitPrice,
      discount: 0,
      lineTotal,
      image: images[0] || null,
    };
  });

  const paymentStatus = (order.paymentStatus || "PENDING").toString().toUpperCase();
  const displayStatus = mapDisplayStatus(
    (order.status || "PENDING").toString(),
    paymentStatus
  );
  const paymentInfo = calculatePaymentAmounts(total, paymentStatus);

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    quotationNumber: undefined,
    status: displayStatus,
    paymentStatus,
    paymentMethod: order.paymentMethod || "Online Payment",
    orderDate: order.createdAt,
    dueDate: null,
    currency: order.currency || "GHS",
    subtotal,
    tax,
    discount,
    total,
    amountPaid: paymentInfo.amountPaid,
    amountDue: paymentInfo.amountDue,
    items,
    itemCount: items.length,
    customer: {
      name: order.customerName,
      email: order.customerEmail,
      phone: order.customerPhone,
      company: null,
    },
    shippingAddress: parseJsonValue(order.shippingAddress),
    billingAddress: parseJsonValue(order.billingAddress),
    notes: order.notes,
  };
}

function buildStatusFilter(statusParam?: string | null) {
  if (!statusParam || statusParam.toLowerCase() === "all") {
    return null;
  }

  const normalized = statusParam.toUpperCase();

  const statusFilterMap: Record<string, any> = {
    PENDING: { status: { in: ["PENDING", "CONFIRMED"] } },
    PROCESSING: { status: { in: ["PROCESSING", "SHIPPED"] } },
    COMPLETED: {
      OR: [{ status: { in: ["DELIVERED"] } }, { paymentStatus: "PAID" }],
    },
    CANCELLED: { status: { in: ["CANCELLED", "REFUNDED"] } },
  };

  return statusFilterMap[normalized] ?? null;
}

async function getAuthenticatedCustomer() {
    const cookieStore = await cookies();
    const token = cookieStore.get("customer_token")?.value;

    if (!token) {
    return { error: "Authentication required", status: 401 } as const;
    }

    let decoded: any;
    try {
      decoded = verify(token, JWT_SECRET);
    } catch (error) {
      console.error("Token verification failed:", error);
    return { error: "Invalid token", status: 401 } as const;
    }

    if (decoded.type !== "customer") {
    return { error: "Invalid token type", status: 401 } as const;
    }

    const customer = await prisma.customer.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
      },
    });

    if (!customer) {
    return { error: "Customer not found", status: 404 } as const;
  }

  return { customer };
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedCustomer();
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { customer } = authResult;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "10", 10));
    const statusFilter = buildStatusFilter(searchParams.get("status"));

    const identityFilter = buildCustomerFilter({
      id: customer.id,
        email: customer.email,
    });

    if (!identityFilter) {
      return NextResponse.json(
        { orders: [], pagination: { page, limit, total: 0, pages: 1 } },
        { status: 200 }
      );
    }

    const where =
      statusFilter && identityFilter
        ? { AND: [identityFilter, statusFilter] }
        : identityFilter;

    const [ordersRaw, total] = await Promise.all([
      prisma.ecommerceOrder.findMany({
        where,
        include: {
          items: {
            include: {
              product: {
                select: {
                  images: true,
                  name: true,
                  sku: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.ecommerceOrder.count({ where }),
    ]);

    // Sync status from Sales Orders for all orders in the list
    const syncPromises = ordersRaw.map(async (order) => {
      try {
        // Find the invoice by orderNumber (ecommerce order orderNumber = invoice number)
        const invoice = await prisma.invoice.findUnique({
          where: { number: order.orderNumber },
          select: { id: true }
        });

        if (invoice) {
          // Find the Sales Order linked to this invoice
          const salesOrder = await prisma.salesOrder.findFirst({
            where: { invoiceId: invoice.id },
            select: { status: true }
          });

          if (salesOrder && salesOrder.status !== order.status) {
            // Map Sales Order status to Ecommerce Order status
            let ecommerceStatus: string;
            switch (salesOrder.status.toUpperCase()) {
              case 'DELIVERED':
                ecommerceStatus = 'DELIVERED';
                break;
              case 'COMPLETED':
                ecommerceStatus = 'DELIVERED'; // Completed = Delivered for ecommerce
                break;
              case 'SHIPPED':
              case 'READY_TO_SHIP':
                ecommerceStatus = 'SHIPPED';
                break;
              case 'PROCESSING':
                ecommerceStatus = 'PROCESSING';
                break;
              case 'CONFIRMED':
                ecommerceStatus = 'CONFIRMED';
                break;
              case 'CANCELLED':
                ecommerceStatus = 'CANCELLED';
                break;
              default:
                ecommerceStatus = order.status;
                break;
            }

            // Only update if different
            if (ecommerceStatus !== order.status) {
              await prisma.ecommerceOrder.update({
                where: { id: order.id },
                data: {
                  status: ecommerceStatus as any,
                  ...(salesOrder.status.toUpperCase() === 'DELIVERED' || salesOrder.status.toUpperCase() === 'COMPLETED'
                    ? { deliveredAt: order.deliveredAt || new Date() }
                    : {})
                }
              });
              // Update the local order object for response
              order.status = ecommerceStatus as any;
            }
          }
        }
      } catch (syncError) {
        // Don't fail the request if sync fails for one order, just log it
        console.error(`Error syncing order ${order.orderNumber} status from Sales Order:`, syncError);
      }
      return order;
    });

    // Wait for all syncs to complete
    const syncedOrders = await Promise.all(syncPromises);

    const orders = syncedOrders.map(transformOrder);

    return NextResponse.json({
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching ecommerce orders:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch orders",
        details:
          process.env.NODE_ENV === "development"
            ? error instanceof Error
              ? error.message
              : String(error)
            : undefined,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedCustomer();
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { customer } = authResult;

    const body = await request.json().catch(() => null);
    const orderId = body?.orderId;

    if (!orderId) {
      return NextResponse.json(
        { error: "Order ID is required" },
        { status: 400 }
      );
    }

    const identityFilter = buildCustomerFilter({
      id: customer.id,
      email: customer.email,
    });

    if (!identityFilter) {
      return NextResponse.json(
        { error: "Customer context missing" },
        { status: 400 }
      );
    }

    const order = await prisma.ecommerceOrder.findFirst({
      where: {
        id: orderId,
        AND: [identityFilter],
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                images: true,
                name: true,
                sku: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    // Sync status from Sales Order if available (for orders that might be out of sync)
    try {
      // Find the invoice by orderNumber (ecommerce order orderNumber = invoice number)
      const invoice = await prisma.invoice.findUnique({
        where: { number: order.orderNumber },
        select: { id: true }
      });

      if (invoice) {
        // Find the Sales Order linked to this invoice
        const salesOrder = await prisma.salesOrder.findFirst({
          where: { invoiceId: invoice.id },
          select: { status: true }
        });

        if (salesOrder && salesOrder.status !== order.status) {
          // Map Sales Order status to Ecommerce Order status
          let ecommerceStatus: string;
          switch (salesOrder.status.toUpperCase()) {
            case 'DELIVERED':
              ecommerceStatus = 'DELIVERED';
              break;
            case 'COMPLETED':
              ecommerceStatus = 'DELIVERED'; // Completed = Delivered for ecommerce
              break;
            case 'SHIPPED':
            case 'READY_TO_SHIP':
              ecommerceStatus = 'SHIPPED';
              break;
            case 'PROCESSING':
              ecommerceStatus = 'PROCESSING';
              break;
            case 'CONFIRMED':
              ecommerceStatus = 'CONFIRMED';
              break;
            case 'CANCELLED':
              ecommerceStatus = 'CANCELLED';
              break;
            default:
              ecommerceStatus = order.status;
              break;
          }

          // Only update if different
          if (ecommerceStatus !== order.status) {
            await prisma.ecommerceOrder.update({
              where: { id: order.id },
              data: {
                status: ecommerceStatus as any,
                ...(salesOrder.status.toUpperCase() === 'DELIVERED' || salesOrder.status.toUpperCase() === 'COMPLETED'
                  ? { deliveredAt: new Date() }
                  : {})
              }
            });
            // Update the local order object for response
            order.status = ecommerceStatus as any;
          }
        }
      }
    } catch (syncError) {
      // Don't fail the request if sync fails, just log it
      console.error('Error syncing order status from Sales Order:', syncError);
    }

    return NextResponse.json(transformOrder(order));
  } catch (error) {
    console.error("Error fetching ecommerce order:", error);
    return NextResponse.json(
      { error: "Failed to fetch order" },
      { status: 500 }
    );
  }
}

