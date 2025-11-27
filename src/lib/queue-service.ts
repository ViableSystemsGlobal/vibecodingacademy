import { Queue, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { getQueueSettings } from './queue-config';

// Lazy connection - only create when needed (not during build)
let connection: IORedis | null = null;
let emailQueue: Queue | null = null;
let SMSQueue: Queue | null = null;
let emailQueueEvents: QueueEvents | null = null;
let smsQueueEvents: QueueEvents | null = null;
let queueAvailable = false;

/**
 * Check if Redis/queue system is available
 */
async function isQueueAvailable(): Promise<boolean> {
  // During build, always return false
  if (process.env.NEXT_PHASE === 'phase-production-build' || process.env.NODE_ENV === 'production' && !process.env.REDIS_URL) {
    return false;
  }

  if (queueAvailable) {
    return true;
  }

  try {
    if (!connection) {
      const queueSettings = await getQueueSettings();
      const redisUrl = process.env.REDIS_URL || queueSettings.redisUrl || 'redis://localhost:6379';
      
      connection = new IORedis(redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: true,
        retryStrategy: () => null,
        connectTimeout: 1000,
        commandTimeout: 1000,
        enableOfflineQueue: false,
      });

      // Test connection
      await connection.ping();
      queueAvailable = true;
    } else {
      await connection.ping();
      queueAvailable = true;
    }
    return true;
  } catch (error) {
    // Redis not available - queue system disabled
    console.warn('Redis/Queue system not available, falling back to synchronous sending:', error);
    queueAvailable = false;
    return false;
  }
}

/**
 * Get or create Redis connection
 */
async function getConnection(): Promise<IORedis | null> {
  if (await isQueueAvailable()) {
    return connection;
  }
  return null;
}

/**
 * Get or create email queue
 */
async function getEmailQueue(): Promise<Queue | null> {
  const conn = await getConnection();
  if (!conn) return null;
  
  if (!emailQueue) {
    emailQueue = new Queue('email-queue', { connection: conn });
  }
  return emailQueue;
}

/**
 * Get or create SMS queue
 */
async function getSMSQueue(): Promise<Queue | null> {
  const conn = await getConnection();
  if (!conn) return null;
  
  if (!SMSQueue) {
    SMSQueue = new Queue('sms-queue', { connection: conn });
  }
  return SMSQueue;
}

export interface EmailJobData {
  recipient: string;
  subject: string;
  message: string;
  attachments?: Array<{ filename: string; url: string; contentType: string }>;
  userId: string;
  campaignId?: string;
  isBulk: boolean;
}

export interface SMSJobData {
  phoneNumber: string;
  message: string;
  userId: string;
  campaignId?: string;
  distributorId?: string;
  isBulk: boolean;
}

export interface BulkEmailJobData {
  recipients: string[];
  subject: string;
  message: string;
  attachments?: Array<{ filename: string; url: string; contentType: string }>;
  userId: string;
  campaignId?: string;
  batchSize?: number;
  delayBetweenBatches?: number;
}

export interface BulkSMSJobData {
  recipients: string[];
  message: string;
  userId: string;
  campaignId?: string;
  distributorId?: string;
  batchSize?: number;
  delayBetweenBatches?: number;
}

/**
 * Add email job to queue
 */
export async function addEmailJob(data: EmailJobData) {
  const queue = await getEmailQueue();
  if (!queue) {
    throw new Error('Queue system not available');
  }
  return await queue.add('send-email', data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  });
}

/**
 * Add bulk email jobs to queue with batching
 */
export async function addBulkEmailJob(data: BulkEmailJobData) {
  const queue = await getEmailQueue();
  if (!queue) {
    throw new Error('Queue system not available');
  }

  const batchSize = data.batchSize || 10;
  const delayBetweenBatches = data.delayBetweenBatches || 1000; // 1 second default
  
  const batches: string[][] = [];
  for (let i = 0; i < data.recipients.length; i += batchSize) {
    batches.push(data.recipients.slice(i, i + batchSize));
  }

  const jobId = `bulk-email-${Date.now()}`;
  
  // Add jobs for each batch with delays
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    await queue.add(
      'send-bulk-email-batch',
      {
        ...data,
        recipients: batch,
        batchNumber: i + 1,
        totalBatches: batches.length,
        jobId,
      },
      {
        delay: i * delayBetweenBatches, // Stagger batches
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        jobId: `${jobId}-batch-${i + 1}`,
      }
    );
  }

  return { jobId, totalBatches: batches.length, totalRecipients: data.recipients.length };
}

/**
 * Add SMS job to queue
 */
export async function addSMSJob(data: SMSJobData) {
  const queue = await getSMSQueue();
  if (!queue) {
    throw new Error('Queue system not available');
  }
  return await queue.add('send-sms', data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  });
}

/**
 * Add bulk SMS jobs to queue with batching
 */
export async function addBulkSMSJob(data: BulkSMSJobData) {
  const queue = await getSMSQueue();
  if (!queue) {
    throw new Error('Queue system not available');
  }

  const batchSize = data.batchSize || 10;
  const delayBetweenBatches = data.delayBetweenBatches || 2000; // 2 seconds default for SMS (more conservative)
  
  const batches: string[][] = [];
  for (let i = 0; i < data.recipients.length; i += batchSize) {
    batches.push(data.recipients.slice(i, i + batchSize));
  }

  const jobId = `bulk-sms-${Date.now()}`;
  
  // Add jobs for each batch with delays
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    await queue.add(
      'send-bulk-sms-batch',
      {
        ...data,
        recipients: batch,
        batchNumber: i + 1,
        totalBatches: batches.length,
        jobId,
      },
      {
        delay: i * delayBetweenBatches, // Stagger batches
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        jobId: `${jobId}-batch-${i + 1}`,
      }
    );
  }

  return { jobId, totalBatches: batches.length, totalRecipients: data.recipients.length };
}

/**
 * Get job progress
 */
export async function getJobProgress(jobId: string, queueType: 'email' | 'sms') {
  const queue = queueType === 'email' ? await getEmailQueue() : await getSMSQueue();
  if (!queue) {
    return {
      total: 0,
      completed: 0,
      failed: 0,
      active: 0,
      progress: 0,
    };
  }
  
  const jobs = await queue.getJobs(['active', 'waiting', 'completed', 'failed']);
  const relatedJobs = jobs.filter(job => 
    job.data.jobId === jobId || job.id?.startsWith(jobId)
  );

  const completed = relatedJobs.filter(job => job.finishedOn).length;
  const failed = relatedJobs.filter(job => job.failedReason).length;
  const active = relatedJobs.filter(job => !job.finishedOn && !job.failedReason).length;
  const total = relatedJobs.length;

  return {
    total,
    completed,
    failed,
    active,
    progress: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

/**
 * Check if queue system is available
 */
export async function isQueueSystemAvailable(): Promise<boolean> {
  return await isQueueAvailable();
}

/**
 * Clean up connection
 */
export async function closeQueues() {
  if (emailQueue) await emailQueue.close();
  if (SMSQueue) await SMSQueue.close();
  if (emailQueueEvents) await emailQueueEvents.close();
  if (smsQueueEvents) await smsQueueEvents.close();
  if (connection) await connection.quit();
}
