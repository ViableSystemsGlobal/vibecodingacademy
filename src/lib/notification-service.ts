import { prisma } from "@/lib/prisma";

export interface NotificationTrigger {
  type: string;
  title: string;
  message: string;
  channels: string[];
  data?: any;
  scheduledAt?: Date;
}

export interface NotificationRecipient {
  userId?: string;
  role?: string;
  email?: string;
}

export class NotificationService {
  /**
   * Send notification to specific user
   */
  static async sendToUser(
    recipientId: string,
    trigger: NotificationTrigger
  ): Promise<void> {
    try {
      // Get user preferences
      const user = await (prisma as any).user.findUnique({
        where: { id: recipientId },
        select: { 
          id: true,
          email: true,
          name: true,
          phone: true,
          preferences: true
        }
      });

      const userPreferences = user?.preferences as any;
      const notificationPreferences = userPreferences?.notifications;

      // Check if user has notifications enabled
      if (notificationPreferences?.enabled === false) {
        console.log(`Notifications disabled for user ${recipientId}, skipping notification: ${trigger.title}`);
        return;
      }

      // Filter channels based on user preferences
      let allowedChannels = trigger.channels;
      if (notificationPreferences?.channels) {
        allowedChannels = trigger.channels.filter(channel => {
          const channelKey = channel.toLowerCase().replace('_', '');
          return notificationPreferences.channels[channelKey] === true;
        });
      }

      // Check if notification type is allowed
      if (notificationPreferences?.types) {
        const typeKey = trigger.type.toLowerCase().replace('_', '');
        if (notificationPreferences.types[typeKey] === false) {
          console.log(`Notification type ${trigger.type} disabled for user ${recipientId}, skipping notification: ${trigger.title}`);
          return;
        }
      }

      // Check quiet hours
      if (notificationPreferences?.quietHours?.enabled) {
        const now = new Date();
        const quietStart = notificationPreferences.quietHours.start;
        const quietEnd = notificationPreferences.quietHours.end;
        
        // Simple quiet hours check (you might want to implement timezone support)
        const currentTime = now.getHours() * 60 + now.getMinutes();
        const startTime = this.parseTime(quietStart);
        const endTime = this.parseTime(quietEnd);
        
        if (this.isInQuietHours(currentTime, startTime, endTime)) {
          console.log(`User ${recipientId} is in quiet hours, skipping notification: ${trigger.title}`);
          return;
        }
      }

      if (allowedChannels.length === 0) {
        console.log(`No allowed channels for user ${recipientId}, skipping notification: ${trigger.title}`);
        return;
      }

      // Create notification record
      const notification = await (prisma as any).notification.create({
        data: {
          userId: recipientId,
          type: trigger.type,
          title: trigger.title,
          message: trigger.message,
          channels: JSON.stringify(allowedChannels),
          status: 'PENDING',
          data: trigger.data ? JSON.stringify(trigger.data) : null,
          scheduledAt: trigger.scheduledAt || null
        }
      });

      // Send notifications through each channel immediately
      for (const channel of allowedChannels) {
        console.log(`📤 Processing channel: ${channel} for user ${recipientId}`);
        console.log(`User has email: ${!!user.email}, phone: ${!!user.phone}`);
        
        if (channel === 'EMAIL' && user.email) {
          try {
            await this.sendEmailNotification(user.email, trigger, notification.id);
          } catch (error) {
            console.error(`❌ Email failed for user ${recipientId}:`, error);
          }
        } else if (channel === 'SMS' && user.phone) {
          console.log(`📱 Attempting to send SMS to ${user.phone}`);
          try {
            await this.sendSMSNotification(user.phone, trigger, notification.id);
          } catch (error) {
            console.error(`❌ SMS failed for user ${recipientId}:`, error);
            console.error('SMS Error details:', error);
          }
        } else if (channel === 'IN_APP') {
          // In-app notifications are handled by the notification record creation above
          console.log(`In-app notification created for user ${recipientId}`);
        } else {
          console.log(`⚠️ Skipping channel ${channel} - missing contact info`);
        }
      }

      // Update notification status to SENT
      await (prisma as any).notification.update({
        where: { id: notification.id },
        data: { 
          status: 'SENT',
          sentAt: new Date()
        }
      });

      console.log(`Notification sent to user ${recipientId}: ${trigger.title} via channels: ${allowedChannels.join(', ')}`);
    } catch (error) {
      console.error('Error sending notification to user:', error);
    }
  }

  /**
   * Send notification to users by role
   */
  static async sendToRole(
    role: string,
    trigger: NotificationTrigger
  ): Promise<void> {
    try {
      const users = await prisma.user.findMany({
        where: {
          role: role as any
        },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true
        }
      });

      const notificationPromises = users.map(user => 
        this.sendToUser(user.id, trigger)
      );

      await Promise.all(notificationPromises);
      console.log(`Notification sent to ${users.length} users with role ${role}: ${trigger.title}`);
    } catch (error) {
      console.error('Error sending notification to role:', error);
    }
  }

  /**
   * Send notification to multiple specific users
   */
  static async sendToUsers(
    userIds: string[],
    trigger: NotificationTrigger
  ): Promise<void> {
    try {
      const notificationPromises = userIds.map(userId => 
        this.sendToUser(userId, trigger)
      );

      await Promise.all(notificationPromises);
      console.log(`Notification sent to ${userIds.length} users: ${trigger.title}`);
    } catch (error) {
      console.error('Error sending notification to users:', error);
    }
  }

  /**
   * Send notification to all admins
   */
  static async sendToAdmins(trigger: NotificationTrigger): Promise<void> {
    await this.sendToRole('ADMIN', trigger);
  }

  /**
   * Send notification to all super admins
   */
  static async sendToSuperAdmins(trigger: NotificationTrigger): Promise<void> {
    await this.sendToRole('SUPER_ADMIN', trigger);
  }

  /**
   * Send notification to all inventory managers
   */
  static async sendToInventoryManagers(trigger: NotificationTrigger): Promise<void> {
    await this.sendToRole('INVENTORY_MANAGER', trigger);
  }

  /**
   * Send notification to all sales managers
   */
  static async sendToSalesManagers(trigger: NotificationTrigger): Promise<void> {
    await this.sendToRole('SALES_MANAGER', trigger);
  }

  /**
   * Send notification to all sales reps
   */
  static async sendToSalesReps(trigger: NotificationTrigger): Promise<void> {
    await this.sendToRole('SALES_REP', trigger);
  }

  /**
   * Send notification to all finance officers
   */
  static async sendToFinanceOfficers(trigger: NotificationTrigger): Promise<void> {
    await this.sendToRole('FINANCE_OFFICER', trigger);
  }

  /**
   * Send notification directly to an email address
   */
  static async sendToEmail(email: string, trigger: NotificationTrigger): Promise<void> {
    try {
      // For external emails (like welcome emails to leads), we don't create a notification record
      // Just send the email directly
      console.log(`Sending email directly to ${email}`);
      
      // Send email immediately
      await this.sendEmailNotification(email, trigger, 'direct-email');
      
      console.log(`✅ Email sent successfully to ${email}`);
    } catch (error) {
      console.error(`Error sending email notification to ${email}:`, error);
      throw error;
    }
  }

  /**
   * Send email notification using SMTP
   */
  private static async sendEmailNotification(email: string, trigger: NotificationTrigger, notificationId: string): Promise<void> {
    try {
      // Check if this specific notification type is enabled
      // For CUSTOM types, check the actual notification type from data
      const actualType = trigger.data?.notificationType || trigger.type;
      const emailTypeEnabled = await this.getSettingValue(`EMAIL_${actualType}`, 'false');
      if (emailTypeEnabled !== 'true') {
        console.log(`Email notifications for ${actualType} are disabled`);
        return;
      }

      // Get SMTP configuration from database
      const smtpHost = await this.getSettingValue('SMTP_HOST', '');
      const smtpPort = await this.getSettingValue('SMTP_PORT', '587');
      const smtpUsername = await this.getSettingValue('SMTP_USERNAME', '');
      const smtpPassword = await this.getSettingValue('SMTP_PASSWORD', '');
      const smtpFromAddress = await this.getSettingValue('SMTP_FROM_ADDRESS', '');
      const smtpFromName = await this.getSettingValue('SMTP_FROM_NAME', 'AdPools Group');
      const smtpEncryption = await this.getSettingValue('SMTP_ENCRYPTION', 'tls');

      if (!smtpHost || !smtpUsername || !smtpPassword || !smtpFromAddress) {
        console.log('SMTP configuration not found, skipping email notification');
        return;
      }

      console.log('Sending email to:', email);
      console.log('SMTP Config:', { smtpHost, smtpPort, smtpUsername, smtpFromAddress });

      // Use nodemailer with standard configuration (same as communication system)
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort),
        secure: smtpEncryption === 'ssl',
        auth: {
          user: smtpUsername,
          pass: smtpPassword,
        },
      });

      const result = await transporter.sendMail({
        from: `"${smtpFromName}" <${smtpFromAddress}>`,
        to: email,
        subject: trigger.title,
        text: trigger.message,
        html: trigger.message.replace(/\n/g, '<br>'),
      });

      console.log(`✅ Email notification sent successfully to ${email}: ${result.messageId}`);
    } catch (error) {
      console.error('❌ Error sending email notification:', error);
      throw error;
    }
  }

  /**
   * Send SMS notification using configured provider
   */
  private static async sendSMSNotification(phone: string, trigger: NotificationTrigger, notificationId: string): Promise<void> {
    try {
      // Check if this specific notification type is enabled
      // For CUSTOM types, check the actual notification type from data
      const actualType = trigger.data?.notificationType || trigger.type;
      const smsTypeEnabled = await this.getSettingValue(`SMS_${actualType}`, 'false');
      if (smsTypeEnabled !== 'true') {
        console.log(`SMS notifications for ${actualType} are disabled`);
        return;
      }

      // Get SMS configuration
      const smsEnabled = await this.getSettingValue('SMS_ENABLED', 'false');
      const smsProvider = await this.getSettingValue('SMS_PROVIDER', 'deywuro');
      
      if (smsEnabled !== 'true') {
        console.log('SMS notifications disabled');
        return;
      }

      if (smsProvider === 'deywuro') {
        await this.sendSMSViaDeywuro(phone, trigger.message, notificationId);
      } else {
        console.log(`SMS provider ${smsProvider} not implemented`);
      }

      console.log(`✅ SMS notification sent successfully to ${phone}`);
    } catch (error) {
      console.error('❌ Error sending SMS notification:', error);
      throw error;
    }
  }

  /**
   * Send SMS via Deywuro provider
   */
  private static async sendSMSViaDeywuro(phone: string, message: string, notificationId: string): Promise<void> {
    try {
      const smsUsername = await this.getSettingValue('SMS_USERNAME', '');
      const smsPassword = await this.getSettingValue('SMS_PASSWORD', '');
      const smsSenderId = await this.getSettingValue('SMS_SENDER_ID', 'AdPools');

      if (!smsUsername || !smsPassword) {
        console.log('SMS credentials not configured');
        return;
      }

      console.log('Sending SMS to:', phone);
      console.log('SMS Config:', { smsUsername, smsSenderId, messageLength: message.length });

      // Use the same working endpoint and format as the communication system
      const response = await fetch('https://deywuro.com/api/sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          username: smsUsername,
          password: smsPassword,
          destination: phone,
          source: smsSenderId,
          message: message
        })
      });

      const responseText = await response.text();
      console.log('Deywuro SMS Response Status:', response.status);
      console.log('Deywuro SMS Response Text:', responseText);

      // Try to parse as JSON
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        // If it's not JSON, it might be an HTML error page
        throw new Error(`SMS provider returned non-JSON response: ${response.status} - ${responseText.substring(0, 100)}...`);
      }

      if (result.code === 0) {
        console.log(`SMS sent via Deywuro: ${result.messageId || 'Success'}`);
      } else {
        throw new Error(`SMS failed: ${result.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error sending SMS via Deywuro:', error);
      throw error;
    }
  }

  /**
   * Get setting value from database
   */
  private static async getSettingValue(key: string, defaultValue: string = ''): Promise<string> {
    try {
      const setting = await (prisma as any).systemSettings.findUnique({
        where: { key }
      });
      return setting?.value || defaultValue;
    } catch (error) {
      console.error(`Error getting setting ${key}:`, error);
      return defaultValue;
    }
  }

  /**
   * Use notification template to send notification
   */
  static async sendFromTemplate(
    recipientId: string,
    templateName: string,
    variables: Record<string, any> = {}
  ): Promise<void> {
    try {
      const template = await (prisma as any).notificationTemplate.findUnique({
        where: { name: templateName }
      });

      if (!template) {
        console.error(`Notification template not found: ${templateName}`);
        return;
      }

      if (!template.isActive) {
        console.log(`Notification template is inactive: ${templateName}`);
        return;
      }

      // Replace variables in template
      let title = template.subject || '';
      let message = template.body;

      Object.entries(variables).forEach(([key, value]) => {
        const placeholder = `{{${key}}}`;
        title = title.replace(new RegExp(placeholder, 'g'), String(value));
        message = message.replace(new RegExp(placeholder, 'g'), String(value));
      });

      const trigger: NotificationTrigger = {
        type: template.type,
        title,
        message,
        channels: JSON.parse(template.channels as string) as string[],
        data: { templateName, variables }
      };

      await this.sendToUser(recipientId, trigger);
    } catch (error) {
      console.error('Error sending notification from template:', error);
    }
  }

  /**
   * Mark notification as sent
   */
  static async markAsSent(notificationId: string): Promise<void> {
    try {
      await (prisma as any).notification.update({
        where: { id: notificationId },
        data: {
          status: 'SENT',
          sentAt: new Date()
        }
      });
    } catch (error) {
      console.error('Error marking notification as sent:', error);
    }
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId: string): Promise<void> {
    try {
      await (prisma as any).notification.update({
        where: { id: notificationId },
        data: {
          readAt: new Date()
        }
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  /**
   * Get pending notifications for processing
   */
  static async getPendingNotifications(): Promise<any[]> {
    try {
      return await (prisma as any).notification.findMany({
        where: {
          status: 'PENDING',
          OR: [
            { scheduledAt: null },
            { scheduledAt: { lte: new Date() } }
          ]
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              phone: true
            }
          }
        },
        orderBy: { createdAt: 'asc' }
      });
    } catch (error) {
      console.error('Error fetching pending notifications:', error);
      return [];
    }
  }

  /**
   * Parse time string (HH:MM) to minutes since midnight
   */
  private static parseTime(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Check if current time is within quiet hours
   */
  private static isInQuietHours(currentTime: number, startTime: number, endTime: number): boolean {
    if (startTime <= endTime) {
      // Quiet hours within the same day (e.g., 22:00 to 08:00)
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Quiet hours span across midnight (e.g., 22:00 to 08:00)
      return currentTime >= startTime || currentTime <= endTime;
    }
  }
}

// Predefined notification triggers for common system events
export const SystemNotificationTriggers = {
  // Stock notifications
  stockLow: (productName: string, currentStock: number, reorderPoint: number) => ({
    type: 'STOCK_LOW',
    title: 'Low Stock Alert',
    message: `${productName} is running low. Current stock: ${currentStock}, Reorder point: ${reorderPoint}`,
    channels: ['IN_APP', 'EMAIL', 'SMS'],
    data: { productName, currentStock, reorderPoint }
  }),

  stockOut: (productName: string) => ({
    type: 'STOCK_OUT',
    title: 'Out of Stock Alert',
    message: `${productName} is now out of stock and needs immediate attention.`,
    channels: ['IN_APP', 'EMAIL', 'SMS'],
    data: { productName, stockLevel: 0 }
  }),

  // Order notifications
  orderCreated: (orderNumber: string, customerName: string, total: number) => ({
    type: 'ORDER_STATUS',
    title: 'New Order Created',
    message: `Order ${orderNumber} has been created for ${customerName} with a total of $${total}`,
    channels: ['IN_APP', 'EMAIL'],
    data: { orderNumber, customerName, total }
  }),

  orderStatusChanged: (orderNumber: string, newStatus: string, customerName: string) => ({
    type: 'ORDER_STATUS',
    title: 'Order Status Updated',
    message: `Order ${orderNumber} for ${customerName} has been updated to ${newStatus}`,
    channels: ['IN_APP', 'EMAIL'],
    data: { orderNumber, newStatus, customerName }
  }),

  // Payment notifications
  paymentReceived: (amount: number, customerName: string, paymentMethod: string) => ({
    type: 'PAYMENT_RECEIVED',
    title: 'Payment Received',
    message: `Payment of $${amount} received from ${customerName} via ${paymentMethod}`,
    channels: ['IN_APP', 'EMAIL'],
    data: { amount, customerName, paymentMethod }
  }),

  // User notifications
  userInvited: (userName: string, invitedBy: string, companyName?: string) => ({
    type: 'USER_INVITED',
    title: `Welcome to ${companyName || 'Our System'}`,
    message: `You have been invited to join ${companyName || 'our system'} by ${invitedBy}`,
    channels: ['EMAIL'],
    data: { userName, invitedBy, companyName: companyName || 'Our System' }
  }),

  passwordReset: (userName: string) => ({
    type: 'PASSWORD_RESET',
    title: 'Password Reset Request',
    message: `A password reset has been requested for ${userName}'s account`,
    channels: ['EMAIL'],
    data: { userName }
  }),

  // Security notifications
  securityAlert: (alertType: string, description: string) => ({
    type: 'SECURITY_ALERT',
    title: 'Security Alert',
    message: `${alertType}: ${description}`,
    channels: ['IN_APP', 'EMAIL', 'SMS'],
    data: { alertType, description }
  }),

  // System notifications
  systemAlert: (alertType: string, description: string) => ({
    type: 'SYSTEM_ALERT',
    title: 'System Alert',
    message: `${alertType}: ${description}`,
    channels: ['IN_APP', 'EMAIL'],
    data: { alertType, description }
  }),

  // Lead notifications (temporarily using CUSTOM type until migration)
  leadCreated: (leadName: string, leadEmail: string, creatorName: string, assignedTo?: string[]) => ({
    type: 'CUSTOM',
    title: 'New Lead Created',
    message: `New lead "${leadName}" has been created by ${creatorName}${assignedTo ? ` and assigned to ${assignedTo.length} user(s)` : ''}`,
    channels: ['IN_APP', 'EMAIL', 'SMS'],
    data: { leadName, leadEmail, creatorName, assignedTo, phone: '', notificationType: 'LEAD_CREATED' }
  }),

  leadAssigned: (leadName: string, leadEmail: string, assignedByName: string, leadSource?: string) => ({
    type: 'CUSTOM',
    title: 'Lead Assigned to You',
    message: `You have been assigned to lead "${leadName}"${leadEmail ? ` (${leadEmail})` : ''} by ${assignedByName}${leadSource ? ` from ${leadSource}` : ''}`,
    channels: ['IN_APP', 'EMAIL', 'SMS'],
    data: { leadName, leadEmail, assignedByName, leadSource, phone: '', notificationType: 'LEAD_ASSIGNED' }
  }),

  leadOwnerNotification: (leadName: string, leadEmail: string, creatorName: string, leadDetails: any) => ({
    type: 'CUSTOM',
    title: 'Lead Added to Your Account',
    message: `Lead "${leadName}"${leadEmail ? ` (${leadEmail})` : ''} has been added to your account by ${creatorName}`,
    channels: ['IN_APP', 'EMAIL'],
    data: { leadName, leadEmail, creatorName, leadDetails, phone: '', notificationType: 'LEAD_OWNER_NOTIFICATION' }
  }),

  leadWelcome: (leadName: string, companyName: string, assignedUserName?: string) => ({
    type: 'CUSTOM',
    title: `Welcome to ${companyName}`,
    message: `Hello ${leadName}, thank you for your interest in our products. We'll be in touch soon${assignedUserName ? ` - your dedicated contact is ${assignedUserName}` : ''}.`,
    channels: ['EMAIL'],
    data: { leadName, companyName, assignedUserName, notificationType: 'LEAD_WELCOME' }
  }),

  // Task notifications
  taskComment: (
    taskTitle: string,
    commentPreview: string,
    commenterName: string
  ) => ({
    type: 'TASK_COMMENT' as const,
    title: `New Comment on Task: ${taskTitle}`,
    message: `${commenterName} commented on "${taskTitle}": ${commentPreview}`,
    channels: ['IN_APP' as const, 'EMAIL' as const, 'SMS' as const],
    data: { taskTitle, commentPreview, commenterName }
  })
};
