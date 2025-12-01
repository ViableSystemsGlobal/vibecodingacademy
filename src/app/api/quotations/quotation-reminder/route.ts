import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendEmailViaSMTP, sendSmsViaDeywuro, getCompanyName } from '@/lib/payment-order-notifications';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      quotationId,
      customerEmail,
      customerPhone,
      customerName,
      quotationNumber,
      quotationSubject,
      quotationTotal,
      validUntil,
      currency
    } = body;

    if (!quotationId || !customerName) {
      return NextResponse.json({ error: 'Quotation ID and customer name are required' }, { status: 400 });
    }

    if (!customerEmail && !customerPhone) {
      return NextResponse.json({ error: 'Customer email or phone is required' }, { status: 400 });
    }

    const companyName = await getCompanyName();
    const currencySymbol = currency === 'GHS' ? 'GHS' : (currency === 'USD' ? '$' : currency);
    const currencySymbolEmail = currency === 'GHS' ? 'GH₵' : (currency === 'USD' ? '$' : currency);
    const validUntilDate = validUntil ? new Date(validUntil).toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric' 
    }) : '';

    // Prepare email and SMS messages
    const emailSubject = `Follow-up on Your Quotation Request - ${quotationNumber}`;
    const emailMessage = `Dear ${customerName},

We hope this message finds you well.

We wanted to follow up on your quotation inquiry for ${quotationSubject || 'your request'}.

Quotation Details:
- Quotation Number: ${quotationNumber}
- Subject: ${quotationSubject || 'N/A'}
- Total Amount: ${currencySymbolEmail}${quotationTotal.toFixed(2)}
${validUntilDate ? `- Valid Until: ${validUntilDate}` : ''}

We're reaching out to see if you'd like to proceed with this quotation. We're here to answer any questions you may have and help you move forward.

If you're ready to proceed, please let us know and we'll be happy to assist you with the next steps. If you have any questions or need any modifications to the quotation, please don't hesitate to contact us.

We look forward to hearing from you and the opportunity to serve you.

Best regards,
${companyName || 'Team'}`;

    const smsMessage = `Dear ${customerName}, We're following up on your quotation ${quotationNumber} (${currencySymbol} ${quotationTotal.toFixed(2)}). Would you like to proceed? ${companyName || ''}`;

    // Send notifications
    const results = await Promise.allSettled([
      customerEmail ? sendEmailViaSMTP(customerEmail, emailSubject, emailMessage) : Promise.resolve({ success: false, error: 'No email' }),
      customerPhone ? sendSmsViaDeywuro(customerPhone, smsMessage) : Promise.resolve({ success: false, error: 'No phone' })
    ]);

    const emailResult = results[0].status === 'fulfilled' ? results[0].value : { success: false, error: 'Email failed' };
    const smsResult = results[1].status === 'fulfilled' ? results[1].value : { success: false, error: 'SMS failed' };

    const emailSent = emailResult.success;
    const smsSent = smsResult.success;

    if (!emailSent && !smsSent) {
      return NextResponse.json({ 
        error: 'Failed to send quotation reminder via both email and SMS',
        details: { email: emailResult.error, sms: smsResult.error }
      }, { status: 500 });
    }

    const message = [
      emailSent ? 'Email sent' : 'Email failed',
      smsSent ? 'SMS sent' : 'SMS failed'
    ].filter(Boolean).join(', ');

    return NextResponse.json({
      success: true,
      message: `Quotation reminder sent: ${message}`,
      emailSent,
      smsSent
    });

  } catch (error) {
    console.error('Error sending quotation reminder:', error);
    return NextResponse.json({ 
      error: 'Failed to send quotation reminder',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

