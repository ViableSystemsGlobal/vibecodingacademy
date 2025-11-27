import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from '@/lib/prisma';
import nodemailer from 'nodemailer';

// Lazy connection - only create when needed (not during build)
let connection: IORedis | null = null;

function getConnection(): IORedis {
  if (!connection) {
    // During build, create a connection that won't actually connect
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true, // Don't connect immediately - this is key!
      retryStrategy: () => null, // Don't retry - fail fast
      connectTimeout: 100, // Very short timeout
      commandTimeout: 100,
      enableOfflineQueue: false, // Don't queue commands when offline
    });
    
    // Suppress connection errors during build
    connection.on('error', (err) => {
      // Only log if not in build phase
      if (process.env.NEXT_PHASE !== 'phase-production-build') {
        console.error('Redis connection error:', err);
      }
    });
  }
  return connection;
}

// Rate limiting: max emails per second
const EMAIL_RATE_LIMIT = 5; // 5 emails per second
const SMS_RATE_LIMIT = 3; // 3 SMS per second (more conservative)

let lastEmailTime = 0;
let lastSMSTime = 0;

/**
 * Rate limiter helper
 */
async function rateLimit(type: 'email' | 'sms'): Promise<void> {
  const now = Date.now();
  const limit = type === 'email' ? EMAIL_RATE_LIMIT : SMS_RATE_LIMIT;
  const interval = 1000; // 1 second
  
  if (type === 'email') {
    const timeSinceLastEmail = now - lastEmailTime;
    const minInterval = interval / limit;
    
    if (timeSinceLastEmail < minInterval) {
      await new Promise(resolve => setTimeout(resolve, minInterval - timeSinceLastEmail));
    }
    lastEmailTime = Date.now();
  } else {
    const timeSinceLastSMS = now - lastSMSTime;
    const minInterval = interval / limit;
    
    if (timeSinceLastSMS < minInterval) {
      await new Promise(resolve => setTimeout(resolve, minInterval - timeSinceLastSMS));
    }
    lastSMSTime = Date.now();
  }
}

/**
 * Get SMTP settings
 */
async function getSMTPConfig() {
  const settings = await prisma.systemSettings.findMany({
    where: {
      key: {
        in: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USERNAME', 'SMTP_PASSWORD', 'SMTP_FROM_ADDRESS', 'SMTP_FROM_NAME', 'SMTP_ENCRYPTION']
      }
    }
  });

  const config: Record<string, string> = {};
  settings.forEach(setting => {
    config[setting.key] = setting.value;
  });

  return {
    host: config.SMTP_HOST || '',
    port: parseInt(config.SMTP_PORT || '587'),
    secure: config.SMTP_ENCRYPTION === 'ssl',
    auth: {
      user: config.SMTP_USERNAME || '',
      pass: config.SMTP_PASSWORD || '',
    },
    fromAddress: config.SMTP_FROM_ADDRESS || '',
    fromName: config.SMTP_FROM_NAME || 'AdPools Group',
  };
}

/**
 * Get SMS settings
 */
async function getSMSConfig() {
  const settings = await prisma.systemSettings.findMany({
    where: {
      key: {
        in: ['SMS_USERNAME', 'SMS_PASSWORD', 'SMS_SENDER_ID']
      }
    }
  });

  const config: Record<string, string> = {};
  settings.forEach(setting => {
    config[setting.key] = setting.value;
  });

  return {
    username: config.SMS_USERNAME || '',
    password: config.SMS_PASSWORD || '',
    senderId: config.SMS_SENDER_ID || 'AdPools',
  };
}

/**
 * Send email via SMTP
 */
async function sendEmailViaSMTP(
  recipient: string,
  subject: string,
  message: string,
  attachments?: Array<{ filename: string; url: string; contentType: string }>
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    await rateLimit('email');
    
    const smtpConfig = await getSMTPConfig();
    
    if (!smtpConfig.host || !smtpConfig.auth.user || !smtpConfig.fromAddress) {
      return {
        success: false,
        error: 'SMTP configuration not found',
      };
    }

    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: smtpConfig.auth,
    });

    // Convert message to HTML if needed and apply email template
    const messageHtml = message.includes('<') && message.includes('>') 
      ? message 
      : message.replace(/\n/g, '<br>');
    
    // Generate email template with theme colors
    const { generateEmailTemplate, generatePlainText } = await import('@/lib/email-template');
    const htmlContent = await generateEmailTemplate(messageHtml);
    const plainText = generatePlainText(message);

    const mailOptions: any = {
      from: `"${smtpConfig.fromName}" <${smtpConfig.fromAddress}>`,
      to: recipient,
      subject,
      html: htmlContent,
      text: plainText,
    };

    if (attachments && attachments.length > 0) {
      mailOptions.attachments = attachments.map(att => ({
        filename: att.filename,
        path: att.url,
        contentType: att.contentType,
      }));
    }

    const result = await transporter.sendMail(mailOptions);

    return {
      success: true,
      messageId: result.messageId,
    };
  } catch (error: any) {
    console.error(`Error sending email to ${recipient}:`, error);
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Send SMS via Deywuro
 */
async function sendSMSViaDeywuro(
  phoneNumber: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string; cost?: number }> {
  try {
    await rateLimit('sms');
    
    const smsConfig = await getSMSConfig();
    
    if (!smsConfig.username || !smsConfig.password) {
      return {
        success: false,
        error: 'SMS configuration not found',
      };
    }

    // Clean phone number
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      return {
        success: false,
        error: 'Invalid phone number format',
      };
    }

    const response = await fetch('https://deywuro.com/api/sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        username: smsConfig.username,
        password: smsConfig.password,
        destination: phoneNumber,
        source: smsConfig.senderId,
        message: message,
      }),
    });

    const responseText = await response.text();
    let result;
    
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      return {
        success: false,
        error: `SMS provider returned non-JSON response: ${response.status}`,
      };
    }

    if (result.code === 0) {
      return {
        success: true,
        messageId: result.messageId || result.id,
        cost: 0.05, // Default cost
      };
    } else {
      return {
        success: false,
        error: result.message || 'SMS sending failed',
      };
    }
  } catch (error: any) {
    console.error(`Error sending SMS to ${phoneNumber}:`, error);
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Email Worker - Lazy initialization
 */
let _emailWorker: Worker | null = null;

async function isWorkerAvailable(): Promise<boolean> {
  // During build, always return false
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return false;
  }
  
  try {
    const conn = getConnection();
    await conn.ping();
    return true;
  } catch {
    return false;
  }
}

function getEmailWorker(): Worker {
  // Skip worker initialization during build or if Redis unavailable
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    throw new Error('Workers not available during build');
  }
  if (!_emailWorker) {
    _emailWorker = new Worker(
      'email-queue',
      async (job: Job) => {
        const { recipient, subject, message, attachments, userId, campaignId, isBulk } = job.data;

        try {
          const emailResult = await sendEmailViaSMTP(recipient, subject, message, attachments);

          // Save to database
          await prisma.emailMessage.create({
            data: {
              recipient,
              subject,
              message,
              status: emailResult.success ? 'SENT' : 'FAILED',
              sentAt: emailResult.success ? new Date() : null,
              failedAt: emailResult.success ? null : new Date(),
              errorMessage: emailResult.error || null,
              provider: 'smtp',
              providerId: emailResult.messageId || null,
              userId,
              campaignId,
              isBulk,
            },
          });

          return {
            success: emailResult.success,
            recipient,
            error: emailResult.error,
          };
        } catch (error: any) {
          console.error(`Error processing email job for ${recipient}:`, error);
          
          // Save failed email
          await prisma.emailMessage.create({
            data: {
              recipient,
              subject,
              message,
              status: 'FAILED',
              failedAt: new Date(),
              errorMessage: error.message || 'Unknown error',
              provider: 'smtp',
              userId,
              campaignId,
              isBulk,
            },
          });

          throw error;
        }
      },
      { connection: getConnection(), concurrency: 5 } // Process 5 emails concurrently
    );

    /**
     * Bulk Email Batch Worker
     */
    _emailWorker.on('completed', async (job) => {
      if (job.name === 'send-bulk-email-batch') {
        const { jobId, batchNumber, totalBatches } = job.data;
        console.log(`✅ Email batch ${batchNumber}/${totalBatches} completed for job ${jobId}`);
      }
    });

    _emailWorker.on('failed', async (job, err) => {
      console.error(`❌ Email job ${job?.id} failed:`, err);
    });
  }
  return _emailWorker;
}

export { getEmailWorker };
export const emailWorker = new Proxy({} as Worker, {
  get(_target, prop) {
    try {
      return getEmailWorker()[prop as keyof Worker];
    } catch (error) {
      // During build, return a no-op function
      if (typeof prop === 'string' && (prop === 'process' || prop === 'on' || prop === 'off')) {
        return () => {};
      }
      return undefined;
    }
  }
});

/**
 * SMS Worker - Lazy initialization
 */
let _smsWorker: Worker | null = null;

function getSMSWorker(): Worker {
  // Skip worker initialization during build
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    throw new Error('Workers not available during build');
  }
  if (!_smsWorker) {
    _smsWorker = new Worker(
      'sms-queue',
      async (job: Job) => {
        const { phoneNumber, message, userId, campaignId, distributorId, isBulk } = job.data;

        try {
          const smsResult = await sendSMSViaDeywuro(phoneNumber, message);

          // Save to database
          if (distributorId) {
            await prisma.distributorSMS.create({
              data: {
                distributorId,
                to: phoneNumber,
                message,
                status: smsResult.success ? 'SENT' : 'FAILED',
                sentBy: userId,
                sentAt: smsResult.success ? new Date() : null,
              },
            });
          } else {
            await prisma.smsMessage.create({
              data: {
                recipient: phoneNumber,
                message,
                status: smsResult.success ? 'SENT' : 'FAILED',
                sentAt: smsResult.success ? new Date() : null,
                failedAt: smsResult.success ? null : new Date(),
                errorMessage: smsResult.error || null,
                cost: smsResult.cost || 0.05,
                provider: 'deywuro',
                providerId: smsResult.messageId || null,
                userId,
                campaignId,
                isBulk,
              },
            });
          }

          return {
            success: smsResult.success,
            phoneNumber,
            error: smsResult.error,
            cost: smsResult.cost,
          };
        } catch (error: any) {
          console.error(`Error processing SMS job for ${phoneNumber}:`, error);
          
          // Save failed SMS
          if (distributorId) {
            await prisma.distributorSMS.create({
              data: {
                distributorId,
                to: phoneNumber,
                message,
                status: 'FAILED',
                sentBy: userId,
                sentAt: null,
              },
            });
          } else {
            await prisma.smsMessage.create({
              data: {
                recipient: phoneNumber,
                message,
                status: 'FAILED',
                failedAt: new Date(),
                errorMessage: error.message || 'Unknown error',
                provider: 'deywuro',
                userId,
                campaignId,
                isBulk,
              },
            });
          }

          throw error;
        }
      },
      { connection: getConnection(), concurrency: 3 } // Process 3 SMS concurrently (more conservative)
    );

    /**
     * Bulk SMS Batch Worker
     */
    _smsWorker.on('completed', async (job) => {
      if (job.name === 'send-bulk-sms-batch') {
        const { jobId, batchNumber, totalBatches } = job.data;
        console.log(`✅ SMS batch ${batchNumber}/${totalBatches} completed for job ${jobId}`);
      }
    });

    _smsWorker.on('failed', async (job, err) => {
      console.error(`❌ SMS job ${job?.id} failed:`, err);
    });
  }
  return _smsWorker;
}

export { getSMSWorker };
export const smsWorker = new Proxy({} as Worker, {
  get(_target, prop) {
    try {
      return getSMSWorker()[prop as keyof Worker];
    } catch (error) {
      // During build, return a no-op function
      if (typeof prop === 'string' && (prop === 'process' || prop === 'on' || prop === 'off')) {
        return () => {};
      }
      return undefined;
    }
  }
});

// Process bulk email batches
try {
  getEmailWorker().process('send-bulk-email-batch', async (job: Job) => {
  const { recipients, subject, message, attachments, userId, campaignId, batchNumber, totalBatches, jobId } = job.data;

  console.log(`📧 Processing email batch ${batchNumber}/${totalBatches} for job ${jobId} (${recipients.length} recipients)`);

  const results = [];
  for (const recipient of recipients) {
    try {
      const emailResult = await sendEmailViaSMTP(recipient, subject, message, attachments);

      await prisma.emailMessage.create({
        data: {
          recipient,
          subject,
          message,
          status: emailResult.success ? 'SENT' : 'FAILED',
          sentAt: emailResult.success ? new Date() : null,
          failedAt: emailResult.success ? null : new Date(),
          errorMessage: emailResult.error || null,
          provider: 'smtp',
          providerId: emailResult.messageId || null,
          userId,
          campaignId,
          isBulk: true,
        },
      });

      results.push({
        recipient,
        success: emailResult.success,
        error: emailResult.error,
      });
    } catch (error: any) {
      console.error(`Error sending email to ${recipient}:`, error);
      results.push({
        recipient,
        success: false,
        error: error.message,
      });
    }
  }

  return { batchNumber, totalBatches, results };
  });
} catch (error) {
  // Ignore during build
}

// Process bulk SMS batches
try {
  getSMSWorker().process('send-bulk-sms-batch', async (job: Job) => {
  const { recipients, message, userId, campaignId, distributorId, batchNumber, totalBatches, jobId } = job.data;

  console.log(`📱 Processing SMS batch ${batchNumber}/${totalBatches} for job ${jobId} (${recipients.length} recipients)`);

  const results = [];
  for (const phoneNumber of recipients) {
    try {
      const smsResult = await sendSMSViaDeywuro(phoneNumber, message);

      if (distributorId) {
        await prisma.distributorSMS.create({
          data: {
            distributorId,
            to: phoneNumber,
            message,
            status: smsResult.success ? 'SENT' : 'FAILED',
            sentBy: userId,
            sentAt: smsResult.success ? new Date() : null,
          },
        });
      } else {
        await prisma.smsMessage.create({
          data: {
            recipient: phoneNumber,
            message,
            status: smsResult.success ? 'SENT' : 'FAILED',
            sentAt: smsResult.success ? new Date() : null,
            failedAt: smsResult.success ? null : new Date(),
            errorMessage: smsResult.error || null,
            cost: smsResult.cost || 0.05,
            provider: 'deywuro',
            providerId: smsResult.messageId || null,
            userId,
            campaignId,
            isBulk: true,
          },
        });
      }

      results.push({
        phoneNumber,
        success: smsResult.success,
        error: smsResult.error,
        cost: smsResult.cost,
      });
    } catch (error: any) {
      console.error(`Error sending SMS to ${phoneNumber}:`, error);
      results.push({
        phoneNumber,
        success: false,
        error: error.message,
      });
    }
  }

  return { batchNumber, totalBatches, results };
  });
} catch (error) {
  // Ignore during build
}

export async function getWorkerStatus() {
  try {
    const available = await isWorkerAvailable();
    return {
      email: available,
      sms: available,
    };
  } catch {
    return {
      email: false,
      sms: false,
    };
  }
}
