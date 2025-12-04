import axios from 'axios';
import { config } from '../config/env';
import prisma from '../config/database';
import { settingsService } from './settings.service';

class SmsService {
  /**
   * Send SMS via Deywuro API
   * Based on Deywuro NPONTU SMS API Documentation
   * Reference: www.deywuro.com/NewUI/Landing/images/NPONTU_SMS_API_DOCUMENT_NEW.pdf
   * 
   * API Specification:
   * - Endpoint: https://deywuro.com/api/sms
   * - Methods: POST or GET
   * - Parameters: username, password, destination, source, message
   * 
   * @param to - Recipient phone number (with country code, e.g., 233241234567 or +233241234567)
   * @param message - SMS message content (max 160 characters for single SMS)
   */
  async sendSms(to: string, message: string) {
    try {
      // Get settings from database (with env vars as fallback)
      // Database settings take precedence, then environment variables
      let username: string | null = null;
      let password: string | null = null;
      let sender: string | null = null;

      try {
        username = await settingsService.get('deywuro_username');
        password = await settingsService.get('deywuro_password');
        sender = await settingsService.get('deywuro_sender');
      } catch (error) {
        // Settings service might fail, fall back to env vars
        console.warn('Could not fetch settings from database, using environment variables');
      }

      // Use database settings if available, otherwise fall back to env vars
      const finalUsername = username || config.deywuro.username;
      const finalPassword = password || config.deywuro.password;
      const finalSender = sender || config.deywuro.sender;

      if (!finalUsername || !finalPassword || !finalSender) {
        throw new Error('Deywuro username, password, or sender ID not configured. Please configure in Admin → Settings → Integrations');
      }

      // Format phone number (remove + if present, Deywuro expects numbers without +)
      // Example: +233241234567 -> 233241234567
      const formattedPhone = to.replace(/^\+/, '');

      // Deywuro API integration
      // Based on NPONTU SMS API Documentation
      // Endpoint: https://deywuro.com/api/sms
      // Methods: POST or GET
      // Parameters:
      //   - username: Client deywuro username (provided by Npontu)
      //   - password: Client deywuro password (provided by Npontu)
      //   - destination: Target phone number(s), comma-separated for multiple
      //   - source: Sender title (max 11 characters, alphanumeric)
      //   - message: Message content
      
      const response = await axios.post(
        'https://deywuro.com/api/sms',
        {
          username: finalUsername,
          password: finalPassword,
          destination: formattedPhone,
          source: finalSender.substring(0, 11), // Max 11 characters
          message: message.substring(0, 160), // Ensure max 160 chars for single SMS
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      // Check response status
      const responseData = response.data;
      
      // Deywuro typically returns success status in response
      // Adjust based on actual API response format
      if (responseData.status === 'success' || responseData.success === true || response.status === 200) {
        // Log successful notification
        await prisma.notificationLog.create({
          data: {
            type: 'SMS',
            toAddress: formattedPhone,
            status: 'SUCCESS',
            sentAt: new Date(),
            payloadJson: responseData,
          },
        });

        return responseData;
      } else {
        throw new Error(responseData.message || 'SMS sending failed');
      }
    } catch (error: any) {
      console.error('Error sending SMS:', error.response?.data || error.message);
      
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      
      // Log failed notification
      await prisma.notificationLog.create({
        data: {
          type: 'SMS',
          toAddress: to,
          status: 'FAILED',
          errorMessage,
          payloadJson: error.response?.data || { error: errorMessage },
        },
      });

      throw new Error(`Failed to send SMS: ${errorMessage}`);
    }
  }

  async sendSmsWithTemplate(to: string, templateKey: string, variables: Record<string, string>) {
    const template = await prisma.smsTemplate.findUnique({
      where: { key: templateKey },
    });

    if (!template || !template.isActive) {
      throw new Error(`SMS template ${templateKey} not found or inactive`);
    }

    let message = template.content;
    Object.entries(variables).forEach(([key, value]) => {
      message = message.replace(`{{${key}}}`, value);
    });

    return this.sendSms(to, message);
  }
}

export const smsService = new SmsService();

