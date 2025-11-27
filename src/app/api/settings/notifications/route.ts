import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCompanyNameFromSystemSettings } from "@/lib/company-settings";

// Helper function to get setting value from database or environment
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

// GET /api/settings/notifications - Get notification settings
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get settings from database first, fallback to environment variables
    const smtpPassword = await getSettingValue('SMTP_PASSWORD', '');
    const smsPassword = await getSettingValue('SMS_PASSWORD', '');
    
    const settings = {
      email: {
        enabled: (await getSettingValue('EMAIL_ENABLED', 'false')) === 'true',
        smtp: {
          host: await getSettingValue('SMTP_HOST', ''),
          port: await getSettingValue('SMTP_PORT', '587'),
          username: await getSettingValue('SMTP_USERNAME', ''),
          password: smtpPassword && smtpPassword.length > 0 ? '***' : '',
          encryption: await getSettingValue('SMTP_ENCRYPTION', 'tls'),
          fromAddress: await getSettingValue('SMTP_FROM_ADDRESS', ''),
          fromName: await getSettingValue('SMTP_FROM_NAME', 'AdPools Group')
        },
        notifications: {
          // Inventory
          stock_low: (await getSettingValue('EMAIL_STOCK_LOW', 'false')) === 'true',
          stock_out: (await getSettingValue('EMAIL_STOCK_OUT', 'false')) === 'true',
          stock_movement: (await getSettingValue('EMAIL_STOCK_MOVEMENT', 'false')) === 'true',
          warehouse_update: (await getSettingValue('EMAIL_WAREHOUSE_UPDATE', 'false')) === 'true',
          // Orders
          new_order: (await getSettingValue('EMAIL_NEW_ORDER', 'false')) === 'true',
          order_status: (await getSettingValue('EMAIL_ORDER_STATUS', 'false')) === 'true',
          order_cancelled: (await getSettingValue('EMAIL_ORDER_CANCELLED', 'false')) === 'true',
          backorder_created: (await getSettingValue('EMAIL_BACKORDER_CREATED', 'false')) === 'true',
          // Payments
          payment_received: (await getSettingValue('EMAIL_PAYMENT_RECEIVED', 'false')) === 'true',
          payment_failed: (await getSettingValue('EMAIL_PAYMENT_FAILED', 'false')) === 'true',
          payment_refunded: (await getSettingValue('EMAIL_PAYMENT_REFUNDED', 'false')) === 'true',
          // Invoices
          invoice_created: (await getSettingValue('EMAIL_INVOICE_CREATED', 'false')) === 'true',
          invoice_sent: (await getSettingValue('EMAIL_INVOICE_SENT', 'false')) === 'true',
          invoice_overdue: (await getSettingValue('EMAIL_INVOICE_OVERDUE', 'false')) === 'true',
          invoice_paid: (await getSettingValue('EMAIL_INVOICE_PAID', 'false')) === 'true',
          // Quotations
          quotation_created: (await getSettingValue('EMAIL_QUOTATION_CREATED', 'false')) === 'true',
          quotation_sent: (await getSettingValue('EMAIL_QUOTATION_SENT', 'false')) === 'true',
          quotation_accepted: (await getSettingValue('EMAIL_QUOTATION_ACCEPTED', 'false')) === 'true',
          quotation_expired: (await getSettingValue('EMAIL_QUOTATION_EXPIRED', 'false')) === 'true',
          // Projects
          project_created: (await getSettingValue('EMAIL_PROJECT_CREATED', 'false')) === 'true',
          project_updated: (await getSettingValue('EMAIL_PROJECT_UPDATED', 'false')) === 'true',
          project_completed: (await getSettingValue('EMAIL_PROJECT_COMPLETED', 'false')) === 'true',
          project_member_added: (await getSettingValue('EMAIL_PROJECT_MEMBER_ADDED', 'false')) === 'true',
          // Tasks
          task_created: (await getSettingValue('EMAIL_TASK_CREATED', 'false')) === 'true',
          task_assigned: (await getSettingValue('EMAIL_TASK_ASSIGNED', 'false')) === 'true',
          task_due_soon: (await getSettingValue('EMAIL_TASK_DUE_SOON', 'false')) === 'true',
          task_overdue: (await getSettingValue('EMAIL_TASK_OVERDUE', 'false')) === 'true',
          task_completed: (await getSettingValue('EMAIL_TASK_COMPLETED', 'false')) === 'true',
          task_comment: (await getSettingValue('EMAIL_TASK_COMMENT', 'false')) === 'true',
          // Leads
          lead_created: (await getSettingValue('EMAIL_LEAD_CREATED', 'false')) === 'true',
          lead_assigned: (await getSettingValue('EMAIL_LEAD_ASSIGNED', 'false')) === 'true',
          lead_owner_notification: (await getSettingValue('EMAIL_LEAD_OWNER_NOTIFICATION', 'false')) === 'true',
          lead_welcome: (await getSettingValue('EMAIL_LEAD_WELCOME', 'false')) === 'true',
          lead_converted: (await getSettingValue('EMAIL_LEAD_CONVERTED', 'false')) === 'true',
          // Opportunities
          opportunity_created: (await getSettingValue('EMAIL_OPPORTUNITY_CREATED', 'false')) === 'true',
          opportunity_won: (await getSettingValue('EMAIL_OPPORTUNITY_WON', 'false')) === 'true',
          opportunity_lost: (await getSettingValue('EMAIL_OPPORTUNITY_LOST', 'false')) === 'true',
          // Accounts & Contacts
          account_created: (await getSettingValue('EMAIL_ACCOUNT_CREATED', 'false')) === 'true',
          contact_created: (await getSettingValue('EMAIL_CONTACT_CREATED', 'false')) === 'true',
          // Ecommerce
          ecommerce_order_placed: (await getSettingValue('EMAIL_ECOMMERCE_ORDER_PLACED', 'false')) === 'true',
          ecommerce_order_status: (await getSettingValue('EMAIL_ECOMMERCE_ORDER_STATUS', 'false')) === 'true',
          ecommerce_customer_registered: (await getSettingValue('EMAIL_ECOMMERCE_CUSTOMER_REGISTERED', 'false')) === 'true',
          ecommerce_product_low_stock: (await getSettingValue('EMAIL_ECOMMERCE_PRODUCT_LOW_STOCK', 'false')) === 'true',
          // DRM
          distributor_lead_created: (await getSettingValue('EMAIL_DISTRIBUTOR_LEAD_CREATED', 'false')) === 'true',
          distributor_approved: (await getSettingValue('EMAIL_DISTRIBUTOR_APPROVED', 'false')) === 'true',
          drm_order_created: (await getSettingValue('EMAIL_DRM_ORDER_CREATED', 'false')) === 'true',
          // Commissions
          commission_calculated: (await getSettingValue('EMAIL_COMMISSION_CALCULATED', 'false')) === 'true',
          commission_paid: (await getSettingValue('EMAIL_COMMISSION_PAID', 'false')) === 'true',
          // Users & System
          user_created: (await getSettingValue('EMAIL_USER_CREATED', 'false')) === 'true',
          user_login: (await getSettingValue('EMAIL_USER_LOGIN', 'false')) === 'true',
          user_role_changed: (await getSettingValue('EMAIL_USER_ROLE_CHANGED', 'false')) === 'true',
          system_backup: (await getSettingValue('EMAIL_SYSTEM_BACKUP', 'false')) === 'true',
          system_error: (await getSettingValue('EMAIL_SYSTEM_ERROR', 'false')) === 'true',
          // Communication
          email_campaign_sent: (await getSettingValue('EMAIL_EMAIL_CAMPAIGN_SENT', 'false')) === 'true',
          sms_campaign_sent: (await getSettingValue('EMAIL_SMS_CAMPAIGN_SENT', 'false')) === 'true',
          // Reports
          report_generated: (await getSettingValue('EMAIL_REPORT_GENERATED', 'false')) === 'true',
          analytics_alert: (await getSettingValue('EMAIL_ANALYTICS_ALERT', 'false')) === 'true'
        }
      },
      sms: {
        enabled: (await getSettingValue('SMS_ENABLED', 'false')) === 'true',
        provider: {
          name: await getSettingValue('SMS_PROVIDER', 'deywuro'),
          username: await getSettingValue('SMS_USERNAME', ''),
          password: smsPassword && smsPassword.length > 0 ? '***' : '',
          senderId: await getSettingValue('SMS_SENDER_ID', ''),
          baseUrl: await getSettingValue('SMS_BASE_URL', 'https://deywuro.com/api')
        },
        notifications: {
          // Inventory
          stock_low: (await getSettingValue('SMS_STOCK_LOW', 'false')) === 'true',
          stock_out: (await getSettingValue('SMS_STOCK_OUT', 'false')) === 'true',
          stock_movement: (await getSettingValue('SMS_STOCK_MOVEMENT', 'false')) === 'true',
          warehouse_update: (await getSettingValue('SMS_WAREHOUSE_UPDATE', 'false')) === 'true',
          // Orders
          new_order: (await getSettingValue('SMS_NEW_ORDER', 'false')) === 'true',
          order_status: (await getSettingValue('SMS_ORDER_STATUS', 'false')) === 'true',
          order_cancelled: (await getSettingValue('SMS_ORDER_CANCELLED', 'false')) === 'true',
          backorder_created: (await getSettingValue('SMS_BACKORDER_CREATED', 'false')) === 'true',
          // Payments
          payment_received: (await getSettingValue('SMS_PAYMENT_RECEIVED', 'false')) === 'true',
          payment_failed: (await getSettingValue('SMS_PAYMENT_FAILED', 'false')) === 'true',
          payment_refunded: (await getSettingValue('SMS_PAYMENT_REFUNDED', 'false')) === 'true',
          // Invoices
          invoice_created: (await getSettingValue('SMS_INVOICE_CREATED', 'false')) === 'true',
          invoice_sent: (await getSettingValue('SMS_INVOICE_SENT', 'false')) === 'true',
          invoice_overdue: (await getSettingValue('SMS_INVOICE_OVERDUE', 'false')) === 'true',
          invoice_paid: (await getSettingValue('SMS_INVOICE_PAID', 'false')) === 'true',
          // Quotations
          quotation_created: (await getSettingValue('SMS_QUOTATION_CREATED', 'false')) === 'true',
          quotation_sent: (await getSettingValue('SMS_QUOTATION_SENT', 'false')) === 'true',
          quotation_accepted: (await getSettingValue('SMS_QUOTATION_ACCEPTED', 'false')) === 'true',
          quotation_expired: (await getSettingValue('SMS_QUOTATION_EXPIRED', 'false')) === 'true',
          // Projects
          project_created: (await getSettingValue('SMS_PROJECT_CREATED', 'false')) === 'true',
          project_updated: (await getSettingValue('SMS_PROJECT_UPDATED', 'false')) === 'true',
          project_completed: (await getSettingValue('SMS_PROJECT_COMPLETED', 'false')) === 'true',
          project_member_added: (await getSettingValue('SMS_PROJECT_MEMBER_ADDED', 'false')) === 'true',
          // Tasks
          task_created: (await getSettingValue('SMS_TASK_CREATED', 'false')) === 'true',
          task_assigned: (await getSettingValue('SMS_TASK_ASSIGNED', 'false')) === 'true',
          task_due_soon: (await getSettingValue('SMS_TASK_DUE_SOON', 'false')) === 'true',
          task_overdue: (await getSettingValue('SMS_TASK_OVERDUE', 'false')) === 'true',
          task_completed: (await getSettingValue('SMS_TASK_COMPLETED', 'false')) === 'true',
          task_comment: (await getSettingValue('SMS_TASK_COMMENT', 'false')) === 'true',
          // Leads
          lead_created: (await getSettingValue('SMS_LEAD_CREATED', 'false')) === 'true',
          lead_assigned: (await getSettingValue('SMS_LEAD_ASSIGNED', 'false')) === 'true',
          lead_owner_notification: (await getSettingValue('SMS_LEAD_OWNER_NOTIFICATION', 'false')) === 'true',
          lead_welcome: (await getSettingValue('SMS_LEAD_WELCOME', 'false')) === 'true',
          lead_converted: (await getSettingValue('SMS_LEAD_CONVERTED', 'false')) === 'true',
          // Opportunities
          opportunity_created: (await getSettingValue('SMS_OPPORTUNITY_CREATED', 'false')) === 'true',
          opportunity_won: (await getSettingValue('SMS_OPPORTUNITY_WON', 'false')) === 'true',
          opportunity_lost: (await getSettingValue('SMS_OPPORTUNITY_LOST', 'false')) === 'true',
          // Accounts & Contacts
          account_created: (await getSettingValue('SMS_ACCOUNT_CREATED', 'false')) === 'true',
          contact_created: (await getSettingValue('SMS_CONTACT_CREATED', 'false')) === 'true',
          // Ecommerce
          ecommerce_order_placed: (await getSettingValue('SMS_ECOMMERCE_ORDER_PLACED', 'false')) === 'true',
          ecommerce_order_status: (await getSettingValue('SMS_ECOMMERCE_ORDER_STATUS', 'false')) === 'true',
          ecommerce_customer_registered: (await getSettingValue('SMS_ECOMMERCE_CUSTOMER_REGISTERED', 'false')) === 'true',
          ecommerce_product_low_stock: (await getSettingValue('SMS_ECOMMERCE_PRODUCT_LOW_STOCK', 'false')) === 'true',
          // DRM
          distributor_lead_created: (await getSettingValue('SMS_DISTRIBUTOR_LEAD_CREATED', 'false')) === 'true',
          distributor_approved: (await getSettingValue('SMS_DISTRIBUTOR_APPROVED', 'false')) === 'true',
          drm_order_created: (await getSettingValue('SMS_DRM_ORDER_CREATED', 'false')) === 'true',
          // Commissions
          commission_calculated: (await getSettingValue('SMS_COMMISSION_CALCULATED', 'false')) === 'true',
          commission_paid: (await getSettingValue('SMS_COMMISSION_PAID', 'false')) === 'true',
          // Users & System
          user_created: (await getSettingValue('SMS_USER_CREATED', 'false')) === 'true',
          user_login: (await getSettingValue('SMS_USER_LOGIN', 'false')) === 'true',
          user_role_changed: (await getSettingValue('SMS_USER_ROLE_CHANGED', 'false')) === 'true',
          system_backup: (await getSettingValue('SMS_SYSTEM_BACKUP', 'false')) === 'true',
          system_error: (await getSettingValue('SMS_SYSTEM_ERROR', 'false')) === 'true',
          // Communication
          email_campaign_sent: (await getSettingValue('SMS_EMAIL_CAMPAIGN_SENT', 'false')) === 'true',
          sms_campaign_sent: (await getSettingValue('SMS_SMS_CAMPAIGN_SENT', 'false')) === 'true',
          // Reports
          report_generated: (await getSettingValue('SMS_REPORT_GENERATED', 'false')) === 'true',
          analytics_alert: (await getSettingValue('SMS_ANALYTICS_ALERT', 'false')) === 'true'
        }
      },
      taskNotifications: {
        enabled: (await getSettingValue('TASK_NOTIFICATIONS_ENABLED', 'true')) === 'true',
        minutesBeforeDue: parseInt(await getSettingValue('TASK_NOTIFICATION_MINUTES_BEFORE_DUE', '10')),
        sendDueSoon: (await getSettingValue('TASK_NOTIFICATION_SEND_DUE_SOON', 'true')) === 'true',
        sendOverdue: (await getSettingValue('TASK_NOTIFICATION_SEND_OVERDUE', 'true')) === 'true',
        sendEscalation: (await getSettingValue('TASK_NOTIFICATION_SEND_ESCALATION', 'true')) === 'true',
        escalationInterval: parseInt(await getSettingValue('TASK_NOTIFICATION_ESCALATION_INTERVAL', '1'))
      }
    };

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    return NextResponse.json(
      { error: "Failed to fetch notification settings" },
      { status: 500 }
    );
  }
}

// Helper function to save setting to database
async function saveSetting(key: string, value: string, category: string = 'notifications'): Promise<void> {
  await prisma.systemSettings.upsert({
    where: { key },
    update: { 
      value,
      category,
      updatedAt: new Date()
    },
    create: {
      key,
      value,
      category,
      type: 'string',
      description: `Notification setting for ${key}`,
      isActive: true
    }
  });
}

// PUT /api/settings/notifications - Update notification settings
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { settings } = body;

    if (!settings) {
      return NextResponse.json(
        { error: "Settings are required" },
        { status: 400 }
      );
    }

    // Save email settings to database
    if (settings.email) {
      await saveSetting('EMAIL_ENABLED', settings.email.enabled ? 'true' : 'false');
      
      if (settings.email.smtp) {
        await saveSetting('SMTP_HOST', settings.email.smtp.host || '');
        await saveSetting('SMTP_PORT', settings.email.smtp.port || '587');
        await saveSetting('SMTP_USERNAME', settings.email.smtp.username || '');
        
        // Only save password if it's not the masked value
        if (settings.email.smtp.password && settings.email.smtp.password !== '***') {
          await saveSetting('SMTP_PASSWORD', settings.email.smtp.password);
        }
        
        await saveSetting('SMTP_ENCRYPTION', settings.email.smtp.encryption || 'tls');
        await saveSetting('SMTP_FROM_ADDRESS', settings.email.smtp.fromAddress || '');
        await saveSetting('SMTP_FROM_NAME', settings.email.smtp.fromName || await getCompanyNameFromSystemSettings());
      }

      // Save email notification types
      if (settings.email.notifications) {
        for (const [key, value] of Object.entries(settings.email.notifications)) {
          await saveSetting(`EMAIL_${key.toUpperCase()}`, value ? 'true' : 'false');
        }
      }
    }

    // Save SMS settings to database
    if (settings.sms) {
      await saveSetting('SMS_ENABLED', settings.sms.enabled ? 'true' : 'false');
      
      if (settings.sms.provider) {
        await saveSetting('SMS_PROVIDER', settings.sms.provider.name || 'deywuro');
        
        // Save username and password if provided
        await saveSetting('SMS_USERNAME', settings.sms.provider.username || '');
        
        // Only save password if it's not the masked value
        if (settings.sms.provider.password && settings.sms.provider.password !== '***') {
          await saveSetting('SMS_PASSWORD', settings.sms.provider.password);
        }
        
        await saveSetting('SMS_SENDER_ID', settings.sms.provider.senderId || '');
        await saveSetting('SMS_BASE_URL', settings.sms.provider.baseUrl || 'https://deywuro.com/api');
      }

      // Save SMS notification types
      if (settings.sms.notifications) {
        for (const [key, value] of Object.entries(settings.sms.notifications)) {
          await saveSetting(`SMS_${key.toUpperCase()}`, value ? 'true' : 'false');
        }
      }
    }

    // Save task notification settings to database
    if (settings.taskNotifications) {
      await saveSetting('TASK_NOTIFICATIONS_ENABLED', settings.taskNotifications.enabled ? 'true' : 'false');
      await saveSetting('TASK_NOTIFICATION_MINUTES_BEFORE_DUE', settings.taskNotifications.minutesBeforeDue?.toString() || '10');
      await saveSetting('TASK_NOTIFICATION_SEND_DUE_SOON', settings.taskNotifications.sendDueSoon ? 'true' : 'false');
      await saveSetting('TASK_NOTIFICATION_SEND_OVERDUE', settings.taskNotifications.sendOverdue ? 'true' : 'false');
      await saveSetting('TASK_NOTIFICATION_SEND_ESCALATION', settings.taskNotifications.sendEscalation ? 'true' : 'false');
      await saveSetting('TASK_NOTIFICATION_ESCALATION_INTERVAL', settings.taskNotifications.escalationInterval?.toString() || '1');
    }

    return NextResponse.json({
      message: "Settings updated successfully",
      settings
    });
  } catch (error) {
    console.error('Error updating notification settings:', error);
    return NextResponse.json(
      { error: "Failed to update notification settings" },
      { status: 500 }
    );
  }
}