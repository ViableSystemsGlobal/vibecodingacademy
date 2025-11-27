import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCompanyName } from "@/lib/payment-order-notifications";
import { addBulkEmailJob } from "@/lib/queue-service";
import { getQueueSettings } from "@/lib/queue-config";
import nodemailer from "nodemailer";

// Helper function to get setting value
async function getSettingValue(key: string, defaultValue: string = ''): Promise<string> {
  try {
    const setting = await prisma.systemSettings.findUnique({
      where: { key },
      select: { value: true }
    });
    return setting?.value || defaultValue;
  } catch (error) {
    return defaultValue;
  }
}

// Direct email sending function without template wrapper for Best Deals
async function sendBestDealsEmailDirect(
  recipient: string,
  subject: string,
  htmlContent: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const smtpHost = await getSettingValue('SMTP_HOST', '');
    const smtpPort = await getSettingValue('SMTP_PORT', '587');
    const smtpUsername = await getSettingValue('SMTP_USERNAME', '');
    const smtpPassword = await getSettingValue('SMTP_PASSWORD', '');
    const smtpFromAddress = await getSettingValue('SMTP_FROM_ADDRESS', '');
    const companyName = await getCompanyName();
    const smtpFromName = await getSettingValue('SMTP_FROM_NAME', companyName || '');
    const smtpEncryption = await getSettingValue('SMTP_ENCRYPTION', 'tls');

    if (!smtpHost || !smtpUsername || !smtpPassword || !smtpFromAddress) {
      return { success: false, error: 'Email configuration not found' };
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort),
      secure: smtpEncryption === 'ssl',
      auth: {
        user: smtpUsername,
        pass: smtpPassword,
      },
    });

    // Generate plain text version for email clients that don't support HTML
    const plainText = htmlContent
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();

    const result = await transporter.sendMail({
      from: `"${smtpFromName}" <${smtpFromAddress}>`,
      to: recipient,
      subject: subject,
      text: plainText,
      html: htmlContent, // Send raw HTML without template wrapper
    });

    return {
      success: true,
      messageId: result.messageId
    };
  } catch (error) {
    console.error('Error sending best deals email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// GET - Fetch customers for email selection
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all customers with emails (from Account model, Customer model, and EcommerceOrder)
    let accountCustomers: any[] = [];
    let customerRecords: any[] = [];
    let orderEmails: any[] = [];

    try {
      // Get ecommerce customer emails from orders
      const ecommerceOrderModel = (prisma as any).ecommerceOrder;
      if (ecommerceOrderModel) {
        const allOrders = await ecommerceOrderModel.findMany({
          select: {
            customerEmail: true,
            customerName: true,
          },
          where: {
            customerEmail: { not: null },
          },
        });
        
        // Deduplicate by email manually
        const emailSet = new Set<string>();
        orderEmails = allOrders.filter((order: any) => {
          if (!order.customerEmail) return false;
          const email = order.customerEmail.toLowerCase();
          if (emailSet.has(email)) return false;
          emailSet.add(email);
          return true;
        });
      }
    } catch (error) {
      console.error("Error fetching order emails:", error);
      orderEmails = [];
    }

    // Get accounts with emails (ecommerce customers are stored as Accounts)
    try {
      // Get account IDs from ecommerce orders
      const ecommerceEmails = orderEmails.map((o: any) => o.customerEmail?.toLowerCase()).filter(Boolean);
      
      if (ecommerceEmails.length > 0) {
        accountCustomers = await prisma.account.findMany({
          where: {
            email: { in: ecommerceEmails },
          },
          select: {
            id: true,
            email: true,
            name: true,
          },
        });
      }
    } catch (error) {
      console.error("Error fetching account customers:", error);
      accountCustomers = [];
    }

    // Also get Customer model records
    try {
      customerRecords = await prisma.customer.findMany({
        where: {
          email: { not: '' },
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      console.error("Error fetching customer records:", error);
      customerRecords = [];
    }

    // Combine and deduplicate by email
    const customerMap = new Map<string, { id: string; email: string; name: string }>();
    
    // Add account customers
    accountCustomers.forEach((account) => {
      if (account.email) {
        customerMap.set(account.email.toLowerCase(), {
          id: account.id,
          email: account.email,
          name: account.name || account.email,
        });
      }
    });
    
    // Add customer records
    customerRecords.forEach((customer) => {
      if (customer.email) {
        const email = customer.email.toLowerCase();
        if (!customerMap.has(email)) {
          customerMap.set(email, {
            id: customer.id,
            email: customer.email,
            name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email,
          });
        }
      }
    });

    // Add order emails that aren't in accounts or customers
    orderEmails.forEach((order: any) => {
      if (order.customerEmail) {
        const email = order.customerEmail.toLowerCase();
        if (!customerMap.has(email)) {
          customerMap.set(email, {
            id: `order_${order.customerEmail}`, // Temporary ID for non-registered customers
            email: order.customerEmail,
            name: order.customerName || order.customerEmail,
          });
        }
      }
    });

    const allCustomers = Array.from(customerMap.values());

    console.log(`Found ${allCustomers.length} unique customers with emails (${accountCustomers.length} accounts, ${customerRecords.length} customer records, ${orderEmails.length} order emails)`);

    return NextResponse.json({ customers: allCustomers });
  } catch (error: any) {
    console.error("Error fetching customers:", error);
    return NextResponse.json(
      { error: "Failed to fetch customers" },
      { status: 500 }
    );
  }
}

// POST - Send Best Deals email to selected customers
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { customerIds, sendToAll = false, manualEmails = [] } = body;

    // Fetch best deal products (limit to 4 for email to prevent clipping)
    const bestDealsRaw = await (prisma as any).$queryRaw`
      SELECT 
        p.id,
        p.name,
        p.sku,
        p.price,
        p."originalPrice",
        p."bestDealPrice",
        p.images,
        p."originalPriceCurrency",
        p."baseCurrency"
      FROM products p
      WHERE p."isBestDeal" = 1 AND p.active = 1
      ORDER BY p."updatedAt" DESC
      LIMIT 4
    `;

    if (!bestDealsRaw || bestDealsRaw.length === 0) {
      return NextResponse.json(
        { error: "No best deal products found. Please add products to Best Deals first." },
        { status: 400 }
      );
    }

    // Get customers to send to
    let recipients: Array<{ email: string; name: string }> = [];
    
    // Add manual emails first
    if (manualEmails && Array.isArray(manualEmails) && manualEmails.length > 0) {
      manualEmails.forEach((email: string) => {
        const trimmedEmail = email.trim().toLowerCase();
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailRegex.test(trimmedEmail)) {
          // Check if email is already in recipients
          if (!recipients.some(r => r.email.toLowerCase() === trimmedEmail)) {
            recipients.push({
              email: trimmedEmail,
              name: trimmedEmail, // Use email as name for manual entries
            });
          }
        }
      });
    }

    if (sendToAll) {
      // Get all customers
      const [customers, orderEmails] = await Promise.all([
        prisma.customer.findMany({
          where: {
            email: { not: '' },
            isActive: true,
          },
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        }).catch(() => []),
        prisma.ecommerceOrder.findMany({
          select: {
            customerEmail: true,
            customerName: true,
          },
          distinct: ['customerEmail'],
          where: {
            customerEmail: { not: '' },
          },
        }).catch(() => []),
      ]);

      const emailMap = new Map<string, string>();
      customers.forEach((c) => {
        if (c.email) {
          emailMap.set(c.email.toLowerCase(), `${c.firstName} ${c.lastName}`.trim());
        }
      });
      orderEmails.forEach((o) => {
        if (o.customerEmail) {
          const email = o.customerEmail.toLowerCase();
          if (!emailMap.has(email)) {
            emailMap.set(email, o.customerName || o.customerEmail);
          }
        }
      });

      const allRecipients = Array.from(emailMap.entries()).map(([email, name]) => ({
        email,
        name,
      }));
      
      // Merge with manual emails, avoiding duplicates
      allRecipients.forEach((recipient) => {
        if (!recipients.some(r => r.email.toLowerCase() === recipient.email.toLowerCase())) {
          recipients.push(recipient);
        }
      });
    } else if (customerIds && Array.isArray(customerIds) && customerIds.length > 0) {
      // Get selected customers
      const [customers, orderEmails] = await Promise.all([
        prisma.customer.findMany({
          where: {
            id: { in: customerIds.filter((id: string) => !id.startsWith('order_')) },
            email: { not: '' },
          },
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        }).catch(() => []),
        prisma.ecommerceOrder.findMany({
          select: {
            customerEmail: true,
            customerName: true,
          },
          distinct: ['customerEmail'],
          where: {
            customerEmail: {
              not: '',
              in: customerIds
                .filter((id: string) => id.startsWith('order_'))
                .map((id: string) => id.replace('order_', '')),
            },
          },
        }).catch(() => []),
      ]);

      customers.forEach((c) => {
        if (c.email) {
          recipients.push({
            email: c.email,
            name: `${c.firstName} ${c.lastName}`.trim(),
          });
        }
      });

      orderEmails.forEach((o) => {
        if (o.customerEmail) {
          const email = o.customerEmail.toLowerCase();
          // Check if email is already in recipients (from manual emails)
          if (!recipients.some(r => r.email.toLowerCase() === email)) {
            recipients.push({
              email: o.customerEmail,
              name: o.customerName || o.customerEmail,
            });
          }
        }
      });
    }
    
    // If no recipients at all (no manual emails, no sendToAll, no selected customers)
    if (recipients.length === 0 && !sendToAll && (!customerIds || customerIds.length === 0)) {
      return NextResponse.json(
        { error: "No recipients selected. Please select customers, add manual emails, or choose 'Send to All'." },
        { status: 400 }
      );
    }

    if (recipients.length === 0) {
      return NextResponse.json(
        { error: "No valid recipients found" },
        { status: 400 }
      );
    }

    // Convert best deal prices and format products
    const { convertCurrency } = await import("@/lib/currency");
    const companyName = await getCompanyName();
    const shopUrl = await getSettingValue("ECOMMERCE_STORE_URL", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");

    const products = await Promise.all(
      (bestDealsRaw as any[]).map(async (row: any) => {
        const priceCurrency = row.originalPriceCurrency || row.baseCurrency || "GHS";
        let priceInGHS = row.bestDealPrice || row.price || 0;
        let originalPriceInGHS = row.price || 0;

        // Convert prices to GHS if needed
        if (!row.bestDealPrice && priceCurrency !== "GHS" && row.price) {
          const priceConversion = await convertCurrency(priceCurrency, "GHS", row.price);
          if (priceConversion) {
            priceInGHS = priceConversion.convertedAmount;
            originalPriceInGHS = priceConversion.convertedAmount;
          }
        } else if (row.bestDealPrice) {
          // bestDealPrice is already in GHS, convert original price
          if (priceCurrency !== "GHS" && row.price) {
            const priceConversion = await convertCurrency(priceCurrency, "GHS", row.price);
            if (priceConversion) {
              originalPriceInGHS = priceConversion.convertedAmount;
            }
          }
        }

        let images: string[] = [];
        if (row.images) {
          try {
            const parsed = JSON.parse(row.images);
            images = Array.isArray(parsed) ? parsed : [row.images];
          } catch {
            images = [row.images];
          }
        }

        // Convert relative image URLs to absolute URLs
        let imageUrl = images[0] || null;
        if (imageUrl) {
          // If image is a relative path, make it absolute
          if (imageUrl.startsWith('/uploads/') || imageUrl.startsWith('uploads/')) {
            imageUrl = `${shopUrl}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
          } else if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
            // Assume it's a relative path
            imageUrl = `${shopUrl}/${imageUrl}`;
          }
        }

        const discount = originalPriceInGHS > priceInGHS && originalPriceInGHS > 0
          ? Math.round(((originalPriceInGHS - priceInGHS) / originalPriceInGHS) * 100)
          : 0;

        return {
          name: row.name,
          sku: row.sku,
          price: Math.round(priceInGHS * 100) / 100,
          originalPrice: Math.round(originalPriceInGHS * 100) / 100,
          discount,
          image: imageUrl,
        };
      })
    );

    // Generate email HTML
    const emailHtml = generateBestDealsEmail(products, companyName, shopUrl);
    const subject = `🔥 Best Deals - Exclusive Discounts on Pool Essentials!`;
    const queueSettings = await getQueueSettings();

    const useQueue =
      queueSettings.emailEnabled &&
      recipients.length >= queueSettings.emailBatchSize;

    if (useQueue) {
      try {
        // Check if queue system is available
        const { isQueueSystemAvailable } = await import('@/lib/queue-service');
        const queueAvailable = await isQueueSystemAvailable();
        
        if (!queueAvailable) {
          // Fall through to synchronous sending
          console.log('Queue system not available, falling back to synchronous sending');
        } else {
          // Create email campaign
          const campaign = await prisma.emailCampaign.create({
            data: {
              name: `Best Deals Email - ${new Date().toLocaleDateString()}`,
              description: `Best Deals email sent to ${recipients.length} recipients`,
              recipients: recipients.map(r => r.email),
              subject,
              message: emailHtml,
              status: 'SENDING',
              userId: session.user.id,
              sentAt: new Date(),
            },
          });

          // Add to queue with batching
          const { jobId, totalBatches, totalRecipients } = await addBulkEmailJob({
            recipients: recipients.map(r => r.email),
            subject,
            message: emailHtml,
            userId: session.user.id,
            campaignId: campaign.id,
            batchSize: queueSettings.emailBatchSize,
            delayBetweenBatches: queueSettings.emailDelayMs,
          });

          return NextResponse.json({
            success: true,
            message: `Best Deals email job queued successfully. ${totalRecipients} emails will be sent in ${totalBatches} batches.`,
            jobId,
            totalRecipients,
            totalBatches,
            queued: true,
          });
        }
      } catch (error) {
        // Queue system not available, fall back to synchronous sending
        console.warn('Queue system error, falling back to synchronous sending:', error);
      }
    }
    
    // Synchronous sending (fallback or small batches)
    {
      // For small batches, send directly (synchronous)
      const results = await Promise.all(
        recipients.map(async (recipient) => {
          try {
            const result = await sendBestDealsEmailDirect(
              recipient.email,
              subject,
              emailHtml
            );
            return {
              email: recipient.email,
              name: recipient.name,
              success: result.success,
              error: result.error,
            };
          } catch (error) {
            return {
              email: recipient.email,
              name: recipient.name,
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            };
          }
        })
      );

      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      return NextResponse.json({
        success: true,
        message: `Emails sent: ${successful} successful, ${failed} failed`,
        results: {
          total: recipients.length,
          successful,
          failed,
          details: results,
        },
      });
    }
  } catch (error: any) {
    console.error("Error sending best deals email:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to send emails" },
      { status: 500 }
    );
  }
}

function generateBestDealsEmail(
  products: Array<{
    name: string;
    sku: string | null;
    price: number;
    originalPrice: number;
    discount: number;
    image: string | null;
  }>,
  companyName: string,
  shopUrl: string
): string {
  // Group products into pairs (2 per row)
  const productRows: Array<Array<typeof products[0]>> = [];
  for (let i = 0; i < products.length; i += 2) {
    productRows.push(products.slice(i, i + 2));
  }

  const productRowsHtml = productRows
    .map(
      (row) => `
    <tr>
      ${row.map(
        (product) => `
      <td style="width:50%;padding:6px 4px;vertical-align:top">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:4px">
          <tr>
            <td style="padding:6px 4px 4px 4px;text-align:center">
              ${product.image ? `<img src="${product.image}" alt="${product.name}" style="max-width:100%;height:90px;width:90px;object-fit:cover;border-radius:3px;border:1px solid #e5e7eb;display:block;margin:0 auto">` : '<div style="width:90px;height:90px;background:#f3f4f6;border-radius:3px;margin:0 auto;border:1px solid #e5e7eb"></div>'}
            </td>
          </tr>
          <tr>
            <td style="padding:0 4px 6px 4px;text-align:center">
              <h3 style="margin:0 0 3px 0;color:#111827;font-size:11px;font-weight:600;line-height:1.2">${product.name}</h3>
              ${product.discount > 0 ? `<div style="margin:3px 0"><span style="background:#ef4444;color:white;padding:2px 5px;border-radius:2px;font-size:9px;font-weight:bold;display:inline-block">${product.discount}% OFF</span></div>` : ''}
              <div style="margin-top:5px">
                <div style="margin-bottom:1px">
                  <span style="font-size:15px;font-weight:bold;color:#dc2626">GH₵${product.price.toFixed(2)}</span>
                </div>
                ${product.originalPrice > product.price ? `<div style="text-decoration:line-through;color:#9ca3af;font-size:10px">GH₵${product.originalPrice.toFixed(2)}</div>` : ''}
              </div>
            </td>
          </tr>
        </table>
      </td>
      `
      ).join('')}
    </tr>
  `
    )
    .join("");

  // Compact email HTML to prevent clipping
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin:0;padding:0;font-family:Arial,sans-serif;background-color:#ffffff"><table width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;padding:8px"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:6px;overflow:hidden"><tr><td style="background:linear-gradient(135deg,#23185c 0%,#4c1d95 100%);padding:12px 15px;text-align:center"><h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:bold">🔥 Best Deals</h1><p style="margin:2px 0 0 0;color:#e0e7ff;font-size:11px">Exclusive discounts on poolside essentials</p></td></tr><tr><td style="padding:10px 15px"><p style="margin:0 0 8px 0;color:#374151;font-size:12px;line-height:1.3">Don't miss out on these amazing discounts! Limited time offers!</p><table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:8px 0">${productRowsHtml}</table><table width="100%" cellpadding="0" cellspacing="0" style="margin:10px 0 6px 0"><tr><td align="center"><a href="${shopUrl}/shop?sort=deals" style="display:inline-block;background-color:#23185c;color:#ffffff;padding:10px 24px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:13px">Shop Best Deals Now →</a></td></tr></table><p style="margin:6px 0 0 0;color:#6b7280;font-size:10px;text-align:center;line-height:1.3">Happy shopping! - The ${companyName} Team</p></td></tr><tr><td style="background-color:#f9fafb;padding:6px 15px;text-align:center;border-top:1px solid #e5e7eb"><p style="margin:0;color:#9ca3af;font-size:9px;line-height:1.3">You're receiving this email because you're a valued customer of ${companyName}.<br><a href="${shopUrl}" style="color:#23185c;text-decoration:none">Visit our store</a> | <a href="${shopUrl}/shop/account" style="color:#23185c;text-decoration:none">Manage preferences</a></p></td></tr></table></td></tr></table></body></html>`;
}

