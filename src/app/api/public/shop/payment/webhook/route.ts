import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import {
  EcommercePaymentStatus,
  EcommerceOrderStatus,
} from "@prisma/client";

// Helper to find or create Account from Lead
async function findOrCreateAccountFromLead(leadId: string, userId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
  });

  if (!lead) {
    throw new Error("Lead not found");
  }

  // Try to find existing account by email
  if (lead.email) {
    const existingAccount = await prisma.account.findFirst({
      where: { email: lead.email },
    });

    if (existingAccount) {
      return existingAccount;
    }
  }

  // Create new account from lead
  const accountName = lead.company || `${lead.firstName} ${lead.lastName}`;
  
  // Parse addresses
  let billingAddress = null;
  let shippingAddress = null;
  try {
    if (lead.billingAddress) {
      billingAddress = typeof lead.billingAddress === 'string' 
        ? JSON.parse(lead.billingAddress) 
        : lead.billingAddress;
    }
    if (lead.shippingAddress) {
      shippingAddress = typeof lead.shippingAddress === 'string'
        ? JSON.parse(lead.shippingAddress)
        : lead.shippingAddress;
    }
  } catch (e) {
    console.error("Error parsing lead addresses:", e);
  }

  const account = await prisma.account.create({
    data: {
      name: accountName,
      email: lead.email || null,
      phone: lead.phone || null,
      type: lead.leadType === "COMPANY" ? "COMPANY" : "INDIVIDUAL",
      ownerId: userId,
      address: billingAddress ? JSON.stringify(billingAddress) : null,
      city: billingAddress?.city || null,
      state: billingAddress?.region || null,
      country: billingAddress?.country || "Ghana",
    },
  });

  return account;
}

// Helper to generate payment number (same as admin payments)
async function generatePaymentNumber(): Promise<string> {
  let attempts = 0;
  const maxAttempts = 10;
  let baseNumber = 1;
  
  const lastPayment = await prisma.payment.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { number: true }
  });
  
  if (lastPayment?.number) {
    const match = lastPayment.number.match(/\d+$/);
    if (match) {
      baseNumber = parseInt(match[0], 10) + 1;
    }
  }
  
  while (attempts < maxAttempts) {
    const paymentNumber = `PAY-${baseNumber.toString().padStart(6, '0')}`;
    
    const exists = await prisma.payment.findUnique({
      where: { number: paymentNumber },
      select: { id: true }
    });
    
    if (!exists) {
      return paymentNumber;
    }
    
    attempts++;
    baseNumber++;
  }
  
  const timestamp = Date.now();
  return `PAY-${timestamp.toString().slice(-6)}`;
}

// Helper to update invoice payment status (same logic as admin)
async function updateInvoicePaymentStatus(invoiceId: string, userId?: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { total: true, paymentStatus: true }
  });

  if (!invoice) return;

  const previousPaymentStatus = invoice.paymentStatus;
  
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
  
  const totalPaidFromPayments = allAllocations.reduce((sum, allocation) => sum + Number(allocation.amount), 0);
  const totalPaidFromCreditNotes = creditNoteApplications.reduce((sum, app) => sum + Number(app.amount), 0);
  const totalPaid = totalPaidFromPayments + totalPaidFromCreditNotes;
  const amountDue = Math.max(0, invoice.total - totalPaid);

  let paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
  if (totalPaid === 0) {
    paymentStatus = 'UNPAID';
  } else if (Math.abs(totalPaid - invoice.total) < 0.01 || totalPaid >= invoice.total || amountDue <= 0.01) {
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
      const { CommissionService } = await import('@/lib/commission-service');
      await CommissionService.createCommissionsForInvoice(invoiceId, userId);
    } catch (error) {
      console.error(`Error creating commissions for invoice ${invoiceId}:`, error);
    }
  }
}

// POST /api/public/shop/payment/webhook - Handle payment gateway webhook
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Helper function to get setting value
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
    
    // Verify webhook signature (Paystack)
    // Get secret key from settings (with fallback to environment variable)
    const paystackSecretKey = await getSettingValue("PAYSTACK_SECRET_KEY", "") || process.env.PAYSTACK_SECRET_KEY || "";
    if (paystackSecretKey) {
      const signature = request.headers.get("x-paystack-signature");
      if (signature) {
        const hash = crypto
          .createHmac("sha512", paystackSecretKey)
          .update(JSON.stringify(body))
          .digest("hex");
        
        if (hash !== signature) {
          return NextResponse.json(
            { error: "Invalid signature" },
            { status: 401 }
          );
        }
      }
    }

    // Handle Paystack webhook
    const event = body.event;
    const data = body.data;

    if (event === "charge.success") {
      const reference = data.reference;
      const amount = data.amount / 100; // Convert from pesewas to GHS
      const metadata = data.metadata || {};
      const invoiceId = metadata.invoiceId;
      const customerId = metadata.customerId;

      if (!invoiceId || !customerId) {
        console.error("Missing invoiceId or customerId in webhook metadata");
        return NextResponse.json(
          { error: "Missing required metadata" },
          { status: 400 }
        );
      }

      // Get invoice and customer
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: { lead: true },
      });

      if (!invoice) {
        console.error(`Invoice ${invoiceId} not found`);
        return NextResponse.json(
          { error: "Invoice not found" },
          { status: 404 }
        );
      }

      // Check if payment already processed
      const existingPayment = await prisma.payment.findFirst({
        where: { reference: reference },
      });

      if (existingPayment) {
        console.log(`Payment ${reference} already processed`);
        return NextResponse.json({ success: true, message: "Payment already processed" });
      }

      // Get system user
      const systemUser = await prisma.user.findFirst({
        where: {
          OR: [{ role: "ADMIN" }, { role: "SUPER_ADMIN" }],
        },
      });

      if (!systemUser) {
        console.error("System user not found");
        return NextResponse.json(
          { error: "System user not found" },
          { status: 500 }
        );
      }

      // Find or create account from lead
      let account;
      if (invoice.leadId) {
        account = await findOrCreateAccountFromLead(invoice.leadId, systemUser.id);
      } else {
        // Fallback: create account from invoice data
        account = await prisma.account.create({
          data: {
            name: invoice.lead?.email || "E-commerce Customer",
            email: invoice.lead?.email || null,
            phone: invoice.lead?.phone || null,
            type: "INDIVIDUAL",
            ownerId: systemUser.id,
            country: "Ghana",
          },
        });
      }

      // Generate payment number
      const paymentNumber = await generatePaymentNumber();

      // Create payment record in admin system
      const payment = await prisma.payment.create({
        data: {
          number: paymentNumber,
          accountId: account.id,
          amount: amount,
          method: "CREDIT_CARD", // Or detect from gateway
          reference: reference,
          receiptUrl: data.receipt?.url || null,
          notes: `E-commerce payment via Paystack\nInvoice: ${invoice.number}\nCustomer: ${metadata.customerName || invoice.lead?.email}`,
          receivedBy: systemUser.id,
        },
      });

      // Create payment allocation linking payment to invoice
      await prisma.paymentAllocation.create({
        data: {
          paymentId: payment.id,
          invoiceId: invoice.id,
          amount: amount,
          notes: `Auto-allocated from e-commerce payment`,
        },
      });

      // Update invoice payment status
      await updateInvoicePaymentStatus(invoice.id, systemUser.id);

      // Update ecommerce order status (linked by orderNumber = invoice.number)
      const ecommerceOrder = await prisma.ecommerceOrder.findFirst({
        where: { orderNumber: invoice.number },
      });

      if (ecommerceOrder && ecommerceOrder.paymentStatus !== EcommercePaymentStatus.PAID) {
        const updatedOrder = await prisma.ecommerceOrder.update({
          where: { id: ecommerceOrder.id },
          data: {
            paymentStatus: EcommercePaymentStatus.PAID,
            status: ecommerceOrder.status === EcommerceOrderStatus.CANCELLED 
              ? ecommerceOrder.status 
              : EcommerceOrderStatus.PROCESSING, // Set to PROCESSING after payment, not COMPLETED
            paymentId: reference,
            paymentMethod: "ONLINE",
          },
        });
        
        // Send order confirmation email/SMS AFTER payment is confirmed
        try {
          const { sendOrderCreatedNotifications } = await import('@/lib/payment-order-notifications');
          const customerInfo = {
            email: updatedOrder.customerEmail || null,
            phone: updatedOrder.customerPhone || null,
            name: updatedOrder.customerName || 'Valued Customer',
          };
          const orderInfo = {
            ...updatedOrder,
            orderNumber: updatedOrder.orderNumber,
            total: Number(updatedOrder.total),
            createdAt: updatedOrder.createdAt,
            deliveryAddress: updatedOrder.shippingAddress,
            status: updatedOrder.status,
            paymentStatus: updatedOrder.paymentStatus,
          };
          sendOrderCreatedNotifications(orderInfo, customerInfo, true).catch(error => {
            console.error('Error sending order confirmation after payment (webhook):', error);
          });
        } catch (error) {
          console.error('Error importing/executing order notifications (webhook):', error);
        }
      }

      console.log(`✅ Payment processed successfully: ${paymentNumber} for invoice ${invoice.number}`);

      return NextResponse.json({
        success: true,
        message: "Payment processed successfully",
        paymentNumber: payment.number,
      });
    }

    return NextResponse.json({ success: true, message: "Webhook received" });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 }
    );
  }
}

