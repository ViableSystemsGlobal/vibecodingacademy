import { prisma } from '@/lib/prisma';
import { User } from '@prisma/client';

interface LoginInfo {
  ipAddress?: string;
  userAgent?: string;
  device?: string;
  location?: string;
}

export class LoginNotificationService {
  /**
   * Send login notifications (email + SMS) after successful login
   */
  static async sendLoginNotifications(
    user: User,
    loginInfo: LoginInfo
  ): Promise<void> {
    try {
      // Check if user has notifications enabled
      const sendEmail = user.loginNotificationsEmail ?? true;
      const sendSMS = user.loginNotificationsSMS ?? true;

      if (!sendEmail && !sendSMS) {
        console.log(`Login notifications disabled for user ${user.id}`);
        return;
      }

      const timestamp = new Date().toLocaleString('en-US', {
        dateStyle: 'full',
        timeStyle: 'long',
        timeZone: 'Africa/Accra'
      });

      const location = loginInfo.location || 'Unknown location';
      const device = loginInfo.device || 'Unknown device';
      const ipAddress = loginInfo.ipAddress || 'Unknown IP';

      // Get company name from settings
      const companySetting = await prisma.systemSettings.findUnique({
        where: { key: 'company_name' }
      });
      const companyName = companySetting?.value || 'AdPools Group';

      // Send email notification
      if (sendEmail && user.email) {
        try {
          const emailSubject = `Login Alert - ${companyName}`;
          const emailBody = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #3b82f6;">🔐 Login Alert</h2>
              <p>Hello ${user.name || 'User'},</p>
              <p>We detected a login to your account:</p>
              <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <p><strong>Time:</strong> ${timestamp}</p>
                <p><strong>Device:</strong> ${device}</p>
                <p><strong>Location:</strong> ${location}</p>
                <p><strong>IP Address:</strong> ${ipAddress}</p>
              </div>
              ${loginInfo.ipAddress ? `
              <p style="color: #ef4444; font-weight: bold;">
                ⚠️ If this wasn't you, please secure your account immediately.
              </p>
              ` : ''}
              <p style="color: #666; font-size: 12px; margin-top: 20px;">
                This is an automated security notification from ${companyName}.
              </p>
            </div>
          `;

          // Use the notification service to send email
          const { NotificationService } = await import('@/lib/notification-service');
          await NotificationService.sendToEmail(user.email, {
            type: 'CUSTOM',
            title: emailSubject,
            message: emailBody,
            data: {
              notificationType: 'LOGIN_ALERT',
              html: emailBody
            }
          });

          console.log(`✅ Login email notification sent to ${user.email}`);
        } catch (error) {
          console.error(`❌ Failed to send login email to ${user.email}:`, error);
        }
      }

      // Send SMS notification
      if (sendSMS && user.phone) {
        try {
          const smsMessage = `Login Alert: Your ${companyName} account was accessed on ${timestamp}. Device: ${device}, Location: ${location}. If this wasn't you, secure your account immediately.`;

          // Send SMS directly using Deywuro API
          const smsUsername = await prisma.systemSettings.findUnique({
            where: { key: 'SMS_USERNAME' }
          });
          const smsPassword = await prisma.systemSettings.findUnique({
            where: { key: 'SMS_PASSWORD' }
          });
          const smsSenderId = await prisma.systemSettings.findUnique({
            where: { key: 'SMS_SENDER_ID' }
          });

          if (smsUsername?.value && smsPassword?.value) {
            try {
              const smsResponse = await fetch('https://deywuro.com/api/sms', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                  username: smsUsername.value,
                  password: smsPassword.value,
                  destination: user.phone,
                  source: smsSenderId?.value || 'AdPools',
                  message: smsMessage
                })
              });

              const responseText = await smsResponse.text();
              const result = JSON.parse(responseText);

              if (result.code === 0) {
                console.log(`✅ Login SMS notification sent to ${user.phone}`);
              } else {
                console.error(`❌ Failed to send login SMS: ${result.message || 'Unknown error'}`);
              }
            } catch (error) {
              console.error(`❌ Error sending login SMS to ${user.phone}:`, error);
            }
          } else {
            console.log('SMS credentials not configured, skipping SMS notification');
          }

          console.log(`✅ Login SMS notification sent to ${user.phone}`);
        } catch (error) {
          console.error(`❌ Failed to send login SMS to ${user.phone}:`, error);
        }
      }
    } catch (error) {
      console.error('Error sending login notifications:', error);
      // Don't throw - login should succeed even if notifications fail
    }
  }

  /**
   * Record login history
   */
  static async recordLoginHistory(
    userId: string,
    loginInfo: LoginInfo,
    isSuccessful: boolean = true,
    failureReason?: string
  ): Promise<void> {
    try {
      await (prisma as any).loginHistory.create({
        data: {
          userId,
          ipAddress: loginInfo.ipAddress,
          userAgent: loginInfo.userAgent,
          device: loginInfo.device,
          location: loginInfo.location,
          isSuccessful,
          failureReason
        }
      });
    } catch (error) {
      console.error('Error recording login history:', error);
      // Don't throw - login should succeed even if history recording fails
    }
  }

  /**
   * Get user's login history
   */
  static async getLoginHistory(
    userId: string,
    limit: number = 20
  ) {
    try {
      const history = await (prisma as any).loginHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          ipAddress: true,
          userAgent: true,
          device: true,
          location: true,
          isSuccessful: true,
          failureReason: true,
          createdAt: true,
        }
      });
      return history;
    } catch (error) {
      console.error('Error fetching login history:', error);
      return [];
    }
  }

  /**
   * Detect if this is a new device/IP (for alerts)
   */
  static async isNewDevice(
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<boolean> {
    try {
      if (!ipAddress && !userAgent) {
        return false;
      }

      // Check if we've seen this IP or user agent before
      const previousLogin = await (prisma as any).loginHistory.findFirst({
        where: {
          userId,
          isSuccessful: true,
          OR: [
            { ipAddress: ipAddress || undefined },
            { userAgent: userAgent || undefined }
          ]
        },
        orderBy: { createdAt: 'desc' }
      });

      return !previousLogin;
    } catch (error) {
      console.error('Error checking for new device:', error);
      return false;
    }
  }
}

