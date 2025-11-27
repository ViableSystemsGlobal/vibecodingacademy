import { prisma } from '@/lib/prisma';
import nodemailer from 'nodemailer';
import { generateEmailTemplate, generatePlainText } from './email-template';

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

// Helper function to get company name from system settings
export async function getCompanyName(): Promise<string> {
  try {
    const setting = await prisma.systemSettings.findUnique({
      where: { key: 'company_name' },
      select: { value: true }
    });
    return setting?.value || '';
  } catch (error) {
    console.error('Error fetching company name:', error);
    return '';
  }
}

// Helper function to send email via SMTP
export async function sendEmailViaSMTP(
  recipient: string,
  subject: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    console.log(`📧 sendEmailViaSMTP: Starting email send to ${recipient}`);
    const smtpHost = await getSettingValue('SMTP_HOST', '');
    const smtpPort = await getSettingValue('SMTP_PORT', '587');
    const smtpUsername = await getSettingValue('SMTP_USERNAME', '');
    const smtpPassword = await getSettingValue('SMTP_PASSWORD', '');
    const smtpFromAddress = await getSettingValue('SMTP_FROM_ADDRESS', '');
    const companyName = await getCompanyName();
    const smtpFromName = await getSettingValue('SMTP_FROM_NAME', companyName || '');
    const smtpEncryption = await getSettingValue('SMTP_ENCRYPTION', 'tls');

    console.log(`📧 sendEmailViaSMTP: SMTP Config - Host: ${smtpHost}, Port: ${smtpPort}, From: ${smtpFromAddress}, Username: ${smtpUsername ? '***' : 'NOT SET'}`);

    if (!smtpHost || !smtpUsername || !smtpPassword || !smtpFromAddress) {
      console.error('❌ sendEmailViaSMTP: Email configuration not found');
      console.error('❌ Missing:', {
        host: !smtpHost,
        username: !smtpUsername,
        password: !smtpPassword,
        fromAddress: !smtpFromAddress
      });
      return { success: false, error: 'Email configuration not found' };
    }

    console.log(`📧 sendEmailViaSMTP: Creating transporter...`);
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort),
      secure: smtpEncryption === 'ssl',
      auth: {
        user: smtpUsername,
        pass: smtpPassword,
      },
    });

    // Convert message to HTML if it's plain text
    const messageHtml = message.includes('<') && message.includes('>') 
      ? message 
      : message.replace(/\n/g, '<br>');
    
    console.log(`📧 sendEmailViaSMTP: Generating email template...`);
    // Generate email template with theme colors
    const htmlContent = await generateEmailTemplate(messageHtml);
    
    // Generate plain text version
    const plainText = generatePlainText(message);

    console.log(`📧 sendEmailViaSMTP: Sending email via SMTP...`);
    const result = await transporter.sendMail({
      from: `"${smtpFromName}" <${smtpFromAddress}>`,
      to: recipient,
      subject: subject,
      text: plainText,
      html: htmlContent,
    });

    console.log(`✅ sendEmailViaSMTP: Email sent successfully! Message ID: ${result.messageId}`);
    console.log(`✅ sendEmailViaSMTP: Response:`, result.response);

    return {
      success: true,
      messageId: result.messageId
    };
  } catch (error) {
    console.error('❌ sendEmailViaSMTP: Error sending email:', error);
    console.error('❌ sendEmailViaSMTP: Error details:', error instanceof Error ? error.message : 'Unknown error');
    console.error('❌ sendEmailViaSMTP: Error stack:', error instanceof Error ? error.stack : 'No stack');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Helper function to send SMS via Deywuro
export async function sendSmsViaDeywuro(
  phoneNumber: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const username = await getSettingValue('SMS_USERNAME', '');
    const password = await getSettingValue('SMS_PASSWORD', '');
    const companyName = await getCompanyName();
    const senderId = await getSettingValue('SMS_SENDER_ID', companyName || '');

    if (!username || !password) {
      console.log('SMS configuration not found, skipping SMS notification');
      return { success: false, error: 'SMS configuration not found' };
    }

    // Clean phone number
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      return { success: false, error: 'Invalid phone number format' };
    }

    const response = await fetch('https://deywuro.com/api/sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        username: username,
        password: password,
        destination: phoneNumber,
        source: senderId,
        message: message
      })
    });

    const responseText = await response.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      return {
        success: false,
        error: `SMS provider returned non-JSON response: ${response.status}`
      };
    }

    if (result.code === 0) {
      return {
        success: true,
        messageId: result.id || `deywuro_${Date.now()}`
      };
    } else {
      return {
        success: false,
        error: `SMS failed: ${result.message || 'Unknown error'}`
      };
    }
  } catch (error) {
    console.error('Error sending SMS:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Send email and SMS notifications when payment is added for an invoice
 */
export async function sendPaymentNotifications(
  invoice: any,
  payment: any,
  account: any
): Promise<void> {
  try {
    // Get customer email and phone
    const customerEmail = account?.email || null;
    const customerPhone = account?.phone || null;

    if (!customerEmail && !customerPhone) {
      console.log('No email or phone found for customer, skipping notifications');
      return;
    }

    // Format payment amount
    const paymentAmount = new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
      minimumFractionDigits: 2
    }).format(Number(payment.amount));

    // Format invoice total
    const invoiceTotal = new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
      minimumFractionDigits: 2
    }).format(Number(invoice.total));

    // Format amount due
    const amountDue = new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
      minimumFractionDigits: 2
    }).format(Number(invoice.amountDue || 0));

    // Email content
    if (customerEmail) {
      const emailSubject = `Payment Received - Invoice ${invoice.number}`;
      const emailMessage = `Dear ${account.name || 'Valued Customer'},

We have received your payment of ${paymentAmount} for Invoice ${invoice.number}.

Payment Details:
- Payment Number: ${payment.number}
- Payment Method: ${payment.method}
- Payment Date: ${new Date(payment.receivedAt).toLocaleDateString()}
${payment.reference ? `- Reference: ${payment.reference}` : ''}

Invoice Details:
- Invoice Number: ${invoice.number}
- Invoice Total: ${invoiceTotal}
- Amount Due: ${amountDue}

${invoice.amountDue > 0.01 ? `Remaining Balance: ${amountDue}` : 'This invoice is now fully paid. Thank you!'}

Thank you for your payment.

Best regards,
${await getCompanyName()}`;

      const emailResult = await sendEmailViaSMTP(customerEmail, emailSubject, emailMessage);
      if (emailResult.success) {
        console.log(`✅ Payment notification email sent to ${customerEmail}`);
      } else {
        console.error(`❌ Failed to send payment notification email: ${emailResult.error}`);
      }
    }

    // SMS content
    if (customerPhone) {
      const smsMessage = `Payment of ${paymentAmount} received for Invoice ${invoice.number}. ${invoice.amountDue > 0.01 ? `Balance: ${amountDue}` : 'Invoice fully paid.'} - ${await getCompanyName()}`;
      
      const smsResult = await sendSmsViaDeywuro(customerPhone, smsMessage);
      if (smsResult.success) {
        console.log(`✅ Payment notification SMS sent to ${customerPhone}`);
      } else {
        console.error(`❌ Failed to send payment notification SMS: ${smsResult.error}`);
      }
    }
  } catch (error) {
    console.error('Error sending payment notifications:', error);
    // Don't throw - we don't want to fail the payment if notifications fail
  }
}

/**
 * Send email and SMS notifications when an order is created
 */
export async function sendOrderCreatedNotifications(
  order: any,
  customer: any,
  isEcommerce: boolean = false
): Promise<void> {
  try {
    // Check ecommerce email settings if this is an ecommerce order
    if (isEcommerce) {
      const sendOrderConfirmation = (await getSettingValue("ECOMMERCE_SEND_ORDER_CONFIRMATION", "true")) === "true";
      if (!sendOrderConfirmation) {
        console.log('Order confirmation emails are disabled in ecommerce settings');
        return;
      }
    }

    // Get customer email and phone
    const customerEmail = customer?.email || null;
    const customerPhone = customer?.phone || null;

    if (!customerEmail && !customerPhone) {
      console.log('No email or phone found for customer, skipping notifications');
      return;
    }

    // Format order total
    const orderTotal = new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
      minimumFractionDigits: 2
    }).format(Number(order.totalAmount || order.total || 0));

    const orderNumber = order.orderNumber || order.number || 'N/A';
    const customerName = customer?.name || customer?.businessName || 'Valued Customer';

    // Email content
    if (customerEmail) {
      const emailSubject = `Order Confirmation - ${orderNumber}`;
      const emailMessage = `Dear ${customerName},

Thank you for your order! We have received your order ${orderNumber}.

Order Details:
- Order Number: ${orderNumber}
- Order Date: ${new Date(order.createdAt).toLocaleDateString()}
- Order Total: ${orderTotal}
- Status: ${order.status || 'PENDING'}

${order.deliveryAddress ? `Delivery Address: ${order.deliveryAddress}` : ''}
${order.deliveryDate ? `Expected Delivery Date: ${new Date(order.deliveryDate).toLocaleDateString()}` : ''}

We will process your order and notify you of any updates.

Thank you for your business!

Best regards,
${await getCompanyName()}`;

      const emailResult = await sendEmailViaSMTP(customerEmail, emailSubject, emailMessage);
      if (emailResult.success) {
        console.log(`✅ Order creation email sent to ${customerEmail}`);
      } else {
        console.error(`❌ Failed to send order creation email: ${emailResult.error}`);
      }
    }

    // SMS content
    if (customerPhone) {
      const smsMessage = `Order ${orderNumber} confirmed. Total: ${orderTotal}. Status: ${order.status || 'PENDING'}. We'll notify you of updates. - ${await getCompanyName()}`;
      
      const smsResult = await sendSmsViaDeywuro(customerPhone, smsMessage);
      if (smsResult.success) {
        console.log(`✅ Order creation SMS sent to ${customerPhone}`);
      } else {
        console.error(`❌ Failed to send order creation SMS: ${smsResult.error}`);
      }
    }
  } catch (error) {
    console.error('Error sending order creation notifications:', error);
    // Don't throw - we don't want to fail the order creation if notifications fail
  }
}

/**
 * Send email and SMS notifications when order status changes
 */
export async function sendOrderStatusChangeNotifications(
  order: any,
  oldStatus: string,
  newStatus: string,
  customer: any,
  isEcommerce: boolean = false
): Promise<void> {
  try {
    // Check ecommerce email settings if this is an ecommerce order
    if (isEcommerce) {
      const sendOrderStatusUpdates = (await getSettingValue("ECOMMERCE_SEND_ORDER_STATUS_UPDATES", "true")) === "true";
      const sendShippingNotifications = (await getSettingValue("ECOMMERCE_SEND_SHIPPING_NOTIFICATIONS", "true")) === "true";
      
      // Check if we should send notification based on status change
      const isShipping = newStatus.toUpperCase().includes('SHIPPED') || newStatus.toUpperCase() === 'READY_TO_SHIP';
      const isStatusUpdate = !isShipping;
      
      if (isShipping && !sendShippingNotifications) {
        console.log('Shipping notifications are disabled in ecommerce settings');
        return;
      }
      
      if (isStatusUpdate && !sendOrderStatusUpdates) {
        console.log('Order status update emails are disabled in ecommerce settings');
        return;
      }
    }

    // Get customer email and phone
    const customerEmail = customer?.email || null;
    const customerPhone = customer?.phone || null;

    if (!customerEmail && !customerPhone) {
      console.log('No email or phone found for customer, skipping notifications');
      return;
    }

    const orderNumber = order.orderNumber || order.number || 'N/A';
    const customerName = customer?.name || customer?.businessName || 'Valued Customer';

    // Format order total
    const orderTotal = new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
      minimumFractionDigits: 2
    }).format(Number(order.totalAmount || order.total || 0));

    // Email content
    if (customerEmail) {
      const emailSubject = `Order Status Update - ${orderNumber}`;
      const emailMessage = `Dear ${customerName},

Your order status has been updated.

Order Details:
- Order Number: ${orderNumber}
- Previous Status: ${oldStatus}
- New Status: ${newStatus}
- Order Total: ${orderTotal}

${order.deliveryDate ? `Expected Delivery Date: ${new Date(order.deliveryDate).toLocaleDateString()}` : ''}
${order.deliveryAddress ? `Delivery Address: ${order.deliveryAddress}` : ''}

We will keep you informed of any further updates.

Best regards,
${await getCompanyName()}`;

      const emailResult = await sendEmailViaSMTP(customerEmail, emailSubject, emailMessage);
      if (emailResult.success) {
        console.log(`✅ Order status change email sent to ${customerEmail}`);
      } else {
        console.error(`❌ Failed to send order status change email: ${emailResult.error}`);
      }
    }

    // SMS content
    if (customerPhone) {
      const smsMessage = `Order ${orderNumber} status updated: ${oldStatus} → ${newStatus}. ${order.deliveryDate ? `Expected delivery: ${new Date(order.deliveryDate).toLocaleDateString()}` : ''} - ${await getCompanyName()}`;
      
      const smsResult = await sendSmsViaDeywuro(customerPhone, smsMessage);
      if (smsResult.success) {
        console.log(`✅ Order status change SMS sent to ${customerPhone}`);
      } else {
        console.error(`❌ Failed to send order status change SMS: ${smsResult.error}`);
      }
    }
  } catch (error) {
    console.error('Error sending order status change notifications:', error);
    // Don't throw - we don't want to fail the order update if notifications fail
  }
}

