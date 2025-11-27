import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCompanyName } from '@/lib/company-settings';
import nodemailer from 'nodemailer';
import { addBulkEmailJob } from '@/lib/queue-service';
import { getQueueSettings } from '@/lib/queue-config';

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

async function sendEmailViaSMTP(
  recipient: string, 
  subject: string, 
  message: string,
  attachments?: Array<{ filename: string; url: string; contentType: string }>
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Get SMTP configuration from database
    const smtpHost = await getSettingValue('SMTP_HOST', '');
    const smtpPort = await getSettingValue('SMTP_PORT', '587');
    const smtpUsername = await getSettingValue('SMTP_USERNAME', '');
    const smtpPassword = await getSettingValue('SMTP_PASSWORD', '');
    const smtpFromAddress = await getSettingValue('SMTP_FROM_ADDRESS', '');
    const smtpFromName = await getSettingValue('SMTP_FROM_NAME', await getCompanyName());
    const smtpEncryption = await getSettingValue('SMTP_ENCRYPTION', 'tls');

    if (!smtpHost || !smtpUsername || !smtpPassword || !smtpFromAddress) {
      throw new Error('SMTP configuration not found. Please configure email settings.');
    }

    console.log('Sending email to:', recipient);
    console.log('SMTP Config:', { smtpHost, smtpPort, smtpUsername, smtpFromAddress });

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort),
      secure: smtpEncryption === 'ssl',
      auth: {
        user: smtpUsername,
        pass: smtpPassword,
      },
    });

    // Prepare attachments if provided
    let emailAttachments: any[] = [];
    if (attachments && attachments.length > 0) {
      for (const attachment of attachments) {
        try {
          // Fetch the PDF content from the URL
          const response = await fetch(attachment.url);
          if (response.ok) {
            const buffer = await response.arrayBuffer();
            emailAttachments.push({
              filename: attachment.filename,
              content: Buffer.from(buffer),
              contentType: attachment.contentType
            });
          }
        } catch (error) {
          console.error('Error fetching attachment:', error);
        }
      }
    }

    // Convert message to HTML if it's plain text
    const messageHtml = message.includes('<') && message.includes('>') 
      ? message 
      : message.replace(/\n/g, '<br>');
    
    // Generate email template with theme colors
    const { generateEmailTemplate, generatePlainText } = await import('@/lib/email-template');
    const htmlContent = await generateEmailTemplate(messageHtml);
    
    // Generate plain text version
    const plainText = generatePlainText(message);

    // Send email
    const result = await transporter.sendMail({
      from: `"${smtpFromName}" <${smtpFromAddress}>`,
      to: recipient,
      subject: subject,
      text: plainText,
      html: htmlContent,
      attachments: emailAttachments,
    });

    console.log('Email sent successfully:', result.messageId);

    return {
      success: true,
      messageId: result.messageId
    };
  } catch (error) {
    console.error('Error sending email via SMTP:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { recipients, subject, message, isBulk = false, attachments } = body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json(
        { error: "Recipients array is required" },
        { status: 400 }
      );
    }

    if (!subject || !message) {
      return NextResponse.json(
        { error: "Subject and message are required" },
        { status: 400 }
      );
    }

    // Check if email is enabled
    const emailEnabled = await getSettingValue('EMAIL_ENABLED', 'false');
    if (emailEnabled !== 'true') {
      return NextResponse.json(
        { error: "Email notifications are not enabled" },
        { status: 400 }
      );
    }

    // Normalize recipients to array of email strings
    const emailRecipients = recipients.map((r: any) => typeof r === 'string' ? r : r.email);

    const queueSettings = await getQueueSettings();

    // Use queue for bulk sends based on settings
    const useQueue =
      queueSettings.emailEnabled &&
      (isBulk || emailRecipients.length >= queueSettings.emailBatchSize);

    if (useQueue) {
      // Create email campaign if bulk
      let campaignId = null;
      if (isBulk && emailRecipients.length > 1) {
        const campaign = await prisma.emailCampaign.create({
          data: {
            name: `Bulk Email - ${new Date().toLocaleDateString()}`,
            description: `Bulk email sent to ${emailRecipients.length} recipients`,
            recipients: emailRecipients,
            subject,
            message,
            status: 'SENDING',
            userId: session.user.id,
            sentAt: new Date(),
          },
        });
        campaignId = campaign.id;
      }

      // Add to queue with batching
      const { jobId, totalBatches, totalRecipients } = await addBulkEmailJob({
        recipients: emailRecipients,
        subject,
        message,
        attachments,
        userId: session.user.id,
        campaignId,
        batchSize: queueSettings.emailBatchSize,
        delayBetweenBatches: queueSettings.emailDelayMs,
      });

      return NextResponse.json({
        success: true,
        message: `Email job queued successfully. ${totalRecipients} emails will be sent in ${totalBatches} batches.`,
        jobId,
        totalRecipients,
        totalBatches,
        queued: true,
      });
    } else {
      // For small batches, send directly (synchronous)
      const results = [];
      const emailMessages = [];

      for (const emailAddress of emailRecipients) {
        try {
          const emailResult = await sendEmailViaSMTP(emailAddress, subject, message, attachments);
          
          const emailMessage = await prisma.emailMessage.create({
            data: {
              recipient: emailAddress,
              subject,
              message,
              status: emailResult.success ? 'SENT' : 'FAILED',
              sentAt: emailResult.success ? new Date() : null,
              failedAt: emailResult.success ? null : new Date(),
              errorMessage: emailResult.error || null,
              provider: 'smtp',
              providerId: emailResult.messageId || null,
              userId: session.user.id,
              isBulk: false,
            },
          });

          emailMessages.push(emailMessage);
          results.push({
            recipient: emailAddress,
            success: emailResult.success,
            error: emailResult.error,
            messageId: emailMessage.id
          });
        } catch (error) {
          console.error(`Error sending email to ${emailAddress}:`, error);
          
          const emailMessage = await prisma.emailMessage.create({
            data: {
              recipient: emailAddress,
              subject,
              message,
              status: 'FAILED',
              failedAt: new Date(),
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
              provider: 'smtp',
              userId: session.user.id,
              isBulk: false,
            },
          });

          emailMessages.push(emailMessage);
          results.push({
            recipient: emailAddress,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            messageId: emailMessage.id
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      return NextResponse.json({
        success: true,
        message: `Email processing completed. ${successCount} sent, ${failureCount} failed.`,
        results,
        totalSent: successCount,
        totalFailed: failureCount,
        emailMessages: emailMessages.map(msg => ({
          id: msg.id,
          recipient: msg.recipient,
          status: msg.status,
          sentAt: msg.sentAt,
          errorMessage: msg.errorMessage
        }))
      });
    }

  } catch (error) {
    console.error('Error in email send API:', error);
    return NextResponse.json(
      { error: "Failed to send emails" },
      { status: 500 }
    );
  }
}
