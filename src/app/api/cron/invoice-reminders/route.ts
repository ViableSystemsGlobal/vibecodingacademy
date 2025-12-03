import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmailViaSMTP, sendSmsViaDeywuro, getCompanyName } from '@/lib/payment-order-notifications';

// POST /api/cron/invoice-reminders - Cron job endpoint for invoice payment reminders
export async function POST(request: NextRequest) {
  try {
    // Verify the request is from a legitimate cron service
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log('💰 Invoice Reminders Cron: Processing reminders...');
    
    // Check if invoice reminders are enabled
    const remindersEnabled = await prisma.systemSettings.findUnique({
      where: { key: 'invoice_reminders_enabled' },
      select: { value: true }
    });

    if (remindersEnabled?.value !== 'true') {
      console.log('💰 Invoice Reminders Cron: Reminders are disabled');
      return NextResponse.json({ 
        message: "Invoice reminders are disabled",
        timestamp: new Date().toISOString()
      });
    }

    // Get reminder settings
    const reminderDaysAfterDueSetting = await prisma.systemSettings.findUnique({
      where: { key: 'invoice_reminder_days_after_due' },
      select: { value: true }
    });
    const reminderDaysAfterDue = parseInt(reminderDaysAfterDueSetting?.value || '7', 10); // Default: 7 days after due date

    const reminderIntervalSetting = await prisma.systemSettings.findUnique({
      where: { key: 'invoice_reminder_interval_days' },
      select: { value: true }
    });
    const reminderIntervalDays = parseInt(reminderIntervalSetting?.value || '7', 10); // Default: 7 days between reminders

    // Calculate date threshold
    const now = new Date();
    const dueDateThreshold = new Date(now);
    dueDateThreshold.setDate(dueDateThreshold.getDate() - reminderDaysAfterDue);
    
    // Get invoices that:
    // 1. Are not fully paid (paymentStatus is UNPAID or PARTIALLY_PAID)
    // 2. Are not void or draft (status is SENT or OVERDUE)
    // 3. Due date was at least X days ago
    // 4. Either never had a reminder sent, or last reminder was more than interval days ago
    const intervalAgo = new Date(now);
    intervalAgo.setDate(intervalAgo.getDate() - reminderIntervalDays);

    const invoices = await prisma.invoice.findMany({
      where: {
        paymentStatus: {
          in: ['UNPAID', 'PARTIALLY_PAID'] // Not fully paid
        },
        status: {
          in: ['SENT', 'OVERDUE'] // Not void or draft
        },
        dueDate: {
          lte: dueDateThreshold // Due date was at least X days ago
        },
        OR: [
          { lastReminderSentAt: null }, // Never sent a reminder
          { lastReminderSentAt: { lt: intervalAgo } } // Last reminder was more than interval days ago
        ]
      },
      include: {
        lead: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true
          }
        },
        account: {
          select: {
            name: true,
            contacts: {
              take: 1,
              select: {
                email: true,
                phone: true
              }
            }
          }
        },
        contact: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true
          }
        },
        owner: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    console.log(`💰 Found ${invoices.length} invoices needing payment reminders`);

    if (invoices.length === 0) {
      return NextResponse.json({ 
        message: "No invoices found needing reminders",
        timestamp: new Date().toISOString(),
        count: 0
      });
    }

    const companyName = await getCompanyName();
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const invoice of invoices) {
      try {
        // Determine customer contact info
        let customerName = '';
        let customerEmail = '';
        let customerPhone = '';

        if (invoice.lead) {
          customerName = `${invoice.lead.firstName || ''} ${invoice.lead.lastName || ''}`.trim();
          customerEmail = invoice.lead.email || '';
          customerPhone = invoice.lead.phone || '';
        } else if (invoice.contact) {
          customerName = `${invoice.contact.firstName || ''} ${invoice.contact.lastName || ''}`.trim();
          customerEmail = invoice.contact.email || '';
          customerPhone = invoice.contact.phone || '';
        } else if (invoice.account) {
          customerName = invoice.account.name || '';
          const primaryContact = invoice.account.contacts[0];
          if (primaryContact) {
            customerEmail = primaryContact.email || '';
            customerPhone = primaryContact.phone || '';
          }
        }

        if (!customerName || (!customerEmail && !customerPhone)) {
          console.log(`⚠️ Skipping invoice ${invoice.number}: No valid contact info`);
          continue;
        }

        const currencySymbol = invoice.currency === 'GHS' ? 'GHS' : (invoice.currency === 'USD' ? '$' : invoice.currency);
        const currencySymbolEmail = invoice.currency === 'GHS' ? 'GH₵' : (invoice.currency === 'USD' ? '$' : invoice.currency);
        const dueDate = new Date(invoice.dueDate).toLocaleDateString('en-GB', { 
          day: '2-digit', 
          month: 'long', 
          year: 'numeric' 
        });
        const daysOverdue = Math.floor((now.getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24));

        // Calculate amount due
        const amountDue = invoice.total - invoice.amountPaid;
        const isPartiallyPaid = invoice.paymentStatus === 'PARTIALLY_PAID';

        // Prepare email and SMS messages
        const emailSubject = `Payment Reminder - Invoice ${invoice.number}`;
        const emailMessage = `Dear ${customerName},

We hope this message finds you well.

This is a friendly reminder regarding your outstanding invoice.

Invoice Details:
- Invoice Number: ${invoice.number}
- Subject: ${invoice.subject || 'N/A'}
- Total Amount: ${currencySymbolEmail}${invoice.total.toFixed(2)}
${isPartiallyPaid ? `- Amount Paid: ${currencySymbolEmail}${invoice.amountPaid.toFixed(2)}` : ''}
- Amount Due: ${currencySymbolEmail}${amountDue.toFixed(2)}
- Due Date: ${dueDate}
${daysOverdue > 0 ? `- Days Overdue: ${daysOverdue}` : ''}

${isPartiallyPaid 
  ? 'We appreciate your partial payment. Please complete the remaining balance at your earliest convenience.'
  : 'Please arrange payment at your earliest convenience to avoid any service interruptions.'}

If you have already made payment, please ignore this reminder. If you have any questions or concerns, please don't hesitate to contact us.

Thank you for your prompt attention to this matter.

Best regards,
${companyName || 'Team'}`;

        const smsMessage = `Dear ${customerName}, Payment reminder for Invoice ${invoice.number}: ${currencySymbol} ${amountDue.toFixed(2)} due${daysOverdue > 0 ? ` (${daysOverdue} days overdue)` : ''}. ${companyName || ''}`;

        // Send notifications
        const results = await Promise.allSettled([
          customerEmail ? sendEmailViaSMTP(customerEmail, emailSubject, emailMessage) : Promise.resolve({ success: false, error: 'No email' }),
          customerPhone ? sendSmsViaDeywuro(customerPhone, smsMessage) : Promise.resolve({ success: false, error: 'No phone' })
        ]);

        const emailResult = results[0].status === 'fulfilled' ? results[0].value : { success: false, error: 'Email failed' };
        const smsResult = results[1].status === 'fulfilled' ? results[1].value : { success: false, error: 'SMS failed' };

        if (emailResult.success || smsResult.success) {
          // Update invoice with reminder sent timestamp
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              lastReminderSentAt: new Date(),
              reminderCount: { increment: 1 }
            }
          });

          successCount++;
          console.log(`✅ Reminder sent for invoice ${invoice.number}`);
        } else {
          errorCount++;
          const errorMsg = `Failed to send reminder for invoice ${invoice.number}: ${emailResult.error || smsResult.error}`;
          errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
        }
      } catch (error) {
        errorCount++;
        const errorMsg = `Error processing invoice ${invoice.number}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }
    }

    return NextResponse.json({ 
      message: `Invoice reminders processed: ${successCount} sent, ${errorCount} failed`,
      timestamp: new Date().toISOString(),
      successCount,
      errorCount,
      total: invoices.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('❌ Invoice Reminders Cron Error:', error);
    return NextResponse.json(
      { 
        error: "Failed to process invoice reminders",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET /api/cron/invoice-reminders - Health check endpoint
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({ 
      message: "Invoice Reminders Cron endpoint is active",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Invoice Reminders Cron health check error:', error);
    return NextResponse.json(
      { error: "Health check failed" },
      { status: 500 }
    );
  }
}

