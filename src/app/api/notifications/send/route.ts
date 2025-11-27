import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import nodemailer from 'nodemailer';

// Notification templates
const NOTIFICATION_TEMPLATES = {
  stock_low: {
    email: {
      subject: 'Low Stock Alert - {productName}',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #f59e0b;">⚠️ Low Stock Alert</h2>
          <p>The following product is running low on stock:</p>
          <div style="background: #fef3c7; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <strong>Product:</strong> {productName}<br>
            <strong>Current Stock:</strong> {currentStock}<br>
            <strong>Reorder Point:</strong> {reorderPoint}
          </div>
          <p>Please reorder this product to avoid stockouts.</p>
          <p style="color: #666; font-size: 12px;">Sent at: {timestamp}</p>
        </div>
      `
    },
    sms: 'LOW STOCK ALERT: {productName} has {currentStock} units remaining. Reorder point: {reorderPoint}. Please restock soon.'
  },
  stock_out: {
    email: {
      subject: 'Out of Stock Alert - {productName}',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">🚨 Out of Stock Alert</h2>
          <p>The following product is completely out of stock:</p>
          <div style="background: #fee2e2; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <strong>Product:</strong> {productName}<br>
            <strong>Current Stock:</strong> 0 units
          </div>
          <p>Immediate restocking required!</p>
          <p style="color: #666; font-size: 12px;">Sent at: {timestamp}</p>
        </div>
      `
    },
    sms: 'OUT OF STOCK: {productName} is completely out of stock. Immediate restocking required!'
  },
  new_order: {
    email: {
      subject: 'New Order Received - #{orderNumber}',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #059669;">📦 New Order Received</h2>
          <p>A new order has been placed:</p>
          <div style="background: #d1fae5; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <strong>Order Number:</strong> #{orderNumber}<br>
            <strong>Customer:</strong> {customerName}<br>
            <strong>Total Amount:</strong> {totalAmount}
          </div>
          <p>Please process this order promptly.</p>
          <p style="color: #666; font-size: 12px;">Sent at: {timestamp}</p>
        </div>
      `
    },
    sms: 'NEW ORDER: #{orderNumber} from {customerName}. Amount: {totalAmount}. Please process promptly.'
  },
  payment_received: {
    email: {
      subject: 'Payment Received - #{orderNumber}',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #059669;">💰 Payment Received</h2>
          <p>Payment has been received for order:</p>
          <div style="background: #d1fae5; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <strong>Order Number:</strong> #{orderNumber}<br>
            <strong>Amount:</strong> {amount}<br>
            <strong>Payment Method:</strong> {paymentMethod}
          </div>
          <p>Order can now be processed for fulfillment.</p>
          <p style="color: #666; font-size: 12px;">Sent at: {timestamp}</p>
        </div>
      `
    },
    sms: 'PAYMENT RECEIVED: {amount} for order #{orderNumber} via {paymentMethod}. Ready for fulfillment.'
  },
  user_created: {
    email: {
      subject: 'New User Account Created',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3b82f6;">👤 New User Account</h2>
          <p>A new user account has been created:</p>
          <div style="background: #dbeafe; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <strong>Name:</strong> {userName}<br>
            <strong>Email:</strong> {userEmail}<br>
            <strong>Role:</strong> {userRole}
          </div>
          <p style="color: #666; font-size: 12px;">Sent at: {timestamp}</p>
        </div>
      `
    },
    sms: 'NEW USER: {userName} ({userEmail}) created with role: {userRole}'
  }
};

// Helper function to get setting value from database
async function getSettingValue(key: string, defaultValue: string = ''): Promise<string> {
  try {
    const setting = await prisma.systemSettings.findUnique({
      where: { key }
    });
    return setting?.value || process.env[key] || defaultValue;
  } catch (error) {
    return process.env[key] || defaultValue;
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { type, data, test = false, channel, contact } = body;

    if (!type) {
      return NextResponse.json(
        { error: "Notification type is required" },
        { status: 400 }
      );
    }

    // Get notification settings from database
    const emailEnabled = (await getSettingValue('EMAIL_ENABLED', 'false')) === 'true';
    const smsEnabled = (await getSettingValue('SMS_ENABLED', 'false')) === 'true';
    const emailTypeEnabled = (await getSettingValue(`EMAIL_${type.toUpperCase()}`, 'false')) === 'true';
    const smsTypeEnabled = (await getSettingValue(`SMS_${type.toUpperCase()}`, 'false')) === 'true';

    // For test notifications, bypass the enabled checks
    const shouldSendEmail = test ? (!channel || channel === 'email') : (emailEnabled && emailTypeEnabled && (!channel || channel === 'email'));
    const shouldSendSMS = test ? (!channel || channel === 'sms') : (smsEnabled && smsTypeEnabled && (!channel || channel === 'sms'));

    const results = [];

    // Send email notification
    if (shouldSendEmail) {
      const emailResult = await sendEmailNotification(type, data, test, contact);
      results.push({ channel: 'email', ...emailResult });
    }

    // Send SMS notification
    if (shouldSendSMS) {
      const smsResult = await sendSMSNotification(type, data, test, contact);
      results.push({ channel: 'sms', ...smsResult });
    }

    if (results.length === 0) {
      return NextResponse.json({
        success: false,
        message: "No notification channels are enabled for this type"
      });
    }

    return NextResponse.json({
      success: true,
      message: "Notifications processed",
      results
    });
  } catch (error) {
    console.error('Error sending notification:', error);
    return NextResponse.json(
      { error: "Failed to send notification" },
      { status: 500 }
    );
  }
}

async function sendEmailNotification(type: string, data: any, test: boolean, contact?: string) {
  try {
    let template = NOTIFICATION_TEMPLATES[type as keyof typeof NOTIFICATION_TEMPLATES];
    
    // If template doesn't exist, use a generic one
    if (!template) {
      template = {
        email: {
          subject: `Test Notification - ${type}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #3b82f6;">Test Notification</h2>
              <p>This is a test notification for: <strong>${type}</strong></p>
              <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <p><strong>Type:</strong> ${type}</p>
                <p><strong>Test Mode:</strong> ${test ? 'Yes' : 'No'}</p>
                <p><strong>Timestamp:</strong> {timestamp}</p>
              </div>
              <p style="color: #666; font-size: 12px;">Sent at: {timestamp}</p>
            </div>
          `
        },
        sms: `Test notification for ${type}`
      };
    }

    // Get SMTP configuration from database
    const smtpHost = await getSettingValue('SMTP_HOST', '');
    const smtpPort = await getSettingValue('SMTP_PORT', '587');
    const smtpUsername = await getSettingValue('SMTP_USERNAME', '');
    const smtpPassword = await getSettingValue('SMTP_PASSWORD', '');
    const smtpFromAddress = await getSettingValue('SMTP_FROM_ADDRESS', '');
    const smtpFromName = await getSettingValue('SMTP_FROM_NAME', 'AdPools Group');
    const smtpEncryption = await getSettingValue('SMTP_ENCRYPTION', 'tls');

    if (!smtpHost || !smtpUsername || !smtpPassword || !smtpFromAddress) {
      return {
        success: false,
        message: "SMTP configuration not found. Please configure email settings."
      };
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort),
      secure: smtpEncryption === 'ssl',
      auth: {
        user: smtpUsername,
        pass: smtpPassword
      }
    });

    // Replace template variables
    let subject = template.email.subject;
    let html = template.email.html;

    // Add timestamp
    const templateData = {
      ...data,
      timestamp: new Date().toLocaleString()
    };

    // Replace placeholders
    Object.entries(templateData).forEach(([key, value]) => {
      const placeholder = `{${key}}`;
      subject = subject.replace(new RegExp(placeholder, 'g'), String(value));
      html = html.replace(new RegExp(placeholder, 'g'), String(value));
    });

    const recipient = contact || smtpFromAddress;
    if (!recipient) {
      return {
        success: false,
        message: "Email recipient is required"
      };
    }

    // Send email
    const info = await transporter.sendMail({
      from: `"${smtpFromName}" <${smtpFromAddress}>`,
      to: recipient,
      subject: test ? `[TEST] ${subject}` : subject,
      html: html
    });

    return {
      success: true,
      message: "Email sent successfully",
      messageId: info.messageId
    };
  } catch (error) {
    return {
      success: false,
      message: `Email failed: ${(error as Error).message}`
    };
  }
}

async function sendSMSNotification(type: string, data: any, test: boolean, contact?: string) {
  try {
    let template = NOTIFICATION_TEMPLATES[type as keyof typeof NOTIFICATION_TEMPLATES];
    
    // If template doesn't exist, use a generic one
    if (!template) {
      template = {
        email: {
          subject: `Test Notification - ${type}`,
          html: `<p>Test notification for ${type}</p>`
        },
        sms: `Test notification for ${type}. This is a test message.`
      };
    }

    // Replace template variables
    let message = template.sms;

    Object.entries(data).forEach(([key, value]) => {
      const placeholder = `{${key}}`;
      message = message.replace(new RegExp(placeholder, 'g'), String(value));
    });

    if (test) {
      message = `[TEST] ${message}`;
    }

    const phoneNumber = contact || '';
    if (!phoneNumber) {
      return {
        success: false,
        message: "Phone number is required for SMS"
      };
    }

    // Get SMS configuration from database
    const username = await getSettingValue('SMS_USERNAME', '');
    const password = await getSettingValue('SMS_PASSWORD', '');
    const senderId = await getSettingValue('SMS_SENDER_ID', 'AdPools');

    if (!username || !password) {
      return {
        success: false,
        message: "SMS configuration not found. Please configure SMS settings."
      };
    }

    // Send SMS via Deywuro
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
        message: `SMS provider returned non-JSON response: ${response.status} - ${responseText.substring(0, 100)}...`
      };
    }

    if (result.code === 0) {
    return {
      success: true,
        message: "SMS sent successfully",
        messageId: result.id || `deywuro_${Date.now()}`
      };
    } else {
      return {
        success: false,
        message: `SMS failed: ${result.message || 'Unknown error'}`
    };
    }
  } catch (error) {
    return {
      success: false,
      message: `SMS failed: ${(error as Error).message}`
    };
  }
}
