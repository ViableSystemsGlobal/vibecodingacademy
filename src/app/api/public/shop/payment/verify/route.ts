import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  EcommercePaymentStatus,
  EcommerceOrderStatus,
  PaymentStatus,
} from "@prisma/client";

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

// GET /api/public/shop/payment/verify - Verify payment status (for callback page)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reference = searchParams.get("reference");

    if (!reference) {
      return NextResponse.json(
        { error: "Payment reference is required" },
        { status: 400 }
      );
    }

    // Verify payment with Paystack
    // Get secret key from settings (with fallback to environment variable)
    const paystackSecretKey = await getSettingValue("PAYSTACK_SECRET_KEY", "") || process.env.PAYSTACK_SECRET_KEY || "";
    if (!paystackSecretKey) {
      return NextResponse.json(
        { error: "Payment gateway not configured. Please add your Paystack secret key in Ecommerce Settings." },
        { status: 500 }
      );
    }

    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to verify payment" },
        { status: 500 }
      );
    }

    const data = await response.json();

    if (data.status && data.data.status === "success") {
      const metadata = data.data.metadata || {};
      const invoiceId = metadata.invoiceId as string | undefined;
      const invoiceNumber = metadata.invoiceNumber as string | undefined;

      let orderPayload: any = null;

      if (invoiceId || invoiceNumber) {
        const invoice = invoiceId
          ? await prisma.invoice.findUnique({
              where: { id: invoiceId },
            })
          : invoiceNumber
          ? await prisma.invoice.findUnique({
              where: { number: invoiceNumber },
            })
          : null;

        if (invoice) {
          if (invoice.paymentStatus !== PaymentStatus.PAID) {
            await prisma.invoice.update({
              where: { id: invoice.id },
              data: {
                paymentStatus: PaymentStatus.PAID,
                amountPaid: invoice.total,
                amountDue: 0,
                paidDate: new Date(),
              },
            });
          }

          const ecommerceOrder = await prisma.ecommerceOrder.findFirst({
            where: {
              orderNumber: invoice.number,
            },
            include: {
              items: {
                include: {
                  product: {
                    select: {
                      id: true,
                      images: true,
                    },
                  },
                },
              },
            },
          });

          if (ecommerceOrder) {
            let updatedStatus = ecommerceOrder.status;
            let updatedPaymentStatus = ecommerceOrder.paymentStatus;
            let shouldSendNotifications = false;
            
            if (ecommerceOrder.paymentStatus !== EcommercePaymentStatus.PAID) {
              const updatedOrder = await prisma.ecommerceOrder.update({
                where: { id: ecommerceOrder.id },
                data: {
                  paymentStatus: EcommercePaymentStatus.PAID,
                  status: ecommerceOrder.status === EcommerceOrderStatus.CANCELLED
                    ? ecommerceOrder.status
                    : EcommerceOrderStatus.PROCESSING,
                  paymentId: reference,
                  paymentMethod: "ONLINE",
                },
              });
              // Use the updated status
              updatedStatus = updatedOrder.status;
              updatedPaymentStatus = updatedOrder.paymentStatus;
              shouldSendNotifications = true;
            }
            
            // Send order confirmation email/SMS AFTER payment is confirmed
            if (shouldSendNotifications) {
              try {
                const { sendOrderCreatedNotifications } = await import('@/lib/payment-order-notifications');
                const customerInfo = {
                  email: ecommerceOrder.customerEmail || null,
                  phone: ecommerceOrder.customerPhone || null,
                  name: ecommerceOrder.customerName || 'Valued Customer',
                };
                const orderInfo = {
                  ...ecommerceOrder,
                  orderNumber: ecommerceOrder.orderNumber,
                  total: Number(ecommerceOrder.total),
                  createdAt: ecommerceOrder.createdAt,
                  deliveryAddress: ecommerceOrder.shippingAddress,
                  status: updatedStatus,
                  paymentStatus: updatedPaymentStatus,
                };
                sendOrderCreatedNotifications(orderInfo, customerInfo, true).catch(error => {
                  console.error('Error sending order confirmation after payment:', error);
                });
              } catch (error) {
                console.error('Error importing/executing order notifications:', error);
              }
            }

            orderPayload = {
              id: ecommerceOrder.id,
              orderNumber: ecommerceOrder.orderNumber,
              total: Number(ecommerceOrder.total),
              currency: ecommerceOrder.currency,
              status: updatedStatus,
              paymentStatus: updatedPaymentStatus,
              items: ecommerceOrder.items.map((item) => {
                let primaryImage: string | null = null;
                if (item.product?.images) {
                  try {
                    const parsed = JSON.parse(item.product.images);
                    primaryImage = Array.isArray(parsed) ? parsed[0] ?? null : null;
                  } catch {
                    primaryImage = item.product.images;
                  }
                }
                return {
                  id: item.productId,
                  name: item.productName,
                  sku: item.sku,
                  quantity: item.quantity,
                  price: Number(item.unitPrice),
                  lineTotal: Number(item.totalPrice),
                  currency: ecommerceOrder.currency,
                  image: primaryImage,
                };
              }),
            };
          }
        }
      }

      return NextResponse.json({
        success: true,
        verified: true,
        invoiceId: invoiceId,
        amount: data.data.amount / 100, // Convert from pesewas to GHS
        currency: data.data.currency,
        reference: reference,
        gatewayResponse: data.data.gateway_response,
        order: orderPayload,
      });
    } else {
      // Payment failed or cancelled
      const gatewayResponse = data.data?.gateway_response || "";
      const status = data.data?.status || "";
      const isCancelled = 
        gatewayResponse.toLowerCase().includes("cancel") ||
        gatewayResponse.toLowerCase().includes("abandon") ||
        status === "abandoned" ||
        status === "cancelled" ||
        false;

      return NextResponse.json({
        success: false,
        verified: false,
        message: gatewayResponse || "Payment verification failed",
        cancelled: isCancelled,
        gatewayResponse: gatewayResponse,
        status: status,
      });
    }
  } catch (error) {
    console.error("Payment verification error:", error);
    return NextResponse.json(
      { error: "Failed to verify payment" },
      { status: 500 }
    );
  }
}

