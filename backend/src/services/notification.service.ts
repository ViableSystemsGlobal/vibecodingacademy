import prisma from '../config/database';
import { emailService } from './email.service';
import { smsService } from './sms.service';

export class NotificationService {
  async sendRegistrationConfirmation(
    email: string,
    parentName: string,
    studentName: string,
    className: string,
    startTime: Date,
    meetingLink?: string,
    phone?: string
  ) {
    // Send email
    try {
      const template = await prisma.emailTemplate.findUnique({
        where: { key: 'registration_free' },
      });

      let subject = 'Registration Confirmed - Vibe Coding Academy';
      let html = `
        <div>
          <h2>Registration Confirmed!</h2>
          <p>Hello ${parentName},</p>
          <p>${studentName} has been successfully registered for ${className}.</p>
          <p><strong>Class Date:</strong> ${startTime.toLocaleString()}</p>
          ${meetingLink ? `<p><strong>Meeting Link:</strong> <a href="${meetingLink}">${meetingLink}</a></p>` : ''}
        </div>
      `;

      if (template && template.isActive) {
        // Replace variables in subject line
        subject = template.subject
          .replace('{{parent_name}}', parentName)
          .replace('{{student_name}}', studentName)
          .replace('{{class_title}}', className)
          .replace('{{start_time}}', startTime.toLocaleString())
          .replace('{{meeting_link}}', meetingLink || '');
        
        // Replace variables in HTML body
        html = template.htmlBody
          .replace('{{parent_name}}', parentName)
          .replace('{{student_name}}', studentName)
          .replace('{{class_title}}', className)
          .replace('{{start_time}}', startTime.toLocaleString())
          .replace('{{meeting_link}}', meetingLink || '');
      }

      await emailService.sendEmail(email, subject, html);

      // Log notification
      await prisma.notificationLog.create({
        data: {
          type: 'EMAIL',
          toAddress: email,
          templateKey: 'registration_free',
          status: 'SUCCESS',
          sentAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Error sending registration confirmation email:', error);
      await prisma.notificationLog.create({
        data: {
          type: 'EMAIL',
          toAddress: email,
          templateKey: 'registration_free',
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }

    // Send SMS if phone number is provided
    if (phone) {
      try {
        const smsTemplate = await prisma.smsTemplate.findUnique({
          where: { key: 'registration_free' },
        });

        let smsMessage = `Hello ${parentName}, ${studentName} has been registered for ${className}. Class: ${new Date(startTime).toLocaleString()}.`;
        if (meetingLink) {
          smsMessage += ` Link: ${meetingLink}`;
        }

        if (smsTemplate && smsTemplate.isActive) {
          smsMessage = smsTemplate.content
            .replace('{{parent_name}}', parentName)
            .replace('{{student_name}}', studentName)
            .replace('{{class_title}}', className)
            .replace('{{start_time}}', new Date(startTime).toLocaleString())
            .replace('{{meeting_link}}', meetingLink || '');
        }

        // Limit to 160 characters for single SMS
        await smsService.sendSms(phone, smsMessage.substring(0, 160));
      } catch (error) {
        console.error('Error sending registration confirmation SMS:', error);
        // Log SMS failure but don't throw - email is more important
        await prisma.notificationLog.create({
          data: {
            type: 'SMS',
            toAddress: phone,
            templateKey: 'registration_free',
            status: 'FAILED',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    }
  }

  async sendBootcampRegistrationPending(
    email: string,
    parentName: string,
    studentName: string,
    className: string,
    priceCents: number,
    phone?: string
  ) {
    // Send email
    try {
      const template = await prisma.emailTemplate.findUnique({
        where: { key: 'bootcamp_pending' },
      });

      let subject = 'Bootcamp Registration - Payment Required';
      let html = `
        <div>
          <h2>Bootcamp Registration Received</h2>
          <p>Hello ${parentName},</p>
          <p>${studentName} has been registered for ${className}.</p>
          <p><strong>Amount Due:</strong> GHS ${(priceCents / 100).toFixed(2)}</p>
          <p>Please complete payment to confirm your registration.</p>
        </div>
      `;

      if (template && template.isActive) {
        // Replace variables in subject line
        subject = template.subject
          .replace('{{parent_name}}', parentName)
          .replace('{{student_name}}', studentName)
          .replace('{{class_title}}', className)
          .replace('{{amount}}', (priceCents / 100).toFixed(2));
        
        // Replace variables in HTML body
        html = template.htmlBody
          .replace('{{parent_name}}', parentName)
          .replace('{{student_name}}', studentName)
          .replace('{{class_title}}', className)
          .replace('{{amount}}', (priceCents / 100).toFixed(2));
      }

      await emailService.sendEmail(email, subject, html);

      // Log notification
      await prisma.notificationLog.create({
        data: {
          type: 'EMAIL',
          toAddress: email,
          templateKey: 'bootcamp_pending',
          status: 'SUCCESS',
          sentAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Error sending bootcamp registration email:', error);
      await prisma.notificationLog.create({
        data: {
          type: 'EMAIL',
          toAddress: email,
          templateKey: 'bootcamp_pending',
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }

    // Send SMS if phone number is provided
    if (phone) {
      try {
        const smsTemplate = await prisma.smsTemplate.findUnique({
          where: { key: 'bootcamp_pending' },
        });

        let smsMessage = `Hello ${parentName}, ${studentName} registered for ${className}. Amount: GHS ${(priceCents / 100).toFixed(2)}. Complete payment to confirm.`;

        if (smsTemplate && smsTemplate.isActive) {
          smsMessage = smsTemplate.content
            .replace('{{parent_name}}', parentName)
            .replace('{{student_name}}', studentName)
            .replace('{{class_title}}', className)
            .replace('{{amount}}', (priceCents / 100).toFixed(2));
        }

        // Limit to 160 characters for single SMS
        await smsService.sendSms(phone, smsMessage.substring(0, 160));
      } catch (error) {
        console.error('Error sending bootcamp registration SMS:', error);
        // Log SMS failure but don't throw - email is more important
        await prisma.notificationLog.create({
          data: {
            type: 'SMS',
            toAddress: phone,
            templateKey: 'bootcamp_pending',
            status: 'FAILED',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    }
  }

  async sendBootcampPaymentSuccess(
    email: string,
    parentName: string,
    studentName: string,
    className: string
  ) {
    try {
      const template = await prisma.emailTemplate.findUnique({
        where: { key: 'bootcamp_payment_success' },
      });

      let subject = 'Payment Confirmed - Bootcamp Registration';
      let html = `
        <div>
          <h2>Payment Confirmed!</h2>
          <p>Hello ${parentName},</p>
          <p>Payment for ${studentName}'s registration in ${className} has been confirmed.</p>
          <p>You will receive class details and meeting link shortly.</p>
        </div>
      `;

      if (template && template.isActive) {
        // Replace variables in subject line
        subject = template.subject
          .replace('{{parent_name}}', parentName)
          .replace('{{student_name}}', studentName)
          .replace('{{class_title}}', className);
        
        // Replace variables in HTML body
        html = template.htmlBody
          .replace('{{parent_name}}', parentName)
          .replace('{{student_name}}', studentName)
          .replace('{{class_title}}', className);
      }

      await emailService.sendEmail(email, subject, html);

      // Log notification
      await prisma.notificationLog.create({
        data: {
          type: 'EMAIL',
          toAddress: email,
          templateKey: 'bootcamp_payment_success',
          status: 'SUCCESS',
          sentAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Error sending payment confirmation email:', error);
      await prisma.notificationLog.create({
        data: {
          type: 'EMAIL',
          toAddress: email,
          templateKey: 'bootcamp_payment_success',
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  async sendWelcomeEmail(
    email: string,
    parentName: string,
    passwordSetupUrl: string
  ) {
    try {
      const template = await prisma.emailTemplate.findUnique({
        where: { key: 'welcome_new_parent' },
      });

      let subject = 'Welcome to Vibe Coding Academy - Set Your Password';
      let html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to Vibe Coding Academy!</h2>
          <p>Hello ${parentName},</p>
          <p>Thank you for registering with Vibe Coding Academy. Your account has been created successfully.</p>
          <p>To access your parent portal, please set your password by clicking the link below:</p>
          <p style="margin: 20px 0;">
            <a href="${passwordSetupUrl}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Set Your Password
            </a>
          </p>
          <p>This link will expire in 7 days.</p>
          <p>If you didn't create an account, please ignore this email.</p>
          <p>Best regards,<br>The Vibe Coding Academy Team</p>
        </div>
      `;

      if (template && template.isActive) {
        // Replace variables in subject line
        subject = template.subject
          .replace('{{parent_name}}', parentName);
        
        // Replace variables in HTML body
        html = template.htmlBody
          .replace('{{parent_name}}', parentName)
          .replace('{{password_setup_url}}', passwordSetupUrl);
      }

      await emailService.sendEmail(email, subject, html);

      // Log notification
      await prisma.notificationLog.create({
        data: {
          type: 'EMAIL',
          toAddress: email,
          templateKey: 'welcome_new_parent',
          status: 'SUCCESS',
          sentAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Error sending welcome email:', error);
      await prisma.notificationLog.create({
        data: {
          type: 'EMAIL',
          toAddress: email,
          templateKey: 'welcome_new_parent',
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
  }

  async sendPaymentReminder(
    email: string,
    parentName: string,
    studentName: string,
    className: string,
    amountCents: number,
    paymentUrl?: string,
    phone?: string
  ) {
    // Send email
    try {
      const template = await prisma.emailTemplate.findUnique({
        where: { key: 'payment_reminder' },
      });

      let subject = 'Payment Reminder - Complete Your Registration';
      let html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Payment Reminder</h2>
          <p>Hello ${parentName},</p>
          <p>This is a friendly reminder that payment is still pending for ${studentName}'s registration in ${className}.</p>
          <p><strong>Amount Due:</strong> GHS ${(amountCents / 100).toFixed(2)}</p>
          ${paymentUrl ? `<p><a href="${paymentUrl}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; margin: 20px 0;">Complete Payment</a></p>` : ''}
          <p>Please complete your payment to confirm your registration.</p>
          <p>If you have already paid, please ignore this reminder.</p>
          <p>Best regards,<br>The Vibe Coding Academy Team</p>
        </div>
      `;

      if (template && template.isActive) {
        // Replace variables in subject line
        subject = template.subject
          .replace('{{parent_name}}', parentName)
          .replace('{{student_name}}', studentName)
          .replace('{{class_title}}', className)
          .replace('{{amount}}', (amountCents / 100).toFixed(2));
        
        // Replace variables in HTML body
        html = template.htmlBody
          .replace('{{parent_name}}', parentName)
          .replace('{{student_name}}', studentName)
          .replace('{{class_title}}', className)
          .replace('{{amount}}', (amountCents / 100).toFixed(2))
          .replace('{{payment_url}}', paymentUrl || '');
      }

      await emailService.sendEmail(email, subject, html);

      // Log notification
      await prisma.notificationLog.create({
        data: {
          type: 'EMAIL',
          toAddress: email,
          templateKey: 'payment_reminder',
          status: 'SUCCESS',
          sentAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Error sending payment reminder email:', error);
      await prisma.notificationLog.create({
        data: {
          type: 'EMAIL',
          toAddress: email,
          templateKey: 'payment_reminder',
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }

    // Send SMS if phone number is provided
    if (phone) {
      try {
        const smsTemplate = await prisma.smsTemplate.findUnique({
          where: { key: 'payment_reminder' },
        });

        let smsMessage = `Hello ${parentName}, payment reminder: ${studentName} registered for ${className}. Amount: GHS ${(amountCents / 100).toFixed(2)}. Please complete payment.`;

        if (smsTemplate && smsTemplate.isActive) {
          smsMessage = smsTemplate.content
            .replace('{{parent_name}}', parentName)
            .replace('{{student_name}}', studentName)
            .replace('{{class_title}}', className)
            .replace('{{amount}}', (amountCents / 100).toFixed(2));
        }

        // Limit to 160 characters for single SMS
        await smsService.sendSms(phone, smsMessage.substring(0, 160));
      } catch (error) {
        console.error('Error sending payment reminder SMS:', error);
        // Log SMS failure but don't throw - email is more important
        await prisma.notificationLog.create({
          data: {
            type: 'SMS',
            toAddress: phone,
            templateKey: 'payment_reminder',
            status: 'FAILED',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    }
  }

  async sendClassReminder(
    email: string,
    parentName: string,
    studentName: string,
    className: string,
    startTime: Date,
    meetingLink?: string,
    reminderType: '24h' | '1h' = '24h'
  ) {
    const templateKey = reminderType === '24h' ? 'class_reminder_24h' : 'class_reminder_1h';
    try {
      const template = await prisma.emailTemplate.findUnique({
        where: { key: templateKey },
      });

      let subject = `Class Reminder - ${className}`;
      let html = `
        <div>
          <h2>Class Reminder</h2>
          <p>Hello ${parentName},</p>
          <p>This is a reminder that ${studentName} has a class: ${className}</p>
          <p><strong>Time:</strong> ${startTime.toLocaleString()}</p>
          ${meetingLink ? `<p><strong>Meeting Link:</strong> <a href="${meetingLink}">${meetingLink}</a></p>` : ''}
        </div>
      `;

      if (template && template.isActive) {
        // Replace variables in subject line
        subject = template.subject
          .replace('{{parent_name}}', parentName)
          .replace('{{student_name}}', studentName)
          .replace('{{class_title}}', className)
          .replace('{{start_time}}', startTime.toLocaleString())
          .replace('{{meeting_link}}', meetingLink || '');
        
        // Replace variables in HTML body
        html = template.htmlBody
          .replace('{{parent_name}}', parentName)
          .replace('{{student_name}}', studentName)
          .replace('{{class_title}}', className)
          .replace('{{start_time}}', startTime.toLocaleString())
          .replace('{{meeting_link}}', meetingLink || '');
      }

      await emailService.sendEmail(email, subject, html);

      // Log notification
      await prisma.notificationLog.create({
        data: {
          type: 'EMAIL',
          toAddress: email,
          templateKey,
          status: 'SUCCESS',
          sentAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Error sending class reminder:', error);
      await prisma.notificationLog.create({
        data: {
          type: 'EMAIL',
          toAddress: email,
          templateKey,
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
}

export const notificationService = new NotificationService();

