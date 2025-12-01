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
      invoiceId,
      customerEmail,
      customerPhone,
      customerName,
      invoiceNumber,
      invoiceTotal,
      amountPaid,
      amountDue,
      currency
    } = body;

    if (!invoiceId || !customerName) {
      return NextResponse.json({ error: 'Invoice ID and customer name are required' }, { status: 400 });
    }

    if (!customerEmail && !customerPhone) {
      return NextResponse.json({ error: 'Customer email or phone is required' }, { status: 400 });
    }

    const companyName = await getCompanyName();
    const currencySymbol = currency === 'GHS' ? 'GHS' : (currency === 'USD' ? '$' : currency);
    const currencySymbolEmail = currency === 'GHS' ? 'GH₵' : (currency === 'USD' ? '$' : currency);

    // Prepare email and SMS messages
    const emailSubject = `Receipt Request - Invoice ${invoiceNumber}`;
    const emailMessage = `Dear ${customerName},

We hope this message finds you well.

We are writing to request a receipt or proof of payment for Invoice ${invoiceNumber}.

Invoice Details:
- Invoice Number: ${invoiceNumber}
- Invoice Total: ${currencySymbolEmail}${invoiceTotal.toFixed(2)}
- Amount Paid: ${currencySymbolEmail}${amountPaid.toFixed(2)}
${amountDue > 0 ? `- Amount Due: ${currencySymbolEmail}${amountDue.toFixed(2)}` : ''}

Could you please provide a receipt or proof of payment for the payments made on this invoice? This will help us update our records and ensure all transactions are properly documented.

If you have already sent the receipt, please disregard this message.

Thank you for your cooperation.

Best regards,
${companyName || 'Team'}`;

    const smsMessage = `Dear ${customerName}, Please provide receipt/proof of payment for Invoice ${invoiceNumber} (${currencySymbol} ${amountPaid.toFixed(2)} paid). ${companyName || ''}`;

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
        error: 'Failed to send receipt reminder via both email and SMS',
        details: { email: emailResult.error, sms: smsResult.error }
      }, { status: 500 });
    }

    const message = [
      emailSent ? 'Email sent' : 'Email failed',
      smsSent ? 'SMS sent' : 'SMS failed'
    ].filter(Boolean).join(', ');

    return NextResponse.json({
      success: true,
      message: `Receipt reminder sent: ${message}`,
      emailSent,
      smsSent
    });

  } catch (error) {
    console.error('Error sending receipt reminder:', error);
    return NextResponse.json({ 
      error: 'Failed to send receipt reminder',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

