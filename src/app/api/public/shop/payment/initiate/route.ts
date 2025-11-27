import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verify } from "jsonwebtoken";

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

const JWT_SECRET = process.env.NEXTAUTH_SECRET || "adpools-secret-key-2024-production-change-me";

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
  const account = await prisma.account.create({
    data: {
      name: accountName,
      email: lead.email || null,
      phone: lead.phone || null,
      type: lead.leadType === "COMPANY" ? "COMPANY" : "INDIVIDUAL",
      ownerId: userId,
      address: lead.billingAddress ? JSON.stringify(lead.billingAddress) : null,
      city: lead.billingAddress && typeof lead.billingAddress === 'object' 
        ? (lead.billingAddress as any).city || null 
        : null,
      state: lead.billingAddress && typeof lead.billingAddress === 'object'
        ? (lead.billingAddress as any).region || null
        : null,
      country: lead.billingAddress && typeof lead.billingAddress === 'object'
        ? (lead.billingAddress as any).country || null
        : "Ghana",
    },
  });

  return account;
}

// POST /api/public/shop/payment/initiate - Initiate payment gateway transaction
export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error("Error parsing request body:", parseError);
      return NextResponse.json(
        { error: "Invalid request body. Expected JSON." },
        { status: 400 }
      );
    }

    const { invoiceId, invoiceNumber, paymentMethod, amount, customerEmail } = body;
    
    console.log("Payment initiate request:", {
      hasInvoiceId: !!invoiceId,
      hasInvoiceNumber: !!invoiceNumber,
      paymentMethod,
      amount,
      hasCustomerEmail: !!customerEmail
    });

    if ((!invoiceId && !invoiceNumber) || !paymentMethod || !amount) {
      return NextResponse.json(
        { error: "Invoice ID or Invoice Number, payment method, and amount are required" },
        { status: 400 }
      );
    }

    // Validate amount
    const amountNum = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json(
        { error: `Invalid amount: ${amount}. Amount must be a positive number.` },
        { status: 400 }
      );
    }

    // Get invoice - allow access via invoiceId or invoiceNumber (for guest checkout)
    console.log("Looking up invoice:", { invoiceId, invoiceNumber });
    
    const invoice = invoiceId
      ? await prisma.invoice.findUnique({
          where: { id: invoiceId },
          include: {
            lead: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        })
      : invoiceNumber
      ? await prisma.invoice.findUnique({
          where: { number: invoiceNumber },
          include: {
            lead: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        })
      : null;

    if (!invoice) {
      console.error("Invoice not found:", { invoiceId, invoiceNumber });
      return NextResponse.json(
        { error: `Invoice not found${invoiceNumber ? ` with number: ${invoiceNumber}` : ""}` },
        { status: 404 }
      );
    }

    console.log("Invoice found:", { id: invoice.id, number: invoice.number });
    
    // Get ecommerce order separately if it exists (linked by orderNumber = invoice.number)
    let ecommerceOrder = null;
    if (invoice.number) {
      ecommerceOrder = await prisma.ecommerceOrder.findUnique({
        where: { orderNumber: invoice.number },
        select: {
          id: true,
          customerEmail: true,
          customerName: true,
      },
    });
    }

    // Determine customer email - prefer from request, then from ecommerce order, then from invoice lead
    const email = customerEmail || ecommerceOrder?.customerEmail || invoice.lead?.email;
    if (!email) {
      return NextResponse.json(
        { error: "Customer email is required for payment" },
        { status: 400 }
      );
    }

    // Try to get customer if authenticated (optional)
    let customer = null;
    const cookieStore = await cookies();
    const token = cookieStore.get("customer_token")?.value;
    if (token) {
      try {
        const decoded: any = verify(token, JWT_SECRET);
        if (decoded.type === "customer") {
          customer = await prisma.customer.findUnique({
            where: { id: decoded.id },
          });
    }
      } catch (error) {
        // Token invalid, continue as guest
      }
    }

    // Use customer name if available, otherwise use ecommerce order name, then lead name
    const customerName = customer 
      ? `${customer.firstName} ${customer.lastName}`
      : ecommerceOrder?.customerName 
      ? ecommerceOrder.customerName
      : invoice.lead 
      ? `${invoice.lead.firstName} ${invoice.lead.lastName}`
      : "Customer";

    // Get system user for payment creation
    const systemUser = await prisma.user.findFirst({
      where: {
        OR: [{ role: "ADMIN" }, { role: "SUPER_ADMIN" }],
      },
    });

    if (!systemUser) {
      return NextResponse.json(
        { error: "System user not found" },
        { status: 500 }
      );
    }

    // Get Paystack keys from settings (with fallback to environment variables)
    const paystackPublicKey = await getSettingValue("PAYSTACK_PUBLIC_KEY", "") || process.env.PAYSTACK_PUBLIC_KEY || "";
    const flutterwavePublicKey = process.env.FLUTTERWAVE_PUBLIC_KEY;

    if (!paystackPublicKey && !flutterwavePublicKey) {
      return NextResponse.json(
        { error: "Payment gateway not configured. Please add your Paystack keys in Ecommerce Settings." },
        { status: 500 }
      );
    }

    // Use Paystack by default if available, otherwise Flutterwave
    const gateway = paystackPublicKey ? "paystack" : "flutterwave";

    // Create payment reference
    const paymentReference = `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    // Prepare payment data for gateway
    const amountInPesewas = Math.round(amountNum * 100);
    if (amountInPesewas <= 0) {
      return NextResponse.json(
        { error: `Invalid amount: ${amountNum}. Amount must be greater than 0.` },
        { status: 400 }
      );
    }
    
    const paymentData = {
      amount: amountInPesewas, // Convert to smallest currency unit (pesewas for GHS)
      email: email,
      reference: paymentReference,
      currency: "GHS",
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        customerId: customer?.id || null,
        customerEmail: email,
        customerName: customerName,
      },
    };
    
    console.log("Payment data prepared:", {
      amount: paymentData.amount,
      amountInGHS: amountNum,
      email: paymentData.email,
      reference: paymentData.reference
    });

    // Initialize payment with gateway
    let gatewayResponse;
    if (gateway === "paystack") {
      // Get secret key from settings (with fallback to environment variable)
      const paystackSecretKey = await getSettingValue("PAYSTACK_SECRET_KEY", "") || process.env.PAYSTACK_SECRET_KEY || "";
      if (!paystackSecretKey) {
        return NextResponse.json(
          { error: "Paystack secret key not configured. Please add it in Ecommerce Settings." },
          { status: 500 }
        );
      }

      // Initialize Paystack transaction
      console.log("Calling Paystack API with:", {
        amount: paymentData.amount,
        email: paymentData.email,
        reference: paymentData.reference,
        currency: paymentData.currency,
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/shop/payment/callback`
      });
      
      let paystackResponse;
      try {
        paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${paystackSecretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: paymentData.amount,
          email: paymentData.email,
          reference: paymentData.reference,
          currency: paymentData.currency,
          metadata: paymentData.metadata,
          callback_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/shop/payment/callback`,
        }),
      });
      } catch (fetchError) {
        console.error("Error calling Paystack API:", fetchError);
        return NextResponse.json(
          { error: `Failed to connect to Paystack: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}` },
          { status: 500 }
        );
      }

      if (!paystackResponse.ok) {
        let errorData;
        try {
          errorData = await paystackResponse.json();
        } catch (e) {
          const text = await paystackResponse.text();
          errorData = { message: text || `Paystack API error: ${paystackResponse.status} ${paystackResponse.statusText}` };
        }
        console.error("Paystack API error:", {
          status: paystackResponse.status,
          statusText: paystackResponse.statusText,
          error: errorData
        });
        return NextResponse.json(
          { error: errorData.message || `Paystack error: ${paystackResponse.status}` },
          { status: paystackResponse.status || 500 }
        );
      }

      try {
        gatewayResponse = await paystackResponse.json();
      } catch (parseError) {
        console.error("Error parsing Paystack response:", parseError);
        return NextResponse.json(
          { error: "Invalid response from Paystack" },
          { status: 500 }
        );
      }

      if (!gatewayResponse.data || !gatewayResponse.data.authorization_url) {
        console.error("Invalid Paystack response structure:", gatewayResponse);
        return NextResponse.json(
          { error: "Invalid response from Paystack: missing authorization URL" },
          { status: 500 }
        );
      }
    } else {
      // Flutterwave implementation would go here
      return NextResponse.json(
        { error: "Flutterwave not yet implemented" },
        { status: 501 }
      );
    }

    // Store payment reference in invoice notes for tracking
    // The actual Payment record will be created when webhook confirms
    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        notes: `${invoice.notes || ""}\nPayment Reference: ${paymentReference} (${gateway.toUpperCase()})`.trim(),
      },
    });

    return NextResponse.json({
      success: true,
      paymentReference: paymentReference,
      authorizationUrl: gatewayResponse.data.authorization_url,
      accessCode: gatewayResponse.data.access_code,
      gateway: gateway,
    });
  } catch (error) {
    console.error("Error initiating payment:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to initiate payment";
    return NextResponse.json(
      { 
        error: errorMessage,
        details: error instanceof Error ? error.stack : String(error)
      },
      { status: 500 }
    );
  }
}

