import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmailViaSMTP, sendSmsViaDeywuro, getCompanyName } from '@/lib/payment-order-notifications';

// POST /api/cron/quotation-reminders - Cron job endpoint for quotation reminders
export async function POST(request: NextRequest) {
  try {
    // Verify the request is from a legitimate cron service
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log('📋 Quotation Reminders Cron: Processing reminders...');
    
    // Check if quotation reminders are enabled
    const remindersEnabled = await prisma.systemSettings.findUnique({
      where: { key: 'quotation_reminders_enabled' },
      select: { value: true }
    });

    if (remindersEnabled?.value !== 'true') {
      console.log('📋 Quotation Reminders Cron: Reminders are disabled');
      return NextResponse.json({ 
        message: "Quotation reminders are disabled",
        timestamp: new Date().toISOString()
      });
    }

    // Get reminder settings
    const reminderDaysSetting = await prisma.systemSettings.findUnique({
      where: { key: 'quotation_reminder_days' },
      select: { value: true }
    });
    const reminderDays = parseInt(reminderDaysSetting?.value || '7', 10); // Default: 7 days

    const reminderIntervalSetting = await prisma.systemSettings.findUnique({
      where: { key: 'quotation_reminder_interval_days' },
      select: { value: true }
    });
    const reminderIntervalDays = parseInt(reminderIntervalSetting?.value || '7', 10); // Default: 7 days between reminders

    // Calculate date threshold
    const now = new Date();
    const daysAgo = new Date(now);
    daysAgo.setDate(daysAgo.getDate() - reminderDays);
    
    // Get quotations that:
    // 1. Are not won (status is not ACCEPTED)
    // 2. Were sent at least X days ago
    // 3. Either never had a reminder sent, or last reminder was more than interval days ago
    const intervalAgo = new Date(now);
    intervalAgo.setDate(intervalAgo.getDate() - reminderIntervalDays);

    const quotations = await prisma.quotation.findMany({
      where: {
        status: {
          in: ['DRAFT', 'SENT', 'REJECTED', 'EXPIRED'] // Not won
        },
        createdAt: {
          lte: daysAgo // Created at least X days ago
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
              where: { isPrimary: true },
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

    console.log(`📋 Found ${quotations.length} quotations needing reminders`);

    if (quotations.length === 0) {
      return NextResponse.json({ 
        message: "No quotations found needing reminders",
        timestamp: new Date().toISOString(),
        count: 0
      });
    }

    const companyName = await getCompanyName();
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const quotation of quotations) {
      try {
        // Determine customer contact info
        let customerName = '';
        let customerEmail = '';
        let customerPhone = '';

        if (quotation.lead) {
          customerName = `${quotation.lead.firstName || ''} ${quotation.lead.lastName || ''}`.trim();
          customerEmail = quotation.lead.email || '';
          customerPhone = quotation.lead.phone || '';
        } else if (quotation.contact) {
          customerName = `${quotation.contact.firstName || ''} ${quotation.contact.lastName || ''}`.trim();
          customerEmail = quotation.contact.email || '';
          customerPhone = quotation.contact.phone || '';
        } else if (quotation.account) {
          customerName = quotation.account.name || '';
          const primaryContact = quotation.account.contacts[0];
          if (primaryContact) {
            customerEmail = primaryContact.email || '';
            customerPhone = primaryContact.phone || '';
          }
        }

        if (!customerName || (!customerEmail && !customerPhone)) {
          console.log(`⚠️ Skipping quotation ${quotation.number}: No valid contact info`);
          continue;
        }

        const currencySymbol = quotation.currency === 'GHS' ? 'GH₵' : (quotation.currency === 'USD' ? '$' : quotation.currency);
        const validUntilDate = quotation.validUntil 
          ? new Date(quotation.validUntil).toLocaleDateString('en-GB', { 
              day: '2-digit', 
              month: 'long', 
              year: 'numeric' 
            }) 
          : '';

        // Prepare email and SMS messages
        const emailSubject = `Follow-up on Your Quotation Request - ${quotation.number}`;
        const emailMessage = `Dear ${customerName},

We hope this message finds you well.

We wanted to follow up on your quotation inquiry for ${quotation.subject || 'your request'}.

Quotation Details:
- Quotation Number: ${quotation.number}
- Subject: ${quotation.subject || 'N/A'}
- Total Amount: ${currencySymbol}${quotation.total.toFixed(2)}
${validUntilDate ? `- Valid Until: ${validUntilDate}` : ''}

We're reaching out to see if you'd like to proceed with this quotation. We're here to answer any questions you may have and help you move forward.

If you're ready to proceed, please let us know and we'll be happy to assist you with the next steps. If you have any questions or need any modifications to the quotation, please don't hesitate to contact us.

We look forward to hearing from you and the opportunity to serve you.

Best regards,
${companyName || 'AdPools Group'}`;

        const smsMessage = `Dear ${customerName}, We're following up on your quotation ${quotation.number} (${currencySymbol}${quotation.total.toFixed(2)}). Would you like to proceed? ${companyName || 'AdPools Group'}`;

        // Send notifications
        const results = await Promise.allSettled([
          customerEmail ? sendEmailViaSMTP(customerEmail, emailSubject, emailMessage) : Promise.resolve({ success: false, error: 'No email' }),
          customerPhone ? sendSmsViaDeywuro(customerPhone, smsMessage) : Promise.resolve({ success: false, error: 'No phone' })
        ]);

        const emailResult = results[0].status === 'fulfilled' ? results[0].value : { success: false, error: 'Email failed' };
        const smsResult = results[1].status === 'fulfilled' ? results[1].value : { success: false, error: 'SMS failed' };

        if (emailResult.success || smsResult.success) {
          // Update quotation with reminder sent timestamp
          await prisma.quotation.update({
            where: { id: quotation.id },
            data: {
              lastReminderSentAt: new Date(),
              reminderCount: { increment: 1 }
            }
          });

          successCount++;
          console.log(`✅ Reminder sent for quotation ${quotation.number}`);
        } else {
          errorCount++;
          const errorMsg = `Failed to send reminder for quotation ${quotation.number}: ${emailResult.error || smsResult.error}`;
          errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
        }
      } catch (error) {
        errorCount++;
        const errorMsg = `Error processing quotation ${quotation.number}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }
    }

    return NextResponse.json({ 
      message: `Quotation reminders processed: ${successCount} sent, ${errorCount} failed`,
      timestamp: new Date().toISOString(),
      successCount,
      errorCount,
      total: quotations.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('❌ Quotation Reminders Cron Error:', error);
    return NextResponse.json(
      { 
        error: "Failed to process quotation reminders",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET /api/cron/quotation-reminders - Health check endpoint
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({ 
      message: "Quotation Reminders Cron endpoint is active",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Quotation Reminders Cron health check error:', error);
    return NextResponse.json(
      { error: "Health check failed" },
      { status: 500 }
    );
  }
}

